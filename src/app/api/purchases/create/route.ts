import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { broadcastToCharacter } from "@/lib/foundry/realtime";
import { SESSION_COOKIE_CONFIG, getSessionByToken } from "@/lib/auth/index";

export const runtime = 'nodejs';

/**
 * POST /api/purchases/create
 * 
 * Create a new purchase for a character from the website.
 * 
 * This endpoint is called when a user makes a purchase on the Harkonians website.
 * It performs the following:
 * 1. Validates the user's session
 * 2. Validates the character belongs to the user
 * 3. Validates the character is linked to a Foundry Actor
 * 4. Validates the item exists and has foundryItemData
 * 5. Validates stock and balance atomically
 * 6. Creates the purchase in PENDING state
 * 7. Deducts balance and stock atomically
 * 8. Broadcasts the purchase to Foundry via Supabase Realtime
 * 
 * Request body:
 * {
 *   "itemId": "...",
 *   "characterId": "...",
 *   "quantity": 1,
 *   "idempotencyKey": "..."
 * }
 * 
 * Returns:
 * - 201 Created with purchase data on success
 * - 400 Bad Request on validation errors
 * - 401 Unauthorized if not authenticated
 * - 403 Forbidden if character not linked
 * - 404 Not Found if item or character not found
 * - 409 Conflict if idempotency key already used
 */
export async function POST(request: Request) {
  try {
    // Authenticate user via session cookie
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_CONFIG.name)?.value;
    const session = sessionToken ? await getSessionByToken(sessionToken) : null;
    
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    
    // Parse body
    let body: {
      itemId?: string;
      characterId?: string;
      quantity?: number;
      idempotencyKey?: string;
    };
    
    try {
      const bodyText = await request.text();
      if (bodyText) {
        body = JSON.parse(bodyText);
      } else {
        body = {};
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }
    
    const itemId = body?.itemId?.trim();
    const characterId = body?.characterId?.trim();
    const quantity = body?.quantity ?? 1;
    const idempotencyKey = body?.idempotencyKey?.trim();
    
    if (!itemId || !characterId || !idempotencyKey) {
      return NextResponse.json(
        { error: "itemId, characterId, and idempotencyKey are required" },
        { status: 400 }
      );
    }
    
    // Validate character belongs to user
    const character = await prisma.character.findUnique({
      where: { 
        id: characterId,
        userId: session.user.id 
      },
      include: { 
        katastroWorld: true
      }
    });
    
    if (!character) {
      return NextResponse.json(
        { error: "Character not found or not owned by user" },
        { status: 404 }
      );
    }
    
    // Check character is linked to Foundry
    if (!character.foundryWorldId || !character.foundryActorId || !character.katastroWorldId) {
      return NextResponse.json(
        { error: "Character is not linked to a Foundry Actor" },
        { status: 409 }
      );
    }
    
    // Get item
    const item = await prisma.item.findUnique({
      where: { id: itemId }
    });
    
    if (!item) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }
    
    // Items without foundryItemData cannot be purchased through Foundry
    if (!item.foundryItemData) {
      return NextResponse.json(
        { error: "Item is not published from Foundry and cannot be purchased for delivery" },
        { status: 400 }
      );
    }
    
    // Validate quantity
    if (quantity < 1) {
      return NextResponse.json(
        { error: "Quantity must be at least 1" },
        { status: 400 }
      );
    }
    
    // Check for existing purchase with same idempotency key
    const existingPurchase = await prisma.purchase.findUnique({
      where: { idempotencyKey }
    });
    
    if (existingPurchase) {
      // Return the existing purchase - idempotency
      return NextResponse.json({
        success: true,
        purchase: {
          id: existingPurchase.id,
          status: existingPurchase.status,
          message: "Duplicate request - returning existing purchase"
        }
      });
    }
    
    // Calculate total price in copper
    const totalPriceCp = item.priceCp * quantity;
    
    // Validate stock
    const currentStock = item.stock;
    const isUnlimited = currentStock === -1;
    const hasSufficientStock = isUnlimited || currentStock >= quantity;
    
    if (!hasSufficientStock) {
      return NextResponse.json(
        { error: "Insufficient stock" },
        { status: 400 }
      );
    }
    
    // Validate balance
    if (character.creditBalance < totalPriceCp) {
      return NextResponse.json(
        { error: "Insufficient funds" },
        { status: 400 }
      );
    }
    
    // Atomic transaction for purchase creation, balance deduction, and stock decrement
    const result = await prisma.$transaction(async (tx) => {
      // For finite stock, check again (race condition protection)
      if (!isUnlimited) {
        const currentItem = await tx.item.findUnique({
          where: { id: itemId },
          select: { stock: true }
        });
        
        if (!currentItem || currentItem.stock < quantity) {
          throw new Error("Insufficient stock");
        }
      }
      
      // Check balance again (race condition protection)
      const currentCharacter = await tx.character.findUnique({
        where: { id: characterId },
        select: { creditBalance: true }
      });
      
      if (!currentCharacter || currentCharacter.creditBalance < totalPriceCp) {
        throw new Error("Insufficient funds");
      }
      
      // Create purchase (PENDING)
      const purchase = await tx.purchase.create({
        data: {
          idempotencyKey,
          characterId,
          itemId,
          itemName: item.name,
          priceCp: totalPriceCp,
          quantity,
          status: "PENDING"
        }
      });
      
      // Deduct balance
      await tx.character.update({
        where: { id: characterId },
        data: { creditBalance: { decrement: totalPriceCp } }
      });
      
      // Decrement stock (if not unlimited)
      if (!isUnlimited) {
        await tx.item.update({
          where: { id: itemId },
          data: { stock: { decrement: quantity } }
        });
      }
      
      return purchase;
    });
    
    // Broadcast purchase to Foundry via Supabase Realtime
    await broadcastToCharacter(characterId, {
      event: "purchase",
      payload: {
        purchaseId: result.id,
        actorId: character.foundryActorId,
        quantity: result.quantity,
        item: {
          id: item.id,
          name: item.name,
          type: item.type,
          description: item.description,
          rarity: item.rarity,
          image: item.image,
          foundryItemData: item.foundryItemData
        }
      }
    });
    
    // Broadcast gold update
    const updatedCharacter = await prisma.character.findUnique({
      where: { id: characterId },
      select: { creditBalance: true }
    });
    
    await broadcastToCharacter(characterId, {
      event: "gold_update",
      payload: {
        actorId: character.foundryActorId,
        characterId: character.id,
        gold: updatedCharacter?.creditBalance || 0
      }
    });
    
    // Broadcast stock update
    const updatedItem = await prisma.item.findUnique({
      where: { id: itemId },
      select: { stock: true }
    });
    
    await broadcastToCharacter(characterId, {
      event: "stock_update",
      payload: {
        itemId: item.id,
        stock: updatedItem?.stock || 0
      }
    });
    
    return NextResponse.json({
      success: true,
      purchase: {
        id: result.id,
        status: "PENDING",
        message: "Purchase created and broadcast to Foundry"
      }
    }, { status: 201 });
    
  } catch (error) {
    console.error("Purchase creation error:", error);
    
    // Check for specific error types
    const message = (error as Error).message;
    if (message === "Insufficient stock" || message === "Insufficient funds") {
      return NextResponse.json(
        { error: message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: message || "Purchase failed" },
      { status: 500 }
    );
  }
}

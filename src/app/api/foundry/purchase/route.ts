import { NextResponse } from "next/server";
import { getWorldBySecret } from "@/lib/foundry/worldSecret";
import { prisma } from "@/lib/prisma";
import { createAuditLog, createAuditContextFromRequest } from "@/lib/audit";
import { broadcastToCharacter } from "@/lib/foundry/realtime";

export const runtime = 'nodejs';

function addCorsHeaders(response: NextResponse, request: Request): void {
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Origin", request.headers.get("origin") || "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-foundry-world-secret");
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(request: Request) {
  const response = new NextResponse(null, { status: 204 });
  addCorsHeaders(response, request);
  return response;
}

/**
 * POST /api/foundry/purchase
 * Handle a purchase from Foundry module.
 * 
 * This endpoint is called when:
 * 1. A user makes a purchase in the store (browser -> Harkonians -> Foundry)
 * 2. Foundry confirms the purchase and creates the item
 * 
 * Request headers:
 * - x-foundry-world-secret: World secret for authentication
 * 
 * Request body:
 * {
 *   "purchaseId": "...",
 *   "status": "completed" | "failed",
 *   "foundryActorId": "...",
 *   "foundryItemId": "...",
 *   "error"?: "..."  // Only for failed purchases
 * }
 * 
 * Returns:
 * - 200 OK on success
 * - 401 Unauthorized if authentication fails
 */
export async function POST(request: Request) {
  try {
    // Validate world secret
    const worldSecret = request.headers.get("x-foundry-world-secret");
    if (!worldSecret) {
      const response = NextResponse.json(
        { error: "World secret is required in x-foundry-world-secret header" },
        { status: 401 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    const world = await getWorldBySecret(worldSecret);
    if (!world) {
      const response = NextResponse.json(
        { error: "Invalid world secret" },
        { status: 401 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Parse request body
    let body: {
      purchaseId?: string;
      status?: string;
      foundryActorId?: string;
      foundryItemId?: string;
      error?: string;
    } = {};
    try {
      const bodyText = await request.text();
      if (bodyText) {
        body = JSON.parse(bodyText);
      }
    } catch {
      const response = NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    const { purchaseId, status, foundryActorId, foundryItemId, error } = body;

    if (!purchaseId || !status) {
      const response = NextResponse.json(
        { error: "purchaseId and status are required" },
        { status: 400 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Handle failed purchase
    if (status === 'failed') {
      const purchase = await prisma.purchase.findUnique({
        where: { id: purchaseId },
        include: {
          character: {
            select: {
              id: true,
              foundryWorldId: true,
              foundryActorId: true,
              creditBalance: true
            }
          },
          item: true
        }
      });

      if (!purchase) {
        const response = NextResponse.json(
          { error: "Purchase not found" },
          { status: 404 }
        );
        addCorsHeaders(response, request);
        return response;
      }

      // Verify purchase is PENDING
      if (purchase.status !== "PENDING") {
        const response = NextResponse.json(
          { error: "Only PENDING purchases can be failed" },
          { status: 409 }
        );
        addCorsHeaders(response, request);
        return response;
      }

      // Verify this purchase belongs to this world
      if (purchase.character.foundryWorldId !== world.foundryWorldId) {
        const response = NextResponse.json(
          { error: "Purchase does not belong to this world" },
          { status: 403 }
        );
        addCorsHeaders(response, request);
        return response;
      }

      // Atomic refund and stock restoration
      await prisma.$transaction(async (tx) => {
        // Refund the character
        await tx.character.update({
          where: { id: purchase.characterId },
          data: { creditBalance: { increment: purchase.priceCp } }
        });

        // Restore stock if item exists and stock is finite
        if (purchase.item && purchase.item.stock !== -1) {
          await tx.item.update({
            where: { id: purchase.item.id },
            data: { stock: { increment: purchase.quantity } }
          });
        }

        // Mark purchase as FAILED
        await tx.purchase.update({
          where: { id: purchaseId },
          data: {
            status: "FAILED",
            failureReason: error || null
          }
        });
      });

      const context = createAuditContextFromRequest(request, {
        purchaseId,
        status: 'failed',
        error: error || null
      });
      await createAuditLog(
        world.dmUserId,
        "PURCHASE_FAILED",
        "Purchase",
        purchaseId,
        context
      );

      const response = NextResponse.json({
        success: true,
        message: "Purchase failed, refunded, and stock restored"
      });
      addCorsHeaders(response, request);
      return response;
    }

    // Handle completed purchase
    if (status === 'completed') {
      // Find the purchase
      const purchase = await prisma.purchase.findUnique({
        where: { id: purchaseId },
        include: {
          character: {
            select: {
              id: true,
              foundryWorldId: true,
              foundryActorId: true,
              creditBalance: true
            }
          },
          item: true
        }
      });

      if (!purchase) {
        const response = NextResponse.json(
          { error: "Purchase not found" },
          { status: 404 }
        );
        addCorsHeaders(response, request);
        return response;
      }

      // Verify this purchase belongs to this world
      if (purchase.character.foundryWorldId !== world.foundryWorldId) {
        const response = NextResponse.json(
          { error: "Purchase does not belong to this world" },
          { status: 403 }
        );
        addCorsHeaders(response, request);
        return response;
      }

      // Update purchase status and store Foundry item ID
      await prisma.purchase.update({
        where: { id: purchaseId },
        data: {
          status: 'COMPLETED',
          foundryItemId: foundryItemId
        }
      });

      // Note: Stock was already decremented atomically when the purchase was created
      // via the website. We do NOT decrement again here to avoid race conditions.

      // Log the completed purchase
      const context = createAuditContextFromRequest(request, {
        purchaseId,
        foundryActorId: foundryActorId || null,
        foundryItemId: foundryItemId || null,
        itemId: purchase.itemId,
        itemName: purchase.itemName,
        priceCp: purchase.priceCp
      });
      await createAuditLog(
        world.dmUserId,
        "PURCHASE_COMPLETED",
        "Purchase",
        purchaseId,
        context
      );

      // Broadcast purchase completion to Foundry via Supabase Realtime
      await broadcastToCharacter(purchase.characterId, {
        event: "purchase",
        payload: {
          purchaseId: purchase.id,
          actorId: purchase.character.foundryActorId!,
          quantity: purchase.quantity,
          item: {
            id: purchase.itemId!,
            name: purchase.itemName,
            type: purchase.item?.type || 'item',
            description: purchase.item?.description || '',
            rarity: purchase.item?.rarity || 'COMMON',
            image: purchase.item?.image || '',
            foundryItemData: purchase.item?.foundryItemData || {}
          }
        }
      });

      // Broadcast gold update
      await broadcastToCharacter(purchase.characterId, {
        event: "gold_update",
        payload: {
          actorId: purchase.character.foundryActorId!,
          characterId: purchase.characterId,
          gold: purchase.character.creditBalance
        }
      });

      // Broadcast stock update with the current stock value
      if (purchase.item) {
        // Get current stock value (may have been updated by other purchases)
        const currentItem = await prisma.item.findUnique({
          where: { id: purchase.item.id },
          select: { stock: true }
        });
        
        await broadcastToCharacter(purchase.characterId, {
          event: "stock_update",
          payload: {
            itemId: purchase.item.id,
            stock: currentItem?.stock || 0
          }
        });
      }

      const response = NextResponse.json({
        success: true,
        message: "Purchase confirmed",
        purchase: {
          id: purchaseId,
          status: 'completed'
        }
      });
      addCorsHeaders(response, request);
      return response;
    }

    const response = NextResponse.json(
      { error: `Unknown status: ${status}` },
      { status: 400 }
    );
    addCorsHeaders(response, request);
    return response;
  } catch (error) {
    console.error("Purchase handler error:", error);
    const response = NextResponse.json(
      { error: (error as Error).message || "An error occurred" },
      { status: 500 }
    );
    addCorsHeaders(response, request);
    return response;
  }
}

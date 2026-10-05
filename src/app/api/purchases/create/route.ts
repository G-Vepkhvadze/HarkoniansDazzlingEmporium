import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE_CONFIG,
  getSessionByToken
} from "@/lib/auth/index";

export const runtime = "nodejs";

/**
 * POST /api/purchases/create
 *
 * Creates a purchase for a linked Foundry character.
 */
export async function POST(request: Request) {
  try {
    // ---------------------------------------------------------
    // Authentication
    // ---------------------------------------------------------

    const cookieStore = await cookies();

    const sessionToken = cookieStore.get(
      SESSION_COOKIE_CONFIG.name
    )?.value;

    const session = sessionToken
      ? await getSessionByToken(sessionToken)
      : null;

    if (!session) {
      return NextResponse.json(
        {
          error: "Authentication required"
        },
        { status: 401 }
      );
    }

    // ---------------------------------------------------------
    // Parse request body
    // ---------------------------------------------------------

    let body: {
      itemId?: string;
      characterId?: string;
      quantity?: number;
      idempotencyKey?: string;
    } = {};

    try {
      const bodyText = await request.text();

      body = bodyText
        ? JSON.parse(bodyText)
        : {};
    } catch {
      return NextResponse.json(
        {
          error: "Invalid JSON in request body"
        },
        { status: 400 }
      );
    }

    const itemId = body.itemId?.trim();
    const characterId = body.characterId?.trim();
    const quantity = body.quantity ?? 1;
    const idempotencyKey =
      body.idempotencyKey?.trim();

    if (
      !itemId ||
      !characterId ||
      !idempotencyKey
    ) {
      return NextResponse.json(
        {
          error:
            "itemId, characterId, and idempotencyKey are required"
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // Validate quantity
    // ---------------------------------------------------------

    if (
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      return NextResponse.json(
        {
          error:
            "Quantity must be a positive whole number"
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // Validate character
    // ---------------------------------------------------------

    const character =
      await prisma.character.findFirst({
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
        {
          error:
            "Character not found or not owned by user"
        },
        { status: 404 }
      );
    }

    // Character must be linked to Foundry.
    if (
      !character.foundryWorldId ||
      !character.foundryActorId ||
      !character.katastroWorldId
    ) {
      return NextResponse.json(
        {
          error:
            "Character is not linked to a Foundry Actor"
        },
        { status: 409 }
      );
    }

    // ---------------------------------------------------------
    // Get item
    // ---------------------------------------------------------

    const item =
      await prisma.item.findUnique({
        where: {
          id: itemId
        }
      });

    if (!item) {
      return NextResponse.json(
        {
          error: "Item not found"
        },
        { status: 404 }
      );
    }

    // Foundry delivery requires the original Foundry data.
    if (!item.foundryItemData) {
      return NextResponse.json(
        {
          error:
            "Item is not published from Foundry and cannot be purchased for delivery"
        },
        { status: 400 }
      );
    }

    const foundryItemObject =
        typeof item.foundryItemData === "object" &&
        item.foundryItemData !== null &&
        !Array.isArray(item.foundryItemData)
            ? item.foundryItemData as Record<string, unknown>
            : null;

    const foundryMetadata =
        foundryItemObject?._harkoniansMetadata;

    const foundryWorldId =
        typeof foundryMetadata === "object" &&
        foundryMetadata !== null &&
        !Array.isArray(foundryMetadata) &&
        "foundryWorldId" in foundryMetadata &&
        typeof foundryMetadata.foundryWorldId === "string"
            ? foundryMetadata.foundryWorldId
            : null;

    if (
        !foundryWorldId ||
        foundryWorldId !== character.foundryWorldId
    ) {
      return NextResponse.json(
          {
            error:
                "This Foundry item is not linked to the same Foundry world as the selected character."
          },
          { status: 409 }
      );
    }

    // ---------------------------------------------------------
    // Idempotency
    // ---------------------------------------------------------

    const existingPurchase =
      await prisma.purchase.findUnique({
        where: {
          idempotencyKey
        }
      });

    if (existingPurchase) {
      // An idempotency key is only valid for the exact original request.
      if (
        existingPurchase.characterId !== characterId ||
        existingPurchase.itemId !== itemId ||
        existingPurchase.quantity !== quantity
      ) {
        return NextResponse.json(
          {
            error:
              "Idempotency key was already used for a different purchase request."
          },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        purchase: {
          id: existingPurchase.id,
          status: existingPurchase.status,
          message:
            "Duplicate request - returning existing purchase"
        }
      });
    }

    // ---------------------------------------------------------
    // Calculate authoritative sale price in GP
    // ---------------------------------------------------------

    const discount =
      item.deal &&
      item.discountPercent > 0
        ? item.discountPercent
        : 0;

    const unitPriceGp =
      discount > 0
        ? Math.round(
            item.price *
              (1 - discount / 100)
          )
        : item.price;

    const totalPriceGp =
      unitPriceGp * quantity;

    // ---------------------------------------------------------
    // Validate stock
    // ---------------------------------------------------------

    const isUnlimited =
      item.stock === -1;

    if (
      !isUnlimited &&
      item.stock < quantity
    ) {
      return NextResponse.json(
        {
          error: "Insufficient stock"
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // Validate balance
    // ---------------------------------------------------------

    if (
      character.creditBalance <
      totalPriceGp
    ) {
      return NextResponse.json(
        {
          error: "Insufficient funds"
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // Atomic purchase transaction
    // ---------------------------------------------------------

    let purchase;

    try {
      purchase = await prisma.$transaction(async (tx) => {
        // Reserve the idempotency key first. If another request is using the
        // same key, the unique constraint blocks here rather than allowing
        // that request to consume stock or GP before discovering the race.
        const newPurchase =
          await tx.purchase.create({
            data: {
              idempotencyKey,
              characterId,
              itemId,
              itemName: item.name,
              priceGp: totalPriceGp,
              quantity,
              status: "PENDING"
            }
          });

        // Atomically reserve finite stock.
        if (!isUnlimited) {
          const stockResult = await tx.item.updateMany({
            where: {
              id: itemId,
              stock: { gte: quantity }
            },
            data: {
              stock: { decrement: quantity }
            }
          });

          if (stockResult.count !== 1) {
            throw new Error("Insufficient stock");
          }
        }

        // Atomically reserve the character's GP.
        const balanceResult =
          await tx.character.updateMany({
            where: {
              id: characterId,
              creditBalance: { gte: totalPriceGp }
            },
            data: {
              creditBalance: {
                decrement: totalPriceGp
              }
            }
          });

        if (balanceResult.count !== 1) {
          throw new Error("Insufficient funds");
        }

        return newPurchase;
      });

    } catch (error) {
      // A unique idempotency race must return the already-created purchase,
      // not HTTP 500 and not charge the player a second time.
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002"
      ) {
        const concurrentPurchase =
          await prisma.purchase.findUnique({
            where: { idempotencyKey }
          });

        if (concurrentPurchase) {
          if (
            concurrentPurchase.characterId !== characterId ||
            concurrentPurchase.itemId !== itemId ||
            concurrentPurchase.quantity !== quantity
          ) {
            return NextResponse.json(
              {
                error:
                  "Idempotency key was already used for a different purchase request."
              },
              { status: 409 }
            );
          }

          return NextResponse.json({
            success: true,
            purchase: {
              id: concurrentPurchase.id,
              status: concurrentPurchase.status,
              message:
                "Duplicate request - returning existing purchase"
            }
          });
        }

      }

      throw error;
    }

    const updatedCharacter =
        await prisma.character.findUnique({
          where: {
            id: characterId
          },
          select: {
            id: true,
            creditBalance: true
          }
        });

    if (!updatedCharacter) {
      throw new Error(
          "Character disappeared after purchase."
      );
    }

    // Realtime notifications are emitted by PostgreSQL triggers after the
    // transaction commits. This route only needs to create the durable
    // PENDING record; Foundry will receive the broadcast and can recover it
    // from /foundry/purchases/pending if the WebSocket is unavailable.

    // =========================================================
    // SUCCESS
    // =========================================================

    return NextResponse.json(
        {
          success: true,

          purchase: {
            id: purchase.id,
            status: "PENDING",
            message:
                "Purchase created and sent to Foundry"
          },

          character: {
            id: updatedCharacter.id,
            gold: updatedCharacter.creditBalance
          }
        },
        { status: 201 }
    );

  } catch (error) {
    console.error(
      "Purchase creation error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Purchase failed";

    if (
      message === "Insufficient stock" ||
      message === "Insufficient funds"
    ) {
      return NextResponse.json(
        {
          error: message
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: message
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { broadcastToCharacter } from "@/lib/foundry/realtime";
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

    const purchase =
      await prisma.$transaction(
        async (tx) => {
          // Re-check finite stock inside transaction.
          if (!isUnlimited) {
            const currentItem =
              await tx.item.findUnique({
                where: {
                  id: itemId
                },
                select: {
                  stock: true
                }
              });

            if (
              !currentItem ||
              currentItem.stock < quantity
            ) {
              throw new Error(
                "Insufficient stock"
              );
            }
          }

          // Re-check balance inside transaction.
          const currentCharacter =
            await tx.character.findUnique({
              where: {
                id: characterId
              },
              select: {
                creditBalance: true
              }
            });

          if (
            !currentCharacter ||
            currentCharacter.creditBalance <
              totalPriceGp
          ) {
            throw new Error(
              "Insufficient funds"
            );
          }

          // Create the pending purchase.
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

          // Deduct GP.
          await tx.character.update({
            where: {
              id: characterId
            },
            data: {
              creditBalance: {
                decrement: totalPriceGp
              }
            }
          });

          // Decrement finite stock.
          if (!isUnlimited) {
            await tx.item.update({
              where: {
                id: itemId
              },
              data: {
                stock: {
                  decrement: quantity
                }
              }
            });
          }

          return newPurchase;
        }
      );

    // =========================================================
    // PURCHASE DELIVERY
    // =========================================================

    /*
     * This is the critical broadcast.
     *
     * If this fails, Foundry has not been told about the purchase.
     * We therefore return an error instead of pretending delivery
     * succeeded.
     */
    try {
      await broadcastToCharacter(
        characterId,
        {
          event: "purchase",
          payload: {
            purchaseId: purchase.id,
            actorId:
              character.foundryActorId,
            quantity: purchase.quantity,
            item: {
              id: item.id,
              name: item.name,
              type: item.type,
              description: item.description,
              rarity: item.rarity,
              image: item.image,

              // IMPORTANT:
              // This is the original Foundry item JSON.
              foundryItemData:
                item.foundryItemData
            }
          }
        }
      );
    } catch (error) {
      console.error(
        "Purchase created but failed to broadcast to Foundry:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Purchase was created, but delivery to Foundry failed. Please try again or contact the DM.",
          purchaseId: purchase.id,
          status: purchase.status
        },
        { status: 500 }
      );
    }

    // =========================================================
    // GOLD UPDATE
    // =========================================================

    try {
      const updatedCharacter =
        await prisma.character.findUnique({
          where: {
            id: characterId
          },
          select: {
            creditBalance: true
          }
        });

      await broadcastToCharacter(
        characterId,
        {
          event: "gold_update",
          payload: {
            actorId:
              character.foundryActorId,
            characterId:
              character.id,
            gold:
              updatedCharacter?.creditBalance ??
              0
          }
        }
      );
    } catch (error) {
      /*
       * Gold synchronization is not allowed to turn a valid
       * purchase into a failed HTTP request.
       *
       * Foundry also performs periodic gold reconciliation.
       */
      console.error(
        "Purchase succeeded but failed to broadcast gold update:",
        error
      );
    }

    // =========================================================
    // STOCK UPDATE
    // =========================================================

    try {
      const updatedItem =
        await prisma.item.findUnique({
          where: {
            id: itemId
          },
          select: {
            stock: true
          }
        });

      await broadcastToCharacter(
        characterId,
        {
          event: "stock_update",
          payload: {
            itemId: item.id,
            stock:
              updatedItem?.stock ?? 0
          }
        }
      );
    } catch (error) {
      /*
       * Stock synchronization is also non-fatal.
       * The actual database stock is already correct.
       */
      console.error(
        "Purchase succeeded but failed to broadcast stock update:",
        error
      );
    }

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

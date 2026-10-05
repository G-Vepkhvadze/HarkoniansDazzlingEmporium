
import { NextResponse } from "next/server";
import { getWorldBySecret } from "@/lib/foundry/worldSecret";
import { prisma } from "@/lib/prisma";
import { requireFullFoundryAuthorization } from "@/lib/foundry/worldSecretMiddleware";
import {
  createAuditLog,
  createAuditContextFromRequest
} from "@/lib/audit";

export const runtime = "nodejs";

function addCorsHeaders(
  response: NextResponse,
  request: Request
): void {
  response.headers.set(
    "Access-Control-Allow-Credentials",
    "true"
  );

  response.headers.set(
    "Access-Control-Allow-Origin",
    request.headers.get("origin") || "*"
  );

  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS"
  );

  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-foundry-world-secret"
  );
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(request: Request) {
  const response = new NextResponse(null, {
    status: 204
  });

  addCorsHeaders(response, request);

  return response;
}

/**
 * POST /api/foundry/purchase
 *
 * Handles Foundry confirmation of a Harkonians purchase.
 *
 * Foundry calls this endpoint after attempting to deliver
 * a purchase to the linked Actor.
 *
 * Request headers:
 * - x-foundry-world-secret
 *
 * Request body:
 * {
 *   "purchaseId": "...",
 *   "status": "completed" | "failed",
 *   "foundryActorId": "...",
 *   "foundryItemId": "...",
 *   "error"?: "..."
 * }
 *
 * Completed:
 * - Verifies the purchase belongs to this world and actor.
 * - Marks the purchase COMPLETED.
 *
 * Failed:
 * - Verifies the purchase belongs to this world and actor.
 * - Refunds the GP.
 * - Restores finite stock.
 * - Marks the purchase FAILED.
 * - PostgreSQL triggers broadcast the restored gold and stock to Foundry.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireFullFoundryAuthorization(request);

    // ---------------------------------------------------------
    // Validate world secret
    // ---------------------------------------------------------

    const worldSecret = request.headers.get(
      "x-foundry-world-secret"
    );

    if (!worldSecret) {
      const response = NextResponse.json(
        {
          error:
            "World secret is required in x-foundry-world-secret header"
        },
        { status: 401 }
      );

      addCorsHeaders(response, request);
      return response;
    }

    const world = await getWorldBySecret(worldSecret);

    if (!world) {
      const response = NextResponse.json(
        {
          error: "Invalid world secret"
        },
        { status: 401 }
      );

      addCorsHeaders(response, request);
      return response;
    }

    // ---------------------------------------------------------
    // Parse request body
    // ---------------------------------------------------------

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
        {
          error: "Invalid JSON in request body"
        },
        { status: 400 }
      );

      addCorsHeaders(response, request);
      return response;
    }

    const {
      purchaseId,
      status,
      foundryActorId,
      foundryItemId,
      error
    } = body;

    if (auth.world.id !== world.id || auth.world.foundryWorldId !== world.foundryWorldId) {
      const response = NextResponse.json(
        { error: "Foundry authorization does not match this world." },
        { status: 403 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    if (foundryActorId && auth.character.foundryActorId !== foundryActorId) {
      const response = NextResponse.json(
        { error: "Foundry actor does not match the linked Harkonians character." },
        { status: 403 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    if (!purchaseId || !status) {
      const response = NextResponse.json(
        {
          error: "purchaseId and status are required"
        },
        { status: 400 }
      );

      addCorsHeaders(response, request);
      return response;
    }

    // =========================================================
    // FAILED PURCHASE
    // =========================================================

    if (status === "failed") {
      const purchase = await prisma.purchase.findUnique({
        where: {
          id: purchaseId
        },
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
          {
            error: "Purchase not found"
          },
          { status: 404 }
        );

        addCorsHeaders(response, request);
        return response;
      }

      // Only pending purchases can be failed.
      if (purchase.status !== "PENDING") {
        const response = NextResponse.json(
          {
            error:
              "Only PENDING purchases can be failed"
          },
          { status: 409 }
        );

        addCorsHeaders(response, request);
        return response;
      }

      // Verify purchase belongs to this Foundry world.
      if (
        purchase.character.foundryWorldId !==
        world.foundryWorldId
      ) {
        const response = NextResponse.json(
          {
            error:
              "Purchase does not belong to this world"
          },
          { status: 403 }
        );

        addCorsHeaders(response, request);
        return response;
      }

      // Verify purchase belongs to this Foundry Actor.
      if (
        !foundryActorId ||
        foundryActorId !==
          purchase.character.foundryActorId
      ) {
        const response = NextResponse.json(
          {
            error:
              "Purchase actor does not match linked character actor"
          },
          { status: 403 }
        );

        addCorsHeaders(response, request);
        return response;
      }

      // -------------------------------------------------------
      // Atomically claim the pending purchase before refunding.
      //
      // This prevents two retrying Foundry clients from both refunding
      // the same purchase.
      // -------------------------------------------------------

      await prisma.$transaction(async (tx) => {
        const claimed =
          await tx.purchase.updateMany({
            where: {
              id: purchaseId,
              status: "PENDING"
            },
            data: {
              status: "FAILED",
              failureReason: error || null
            }
          });

        if (claimed.count !== 1) {
          throw new Error(
            "Purchase is no longer pending."
          );
        }

        await tx.character.update({
          where: {
            id: purchase.characterId
          },
          data: {
            creditBalance: {
              increment: purchase.priceGp
            }
          }
        });

        // Restore stock only for finite-stock items.
        if (
          purchase.item &&
          purchase.item.stock !== -1
        ) {
          await tx.item.update({
            where: {
              id: purchase.item.id
            },
            data: {
              stock: {
                increment: purchase.quantity
              }
            }
          });
        }
      });

      // -------------------------------------------------------
      // Audit log
      // -------------------------------------------------------

      const context =
        createAuditContextFromRequest(request, {
          purchaseId,
          status: "failed",
          foundryActorId,
          error: error || null,
          refundedGp: purchase.priceGp
        });

      await createAuditLog(
        world.dmUserId,
        "PURCHASE_FAILED",
        "Purchase",
        purchaseId,
        context
      );

      // PostgreSQL triggers broadcast the authoritative gold/stock changes.

      const response = NextResponse.json({
        success: true,
        message:
          "Purchase failed, refunded, and stock restored"
      });

      addCorsHeaders(response, request);
      return response;
    }

    // =========================================================
    // COMPLETED PURCHASE
    // =========================================================

    if (status === "completed") {
      if (!foundryActorId || !foundryItemId) {
        const response = NextResponse.json(
          {
            error:
              "completed purchases require foundryActorId and foundryItemId"
          },
          { status: 400 }
        );

        addCorsHeaders(response, request);
        return response;
      }

      const purchase =
        await prisma.purchase.findUnique({
          where: {
            id: purchaseId
          },
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
          {
            error: "Purchase not found"
          },
          { status: 404 }
        );

        addCorsHeaders(response, request);
        return response;
      }

      // -------------------------------------------------------
      // Idempotency
      // -------------------------------------------------------

      // If Foundry retries an acknowledgement for a purchase
      // that has already been completed, don't process it again.
      if (purchase.status === "COMPLETED") {
        if (
          !foundryActorId ||
          foundryActorId !==
            purchase.character.foundryActorId
        ) {
          const response = NextResponse.json(
            {
              error:
                "Purchase actor does not match linked character actor"
            },
            { status: 403 }
          );

          addCorsHeaders(response, request);
          return response;
        }

        const response = NextResponse.json({
          success: true,
          message: "Purchase already confirmed",
          purchase: {
            id: purchaseId,
            status: "completed"
          }
        });

        addCorsHeaders(response, request);
        return response;
      }

      // Only pending purchases can be completed.
      if (purchase.status !== "PENDING") {
        const response = NextResponse.json(
          {
            error:
              `Purchase cannot be completed from status ${purchase.status}`
          },
          { status: 409 }
        );

        addCorsHeaders(response, request);
        return response;
      }

      // Verify purchase belongs to this Foundry world.
      if (
        purchase.character.foundryWorldId !==
        world.foundryWorldId
      ) {
        const response = NextResponse.json(
          {
            error:
              "Purchase does not belong to this world"
          },
          { status: 403 }
        );

        addCorsHeaders(response, request);
        return response;
      }

      // Verify purchase belongs to this Foundry Actor.
      if (
        !foundryActorId ||
        foundryActorId !==
          purchase.character.foundryActorId
      ) {
        const response = NextResponse.json(
          {
            error:
              "Purchase actor does not match linked character actor"
          },
          { status: 403 }
        );

        addCorsHeaders(response, request);
        return response;
      }

      // -------------------------------------------------------
      // Mark purchase COMPLETED
      // -------------------------------------------------------

      await prisma.purchase.update({
        where: {
          id: purchaseId
        },
        data: {
          status: "COMPLETED",
          foundryItemId:
            foundryItemId || null
        }
      });

      /*
       * IMPORTANT:
       *
       * We do NOT modify stock here.
       *
       * Stock was already decremented atomically when the
       * purchase was originally created.
       *
       * We also do NOT deduct GP here.
       *
       * GP was already deducted when the purchase was created.
       *
       * This endpoint only confirms successful delivery.
       */

      // -------------------------------------------------------
      // Audit log
      // -------------------------------------------------------

      const context =
        createAuditContextFromRequest(request, {
          purchaseId,
          foundryActorId,
          foundryItemId:
            foundryItemId || null,
          itemId:
            purchase.itemId,
          itemName:
            purchase.itemName,
          priceGp:
            purchase.priceGp
        });

      await createAuditLog(
        world.dmUserId,
        "PURCHASE_COMPLETED",
        "Purchase",
        purchaseId,
        context
      );

      // Gold and stock updates are emitted by PostgreSQL triggers when the
      // underlying rows change. No manual realtime call is needed here.

      /*
       * IMPORTANT:
       *
       * We do NOT broadcast another "purchase" event here.
       *
       * The purchase event should be emitted when the purchase
       * is initially created, which tells Foundry to deliver it.
       *
       * This endpoint is Foundry confirming that delivery has
       * already happened.
       */

      // -------------------------------------------------------
      // Return success
      // -------------------------------------------------------

      const response = NextResponse.json({
        success: true,
        message: "Purchase confirmed",
        purchase: {
          id: purchaseId,
          status: "completed"
        }
      });

      addCorsHeaders(response, request);
      return response;
    }

    // =========================================================
    // UNKNOWN STATUS
    // =========================================================

    const response = NextResponse.json(
      {
        error: `Unknown status: ${status}`
      },
      { status: 400 }
    );

    addCorsHeaders(response, request);
    return response;

  } catch (error) {
    console.error(
      "Purchase handler error:",
      error
    );

    const response = NextResponse.json(
      {
        error:
          (error as Error).message ||
          "An error occurred"
      },
      { status: 500 }
    );

    addCorsHeaders(response, request);
    return response;
  }
}
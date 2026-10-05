import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  requireFullFoundryAuthorization
} from "@/lib/foundry/worldSecretMiddleware";
import {
  addFoundryCorsHeaders,
  foundryOptions
} from "@/lib/foundry/cors";
import {
  createAuditLog,
  createAuditContextFromRequest
} from "@/lib/audit";

export const runtime = "nodejs";

function response(
  body: Record<string, unknown>,
  status: number,
  request: Request
) {
  const result = NextResponse.json(body, { status });
  addFoundryCorsHeaders(result, request);
  return result;
}

export async function OPTIONS(request: Request) {
  return foundryOptions(request);
}

/**
 * POST /api/foundry/gold/bootstrap
 *
 * Establish the initial server-side gold baseline for a newly linked
 * Foundry Actor. A character with purchase history is never overwritten;
 * the existing Harkonians balance wins in that case.
 */
export async function POST(request: Request) {
  try {
    const auth =
      await requireFullFoundryAuthorization(request);

    let body: {
      foundryWorldId?: string;
      foundryActorId?: string;
      gold?: number;
    };

    try {
      body = await request.json();
    } catch {
      return response(
        { error: "Invalid JSON in request body." },
        400,
        request
      );
    }

    const foundryWorldId =
      typeof body?.foundryWorldId === "string"
        ? body.foundryWorldId.trim()
        : "";

    const foundryActorId =
      typeof body?.foundryActorId === "string"
        ? body.foundryActorId.trim()
        : "";

    const gold = body?.gold;

    if (
      !foundryWorldId ||
      !foundryActorId ||
      gold === undefined
    ) {
      return response(
        {
          error:
            "foundryWorldId, foundryActorId, and gold are required."
        },
        400,
        request
      );
    }

    if (
      typeof gold !== "number" ||
      !Number.isFinite(gold) ||
      !Number.isInteger(gold) ||
      gold < 0
    ) {
      return response(
        {
          error:
            "gold must be a non-negative whole number."
        },
        400,
        request
      );
    }

    if (
      auth.world.foundryWorldId !== foundryWorldId ||
      auth.character.foundryWorldId !== foundryWorldId ||
      auth.character.foundryActorId !== foundryActorId
    ) {
      return response(
        {
          error:
            "Character token does not match the supplied Foundry actor."
        },
        403,
        request
      );
    }

    const bootstrapResult =
      await prisma.$transaction(async (tx) => {
        // Lock the character row before checking purchase history. This makes
        // bootstrap and the purchase transaction serialize on the same row,
        // preventing a purchase from racing with an initial gold overwrite.
        await tx.$queryRaw`
          SELECT "id"
          FROM "Character"
          WHERE "id" = ${auth.character.id}
          FOR UPDATE
        `;

        const currentCharacter =
          await tx.character.findUnique({
            where: { id: auth.character.id },
            select: {
              id: true,
              name: true,
              creditBalance: true
            }
          });

        if (!currentCharacter) {
          throw new Error("Character no longer exists.");
        }

        const purchaseCount =
          await tx.purchase.count({
            where: {
              characterId: auth.character.id
            }
          });

        if (purchaseCount > 0) {
          return {
            character: currentCharacter,
            bootstrapped: false
          };
        }

        const character =
          await tx.character.update({
            where: {
              id: auth.character.id
            },
            data: {
              creditBalance: gold
            },
            select: {
              id: true,
              name: true,
              creditBalance: true
            }
          });

        return {
          character,
          bootstrapped: true
        };
      });

    const character = bootstrapResult.character;

    if (!bootstrapResult.bootstrapped) {
      return response(
        {
          success: true,
          bootstrapped: false,
          gold: character.creditBalance,
          message:
            "Existing Harkonians gold preserved because this character has purchase history."
        },
        200,
        request
      );
    }

    const oldBalance = auth.character.creditBalance;

    try {
      await createAuditLog(
        auth.world.dmUserId,
        "CREDIT_ADJUSTMENT",
        "Character",
        character.id,
        createAuditContextFromRequest(
          request,
          {
            foundryWorldId,
            foundryActorId,
            source: "foundry_bootstrap",
            oldBalance,
            newBalance: character.creditBalance
          }
        )
      );
    } catch (error) {
      console.error(
        "Foundry gold bootstrap succeeded but audit logging failed:",
        error
      );
    }

    return response(
      {
        success: true,
        bootstrapped: true,
        gold: character.creditBalance,
        characterId: character.id
      },
      200,
      request
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to bootstrap Foundry gold.";

    const status =
      message.startsWith("UNAUTHENTICATED")
        ? 401
        : message.startsWith("FORBIDDEN")
          ? 403
          : 500;

    return response(
      { error: message },
      status,
      request
    );
  }
}

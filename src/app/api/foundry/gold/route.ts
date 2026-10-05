import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  requireFullFoundryAuthorization
} from "@/lib/foundry/worldSecretMiddleware";
import {
  addFoundryCorsHeaders,
  foundryOptions
} from "@/lib/foundry/cors";

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
 * GET /api/foundry/gold?worldId=...&actorId=...
 *
 * Returns the authoritative Harkonians gold balance
 * for the currently authenticated Foundry Actor.
 */
export async function GET(request: Request) {
  try {
    const auth =
        await requireFullFoundryAuthorization(request);

    const { searchParams } =
        new URL(request.url);

    const worldId =
        searchParams.get("worldId")?.trim() ?? "";

    const actorId =
        searchParams.get("actorId")?.trim() ?? "";

    if (!worldId || !actorId) {
      return response(
          {
            error:
                "worldId and actorId query parameters are required."
          },
          400,
          request
      );
    }

    /*
     * The character bearer token, supplied world ID,
     * supplied actor ID, and world secret must all
     * point at the same linked character.
     */
    if (
        auth.world.foundryWorldId !== worldId ||
        auth.character.foundryWorldId !== worldId ||
        auth.character.foundryActorId !== actorId
    ) {
      return response(
          {
            error:
                "Character is not authorized for this actor and world."
          },
          403,
          request
      );
    }

    /*
     * Re-read the character from the database so that
     * the returned balance is the current authoritative
     * value rather than relying only on authorization data.
     */
    const character =
        await prisma.character.findUnique({
          where: {
            id: auth.character.id
          },
          select: {
            id: true,
            name: true,
            creditBalance: true,
            foundryWorldId: true,
            foundryActorId: true,
            katastroWorldId: true
          }
        });

    if (!character) {
      return response(
          {
            error: "Character not found."
          },
          404,
          request
      );
    }

    /*
     * Protect against the character being unlinked or
     * re-linked between authentication and this query.
     */
    if (
        character.foundryWorldId !== worldId ||
        character.foundryActorId !== actorId ||
        character.katastroWorldId !== auth.world.id
    ) {
      return response(
          {
            error:
                "Character is no longer linked to this Foundry actor."
          },
          403,
          request
      );
    }

    return response(
        {
          success: true,
          actorId: character.foundryActorId,
          characterId: character.id,
          characterName: character.name,
          gold: character.creditBalance
        },
        200,
        request
    );
  } catch (error) {
    console.error(
        "Get gold error:",
        error
    );

    const message =
        error instanceof Error
            ? error.message
            : "Failed to retrieve gold.";

    const status =
        message.startsWith("UNAUTHENTICATED")
            ? 401
            : message.startsWith("FORBIDDEN")
                ? 403
                : 500;

    return response(
        {
          error: message
        },
        status,
        request
    );
  }
}
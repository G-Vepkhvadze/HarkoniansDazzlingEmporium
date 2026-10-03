import { NextResponse } from "next/server";
import { requireFullFoundryAuthorization } from "@/lib/foundry/worldSecretMiddleware";
import { prisma } from "@/lib/prisma";
import { addFoundryCorsHeaders, foundryOptions } from "@/lib/foundry/cors";

export const runtime = "nodejs";

export async function OPTIONS(request: Request) {
  return foundryOptions(request);
}

/**
 * GET /api/foundry/state
 *
 * Durable reconciliation endpoint for the linked character. It returns
 * authoritative gold plus stock for every Harkonians item published from
 * this Foundry world.
 */
export async function GET(request: Request) {
  try {
    const auth =
      await requireFullFoundryAuthorization(request);

    const items =
      await prisma.item.findMany({
        where: {
          foundryItemData: {
            path: [
              "_harkoniansMetadata",
              "foundryWorldId"
            ],
            equals:
              auth.world.foundryWorldId
          }
        },
        select: {
          id: true,
          stock: true
        }
      });

    const response = NextResponse.json({
      success: true,
      characterId: auth.character.id,
      actorId: auth.character.foundryActorId,
      gold: auth.character.creditBalance,
      items
    });

    addFoundryCorsHeaders(response, request);
    return response;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to retrieve Foundry state.";

    const status =
      message.startsWith("UNAUTHENTICATED")
        ? 401
        : message.startsWith("FORBIDDEN")
          ? 403
          : 500;

    const response = NextResponse.json(
      { error: message },
      { status }
    );

    addFoundryCorsHeaders(response, request);
    return response;
  }
}

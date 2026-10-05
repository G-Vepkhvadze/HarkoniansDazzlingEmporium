import { NextResponse } from "next/server";
import { requireFullFoundryAuthorization } from "@/lib/foundry/worldSecretMiddleware";
import { prisma } from "@/lib/prisma";
import { addFoundryCorsHeaders, foundryOptions } from "@/lib/foundry/cors";
import { revokeAllCharacterTokens } from "@/lib/foundry/characterToken";

export const runtime = "nodejs";

export async function OPTIONS(request: Request) {
  return foundryOptions(request);
}

/**
 * DELETE /api/foundry/unlink
 *
 * Unlinks only the currently authenticated Foundry Actor from its Harkonians
 * character. The Harkonians character record, balance, and purchase history
 * remain intact so it can be linked again later. Its bearer token is revoked.
 */
export async function DELETE(request: Request) {
  try {
    const auth = await requireFullFoundryAuthorization(request);

    const body = await request.json().catch(() => ({}));
    const actorId =
      typeof body?.foundryActorId === "string"
        ? body.foundryActorId.trim()
        : auth.character.foundryActorId;

    if (actorId && actorId !== auth.character.foundryActorId) {
      const response = NextResponse.json(
        { error: "Actor does not match the authenticated Foundry character." },
        { status: 403 }
      );
      addFoundryCorsHeaders(response, request);
      return response;
    }

    await prisma.character.update({
      where: { id: auth.character.id },
      data: {
        foundryWorldId: null,
        foundryActorId: null,
        katastroWorldId: null
      }
    });

    await revokeAllCharacterTokens(auth.character.id);

    const response = NextResponse.json({
      success: true,
      message: "Foundry Actor unlinked successfully."
    });

    addFoundryCorsHeaders(response, request);
    return response;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to unlink Foundry Actor.";

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

import { NextResponse } from "next/server";
import { requireFullFoundryAuthorization } from "@/lib/foundry/worldSecretMiddleware";
import { prisma } from "@/lib/prisma";
import { createAuditLog, createAuditContextFromRequest } from "@/lib/audit";

export const runtime = 'nodejs';

/**
 * GET /api/foundry/character
 * Get the character information for the authenticated character token.
 * 
 * Requires:
 * - Valid character API token in Authorization header
 * - Valid world secret in x-foundry-world-secret header
 * 
 * Returns:
 * - 200 OK with character data if authenticated
 * - 401 Unauthorized if authentication fails
 * - 403 Forbidden if character doesn't belong to the world
 */
export async function GET(request: Request) {
  try {
    // Require full Foundry authorization
    const auth = await requireFullFoundryAuthorization(request);

    // Get the character with additional details
    const character = await prisma.character.findUnique({
      where: { id: auth.character.id },
      select: {
        id: true,
        userId: true,
        name: true,
        foundryWorldId: true,
        foundryActorId: true,
        creditBalance: true,
        katastroWorldId: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            username: true,
            role: true,
          },
        },
      },
    });

    if (!character) {
      const response = NextResponse.json(
        { error: "Character not found" },
        { status: 404 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Log the access
    const context = createAuditContextFromRequest(request, {
      characterId: character.id,
      characterName: character.name,
      foundryActorId: character.foundryActorId,
    });
    await createAuditLog(
      character.userId,
      "CHARACTER_ACCESS",
      "Character",
      character.id,
      context
    );

    // Return character data (excluding sensitive information)
    const response = NextResponse.json({
      character: {
        id: character.id,
        name: character.name,
        foundryWorldId: character.foundryWorldId,
        foundryActorId: character.foundryActorId,
        creditBalance: character.creditBalance,
        katastroWorldId: character.katastroWorldId,
        createdAt: character.createdAt,
        updatedAt: character.updatedAt,
      },
      user: {
        id: character.user.id,
        username: character.user.username,
        role: character.user.role,
      },
    });

    addCorsHeaders(response, request);
    return response;
  } catch (error) {
    console.error("Get character error:", error);
    const response = NextResponse.json(
      { error: (error as Error).message || "Authentication required" },
      { status: 401 }
    );
    addCorsHeaders(response, request);
    return response;
  }
}

/**
 * PATCH /api/foundry/character
 * Update character information.
 * 
 * Currently only allows updating the character name (not creditBalance).
 * 
 * Requires:
 * - Valid character API token in Authorization header
 * - Valid world secret in x-foundry-world-secret header
 * 
 * Request body:
 * - name?: string - New character name
 * 
 * Returns:
 * - 200 OK with updated character data on success
 * - 401 Unauthorized if authentication fails
 * - 403 Forbidden if trying to update protected fields
 * - 400 Bad Request on validation error
 */
export async function PATCH(request: Request) {
  try {
    // Require full Foundry authorization
    const auth = await requireFullFoundryAuthorization(request);

    let body: { name?: string } = {};
    try {
      const bodyText = await request.text();
      if (bodyText) {
        body = JSON.parse(bodyText);
      }
    } catch {
      // Empty or invalid JSON body
    }
    const { name } = body;

    // Validate - only allow name to be updated, NOT creditBalance
    const disallowedFields = ["creditBalance", "userId", "foundryWorldId", "foundryActorId", "katastroWorldId"];
    for (const field of disallowedFields) {
      if (field in body) {
        const response = NextResponse.json(
          { error: `Cannot update field: ${field}` },
          { status: 403 }
        );
        addCorsHeaders(response, request);
        return response;
      }
    }

    // Update the character
    const updates: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        const response = NextResponse.json(
          { error: "Character name must be a non-empty string" },
          { status: 400 }
        );
        addCorsHeaders(response, request);
        return response;
      }
      updates.name = name.trim();
    }

    const character = await prisma.character.update({
      where: { id: auth.character.id },
      data: updates,
      select: {
        id: true,
        name: true,
        foundryWorldId: true,
        foundryActorId: true,
        creditBalance: true,
        katastroWorldId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Log the update
    const context = createAuditContextFromRequest(request, {
      characterId: character.id,
      oldName: auth.character.name,
      newName: character.name,
    });
    await createAuditLog(
      auth.user.id,
      "CHARACTER_UPDATE",
      "Character",
      character.id,
      context
    );

    const response = NextResponse.json({
      character,
      message: "Character updated successfully",
    });

    addCorsHeaders(response, request);
    return response;
  } catch (error) {
    console.error("Update character error:", error);
    const response = NextResponse.json(
      { error: (error as Error).message || "An error occurred" },
      { status: 400 }
    );
    addCorsHeaders(response, request);
    return response;
  }
}

/**
 * Helper to add CORS headers to a response.
 */
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

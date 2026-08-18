import { NextResponse } from "next/server";
import { getWorldBySecret } from "@/lib/foundry/worldSecret";
import { prisma } from "@/lib/prisma";
import { createAuditLog, createAuditContextFromRequest } from "@/lib/audit";
import { broadcastGoldUpdate, getWebSocketServer } from "@/lib/websocket";

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
 * GET /api/foundry/gold?worldId=...&actorId=...
 * Get the current gold balance for a character from Harkonians.
 * 
 * Request query:
 * - worldId: Foundry world ID
 * - actorId: Foundry actor ID
 * 
 * Request headers:
 * - x-foundry-world-secret: World secret for authentication
 * 
 * Returns:
 * - 200 OK with gold balance
 * - 401 Unauthorized if authentication fails
 * - 404 Not Found if character not found
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const worldId = searchParams.get("worldId");
    const actorId = searchParams.get("actorId");

    if (!worldId || !actorId) {
      const response = NextResponse.json(
        { error: "worldId and actorId query parameters are required" },
        { status: 400 }
      );
      addCorsHeaders(response, request);
      return response;
    }

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
    if (!world || world.foundryWorldId !== worldId) {
      const response = NextResponse.json(
        { error: "Invalid world secret or world ID mismatch" },
        { status: 401 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Find character by Foundry actor ID
    const character = await prisma.character.findFirst({
      where: {
        foundryWorldId: worldId,
        foundryActorId: actorId,
        katastroWorldId: world.id
      },
      select: {
        id: true,
        creditBalance: true,
        name: true
      }
    });

    if (!character) {
      const response = NextResponse.json(
        { error: "Character not found for this world and actor" },
        { status: 404 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    const response = NextResponse.json({
      success: true,
      actorId: actorId,
      gold: character.creditBalance,
      characterName: character.name
    });

    addCorsHeaders(response, request);
    return response;
  } catch (error) {
    console.error("Get gold error:", error);
    const response = NextResponse.json(
      { error: (error as Error).message || "An error occurred" },
      { status: 500 }
    );
    addCorsHeaders(response, request);
    return response;
  }
}

/**
 * POST /api/foundry/gold/sync
 * Sync gold balance from Foundry to Harkonians.
 * 
 * Request headers:
 * - x-foundry-world-secret: World secret for authentication
 * 
 * Request body:
 * {
 *   "foundryWorldId": "...",
 *   "foundryActorId": "...",
 *   "gold": 100
 * }
 * 
 * Returns:
 * - 200 OK with synced gold balance
 * - 401 Unauthorized if authentication fails
 * - 404 Not Found if character not found
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
    let body: { foundryWorldId?: string; foundryActorId?: string; gold?: number } = {};
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

    const { foundryWorldId, foundryActorId, gold } = body;

    if (!foundryWorldId || !foundryActorId || gold === undefined) {
      const response = NextResponse.json(
        { error: "foundryWorldId, foundryActorId, and gold are required" },
        { status: 400 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Verify world ID matches
    if (world.foundryWorldId !== foundryWorldId) {
      const response = NextResponse.json(
        { error: "World secret does not match the specified Foundry world" },
        { status: 401 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Find or create character
    let character = await prisma.character.findFirst({
      where: {
        foundryWorldId: foundryWorldId,
        foundryActorId: foundryActorId,
        katastroWorldId: world.id
      }
    });

    if (!character) {
      // Character not yet linked, we'll still accept the sync
      // but won't store it until the character is properly linked
      const response = NextResponse.json({
        success: true,
        gold: gold,
        message: "Character not linked yet, gold will be synced when linked"
      });
      addCorsHeaders(response, request);
      return response;
    }

    // Update character gold
    character = await prisma.character.update({
      where: { id: character.id },
      data: { creditBalance: Math.max(0, gold) },
      select: {
        id: true,
        name: true,
        creditBalance: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        foundryWorldId: true,
        foundryActorId: true,
        katastroWorldId: true
      }
    });

    // Log the sync
    const context = createAuditContextFromRequest(request, {
      foundryWorldId,
      foundryActorId,
      oldBalance: character.creditBalance - (gold - (character.creditBalance - gold)),
      newBalance: character.creditBalance
    });
    await createAuditLog(
      world.dmUserId,
      "CREDIT_ADJUSTMENT",
      "Character",
      character.id,
      context
    );

    // Broadcast gold update to connected Foundry clients
    if (getWebSocketServer()) {
      broadcastGoldUpdate(world.foundryWorldId, foundryActorId, character.creditBalance);
    }

    const response = NextResponse.json({
      success: true,
      gold: character.creditBalance,
      message: "Gold synced successfully"
    });

    addCorsHeaders(response, request);
    return response;
  } catch (error) {
    console.error("Sync gold error:", error);
    const response = NextResponse.json(
      { error: (error as Error).message || "An error occurred" },
      { status: 500 }
    );
    addCorsHeaders(response, request);
    return response;
  }
}

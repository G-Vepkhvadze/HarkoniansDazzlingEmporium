import { NextResponse } from "next/server";
import { createLinkRequest } from "@/lib/foundry/linking";
import { getWorldBySecret } from "@/lib/foundry/worldSecret";
import { createAuditLog, createAuditContextFromRequest } from "@/lib/audit";

export const runtime = 'nodejs';

/**
 * POST /api/foundry/link
 * Create a new link request for character linking.
 * 
 * This is called by the Foundry module when a player wants to link their character.
 * 
 * Request body:
 * - foundryWorldId: string (required) - The Foundry world ID
 * - foundryActorId: string (required) - The Foundry Actor ID
 * 
 * Request headers:
 * - x-foundry-world-secret: string (required) - The world secret for authentication
 * 
 * Returns:
 * - 201 Created with requestId on success
 * - 400 Bad Request on missing fields
 * - 401 Unauthorized if world secret is invalid
 * - 409 Conflict if actor is already linked
 */
export async function POST(request: Request) {
  try {
    let body: { foundryWorldId?: string; foundryActorId?: string } = {};
    try {
      const bodyText = await request.text();
      if (bodyText) {
        body = JSON.parse(bodyText);
      }
    } catch {
      // Empty or invalid JSON body
    }
    const { foundryWorldId, foundryActorId } = body;

    // Validate required fields
    if (!foundryWorldId || !foundryActorId) {
      const response = NextResponse.json(
        { error: "foundryWorldId and foundryActorId are required" },
        { status: 400 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Validate the world secret
    const worldSecret = request.headers.get("x-foundry-world-secret");

    if (!worldSecret) {
      const response = NextResponse.json(
        { error: "World secret is required in x-foundry-world-secret header" },
        { status: 401 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Get the world by its secret
    const world = await getWorldBySecret(worldSecret);

    if (!world) {
      const response = NextResponse.json(
        { error: "Invalid world secret" },
        { status: 401 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Verify the foundryWorldId matches
    if (world.foundryWorldId !== foundryWorldId) {
      const response = NextResponse.json(
        { error: "World secret does not match the specified world" },
        { status: 401 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Create the link request
    const { requestId } = await createLinkRequest(
      foundryWorldId,
      foundryActorId,
      world.id
    );

    // Log the link request
    const context = createAuditContextFromRequest(request, {
      foundryWorldId,
      foundryActorId,
      worldId: world.id,
    });
    await createAuditLog(
      world.dmUserId,
      "LINK_REQUEST_CREATED",
      "LinkRequest",
      null,
      context
    );

    // Return the request ID for the Foundry module to use
    const response = NextResponse.json({
      requestId,
      message: "Link request created. Redirect user to browser for authentication.",
      expiresIn: 900, // 15 minutes in seconds
    }, { status: 201 });

    addCorsHeaders(response, request);
    return response;
  } catch (error) {
    console.error("Create link request error:", error);
    const response = NextResponse.json(
      { error: (error as Error).message || "An error occurred" },
      { status: 400 }
    );
    addCorsHeaders(response, request);
    return response;
  }
}

// GET requests to /api/foundry/link (without requestId) are not allowed
export async function GET(request: Request) {
  const response = NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
  addCorsHeaders(response, request);
  return response;
}

/**
 * Helper to add CORS headers to a response.
 */
function addCorsHeaders(response: NextResponse, request: Request): void {
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Origin", request.headers.get("origin") || "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-foundry-world-secret");
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(request: Request) {
  const response = new NextResponse(null, { status: 204 });
  addCorsHeaders(response, request);
  return response;
}

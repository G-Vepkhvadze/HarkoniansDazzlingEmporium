import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionByToken } from "@/lib/auth/session";
import { SESSION_COOKIE_CONFIG, requireDM } from "@/lib/auth/index";
import { createPairingCode, getPairingStatus } from "@/lib/foundry/pairing";
import { createAuditLog, createAuditContextFromRequest } from "@/lib/audit";

export const runtime = 'nodejs';

/**
 * GET /api/foundry/pair
 * Get the current pairing status for the Katastro world.
 * 
 * Returns:
 * - 200 OK with pairing status
 * - 401 Unauthorized if not authenticated as DM
 */
export async function GET(request: Request) {
  try {
    // Require DM authentication
    const dmUser = await requireDM();

    if (!dmUser) {
      const response = NextResponse.json(
        { error: "DM authentication required" },
        { status: 401 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Get pairing status
    const pairingStatus = await getPairingStatus();

    const response = NextResponse.json({
      isPaired: pairingStatus.isPaired,
      world: pairingStatus.world,
    });

    addCorsHeaders(response, request);
    return response;
  } catch (error) {
    console.error("Get pairing status error:", error);
    const response = NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
    addCorsHeaders(response, request);
    return response;
  }
}

/**
 * POST /api/foundry/pair
 * Create a new pairing code for the Katastro world.
 * 
 * Request body:
 * - katastroWorldId?: string (optional, for re-pairing)
 * 
 * Returns:
 * - 201 Created with pairing code on success
 * - 401 Unauthorized if not authenticated as DM
 * - 400 Bad Request on error
 */
export async function POST(request: Request) {
  try {
    // Require DM authentication
    const dmUser = await requireDM();

    if (!dmUser) {
      const response = NextResponse.json(
        { error: "DM authentication required" },
        { status: 401 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Get optional katastroWorldId from body
    let body: { katastroWorldId?: string } = {};
    try {
      const bodyText = await request.text();
      if (bodyText) {
        body = JSON.parse(bodyText);
      }
    } catch {
      // Empty or invalid JSON body - that's fine, we don't require it
    }
    const { katastroWorldId } = body;

    // Create a new pairing code
    const { code, requestId } = await createPairingCode(dmUser.id, katastroWorldId);

    // Create audit log
    const context = createAuditContextFromRequest(request, {
      requestId,
      hasWorldId: !!katastroWorldId,
    });
    await createAuditLog(
      dmUser.id,
      "PAIR_WORLD_INITIATED",
      "World",
      katastroWorldId || null,
      context
    );

    // Return the pairing code (this is the one-time display to the DM)
    const response = NextResponse.json({
      code,
      requestId,
      message: "Pairing code generated. Enter this code in your Foundry module.",
      expiresIn: 900, // 15 minutes in seconds
    }, { status: 201 });

    addCorsHeaders(response, request);
    return response;
  } catch (error) {
    console.error("Create pairing code error:", error);
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
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(request: Request) {
  const response = new NextResponse(null, { status: 204 });
  addCorsHeaders(response, request);
  return response;
}

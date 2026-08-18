import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionByToken } from "@/lib/auth/session";
import { SESSION_COOKIE_CONFIG } from "@/lib/auth/index";
import { prisma } from "@/lib/prisma";
import { createAuditLog, createAuditContextFromRequest } from "@/lib/audit";
import bcrypt from 'bcryptjs';

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
 * POST /api/foundry/user/link
 * Link a Harkonians user account to a Foundry world.
 * 
 * This is called by the Foundry module when a user wants to connect.
 * It creates a user API token that the module can use for subsequent requests.
 * 
 * Request body:
 * {
 *   "token": "..."  // Harkonians auth token from browser session
 * }
 * 
 * Request headers:
 * - x-foundry-world-secret: World secret for authentication
 * 
 * Returns:
 * - 201 Created with user API token on success
 * - 401 Unauthorized if authentication fails
 */
export async function POST(request: Request) {
  try {
    // Parse request body
    let body: { token?: string } = {};
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

    const { token } = body;

    if (!token) {
      const response = NextResponse.json(
        { error: "token is required" },
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

    // Get world by secret
    const { getWorldBySecret } = await import("@/lib/foundry/worldSecret");
    const world = await getWorldBySecret(worldSecret);
    
    if (!world) {
      const response = NextResponse.json(
        { error: "Invalid world secret" },
        { status: 401 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Find user by session token
    const session = await prisma.session.findFirst({
      where: {
        token: token
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            role: true
          }
        }
      }
    });

    if (!session || !session.user) {
      const response = NextResponse.json(
        { error: "Invalid or expired session token" },
        { status: 401 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Check if token is expired
    if (session.expiresAt < new Date()) {
      const response = NextResponse.json(
        { error: "Session token has expired" },
        { status: 401 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Generate a new character API token for Foundry module
    // This token will be used for subsequent authenticated requests
    const apiToken = crypto.randomUUID();
    const apiTokenHash = await bcrypt.hash(apiToken, 10);

    // Store the API token
    await prisma.characterApiToken.create({
      data: {
        tokenHash: apiTokenHash,
        characterId: session.user.id, // For now, link to user; will be updated when character is linked
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      }
    });

    // Log the connection
    const context = createAuditContextFromRequest(request, {
      userId: session.user.id,
      username: session.user.username,
      worldId: world.id
    });
    await createAuditLog(
      session.user.id,
      "FOUNDRY_USER_LINK",
      "User",
      session.user.id,
      context
    );

    const response = NextResponse.json({
      success: true,
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
      apiToken, // Return the raw token (only time it's sent)
      worldId: world.foundryWorldId,
      message: "Successfully linked to Harkonians"
    }, { status: 201 });

    addCorsHeaders(response, request);
    return response;
  } catch (error) {
    console.error("User link error:", error);
    const response = NextResponse.json(
      { error: (error as Error).message || "An error occurred" },
      { status: 500 }
    );
    addCorsHeaders(response, request);
    return response;
  }
}

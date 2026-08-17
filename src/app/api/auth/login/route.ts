import { NextResponse } from "next/server";
import { verifyCredentials } from "@/lib/auth/user";
import { createSession, SESSION_COOKIE_MAX_AGE } from "@/lib/auth/session";
import { SESSION_COOKIE_CONFIG } from "@/lib/auth/index";

export const runtime = 'nodejs';

/**
 * Login endpoint - handles POST requests for user authentication.
 * 
 * Request body should be JSON with:
 * - username: string
 * - password: string
 * 
 * Returns:
 * - 200 OK with user info on success
 * - 401 Unauthorized on invalid credentials
 * - 400 Bad Request on missing fields
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    // Validate required fields
    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    // Verify credentials
    const user = await verifyCredentials(username, password);

    if (!user) {
      // Generic error - don't reveal if username or password was wrong
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Create a new session
    const session = await createSession(user.id);

    // Create response with user info
    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });

    // Set the session cookie
    response.cookies.set({
      name: SESSION_COOKIE_CONFIG.name,
      value: session.token,
      maxAge: SESSION_COOKIE_MAX_AGE,
      httpOnly: SESSION_COOKIE_CONFIG.httpOnly,
      secure: SESSION_COOKIE_CONFIG.secure,
      sameSite: SESSION_COOKIE_CONFIG.sameSite,
      path: SESSION_COOKIE_CONFIG.path,
      domain: process.env.NODE_ENV === "development" ? undefined : ".harkonians.quest",
    });

    // Set CORS headers for development
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Origin", request.headers.get("origin") || "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An error occurred during login" },
      { status: 500 }
    );
  }
}

// GET requests not allowed
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(request: Request) {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Origin", request.headers.get("origin") || "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionByToken } from "@/lib/auth/session";
import { SESSION_COOKIE_CONFIG } from "@/lib/auth/index";

export const runtime = 'nodejs';

/**
 * Get current user endpoint - returns information about the authenticated user.
 * 
 * Returns:
 * - 200 OK with user info if authenticated
 * - 401 Unauthorized if not authenticated
 */
export async function GET(request: Request) {
  try {
    // Get the session token from cookies
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_CONFIG.name)?.value;

    // Create response early to set headers
    const response = new NextResponse();
    
    // Set CORS headers for development
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Origin", request.headers.get("origin") || "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (!sessionToken) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401, headers: response.headers }
      );
    }

    // Find the session and its user
    const session = await getSessionByToken(sessionToken);

    if (!session || !session.user) {
      // Clear the cookie if the session doesn't exist
      const errorResponse = NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
      errorResponse.cookies.set({
        name: SESSION_COOKIE_CONFIG.name,
        value: "",
        maxAge: 0,
        httpOnly: SESSION_COOKIE_CONFIG.httpOnly,
        secure: SESSION_COOKIE_CONFIG.secure,
        sameSite: SESSION_COOKIE_CONFIG.sameSite,
        path: SESSION_COOKIE_CONFIG.path,
      });
      // Copy CORS headers
      errorResponse.headers.set("Access-Control-Allow-Credentials", "true");
      errorResponse.headers.set("Access-Control-Allow-Origin", request.headers.get("origin") || "*");
      errorResponse.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      errorResponse.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      return errorResponse;
    }

    // Return user information with CORS headers
    const successResponse = NextResponse.json({
      user: {
        id: session.user.id,
        username: session.user.username,
        role: session.user.role,
      },
    });
    successResponse.headers.set("Access-Control-Allow-Credentials", "true");
    successResponse.headers.set("Access-Control-Allow-Origin", request.headers.get("origin") || "*");
    successResponse.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    successResponse.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return successResponse;
  } catch (error) {
    console.error("Get current user error:", error);
    const errorResponse = NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
    errorResponse.headers.set("Access-Control-Allow-Credentials", "true");
    errorResponse.headers.set("Access-Control-Allow-Origin", request.headers.get("origin") || "*");
    errorResponse.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    errorResponse.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return errorResponse;
  }
}

// POST requests not allowed
export async function POST() {
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

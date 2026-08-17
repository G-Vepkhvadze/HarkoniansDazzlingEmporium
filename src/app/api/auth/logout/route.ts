import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteSession } from "@/lib/auth/session";
import { SESSION_COOKIE_CONFIG } from "@/lib/auth/index";

export const runtime = 'nodejs';

/**
 * Logout endpoint - handles POST requests to end a user session.
 * 
 * Clears the session cookie and deletes the session from the database.
 * 
 * Returns:
 * - 200 OK on successful logout
 */
export async function POST(request: Request) {
  try {
    // Get the session token from cookies
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_CONFIG.name)?.value;

    // Delete the session from the database if it exists
    if (sessionToken) {
      await deleteSession(sessionToken);
    }

    // Create response
    const response = NextResponse.json({ message: "Logged out successfully" });

    // Clear the session cookie
    response.cookies.set({
      name: SESSION_COOKIE_CONFIG.name,
      value: "",
      maxAge: 0, // Expire immediately
      httpOnly: SESSION_COOKIE_CONFIG.httpOnly,
      secure: SESSION_COOKIE_CONFIG.secure,
      sameSite: SESSION_COOKIE_CONFIG.sameSite,
      path: SESSION_COOKIE_CONFIG.path,
    });

    // Set CORS headers for development
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Origin", request.headers.get("origin") || "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    // Even if there's an error, we should still clear the cookie
    const response = NextResponse.json(
      { error: "An error occurred during logout" },
      { status: 500 }
    );
    response.cookies.set({
      name: SESSION_COOKIE_CONFIG.name,
      value: "",
      maxAge: 0,
      httpOnly: SESSION_COOKIE_CONFIG.httpOnly,
      secure: SESSION_COOKIE_CONFIG.secure,
      sameSite: SESSION_COOKIE_CONFIG.sameSite,
      path: SESSION_COOKIE_CONFIG.path,
    });
    // Set CORS headers for development
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Origin", request.headers.get("origin") || "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return response;
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

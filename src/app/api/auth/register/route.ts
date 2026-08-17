import { NextResponse } from "next/server";
import { createUser, isUsernameAvailable } from "@/lib/auth/user";
import { createAuditLog, createAuditContextFromRequest } from "@/lib/audit";

export const runtime = 'nodejs';

/**
 * Registration endpoint - handles POST requests for new user registration.
 * 
 * Request body should be JSON with:
 * - username: string (unique, required)
 * - password: string (required, min length enforced by bcrypt)
 * 
 * Returns:
 * - 201 Created with user info on success
 * - 400 Bad Request on missing/invalid fields
 * - 409 Conflict if username is taken
 * - 400 Bad Request if password is too short
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

    // Validate username format
    if (typeof username !== "string" || username.trim().length === 0) {
      return NextResponse.json(
        { error: "Username must be a non-empty string" },
        { status: 400 }
      );
    }

    // Validate password format
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Check if username is available
    const isAvailable = await isUsernameAvailable(username);
    if (!isAvailable) {
      return NextResponse.json(
        { error: "Username is already taken" },
        { status: 409 }
      );
    }

    // Create the user
    const user = await createUser(username, password);

    // Create audit log entry for registration
    const context = createAuditContextFromRequest(request, {
      username,
    });
    await createAuditLog(
      user.id,
      "REGISTER",
      "User",
      user.id,
      context as Parameters<typeof createAuditLog>[4]
    );

    // Create response with user info
    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
        message: "Registration successful",
      },
      { status: 201 }
    );

    // Set CORS headers for development
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Origin", request.headers.get("origin") || "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    return response;
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "An error occurred during registration" },
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

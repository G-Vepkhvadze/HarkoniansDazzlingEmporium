import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionByToken } from "@/lib/auth/session";
import { SESSION_COOKIE_CONFIG } from "@/lib/auth/index";
import { prisma } from "@/lib/prisma";

export const runtime = 'nodejs';

/**
 * Get characters for the current authenticated user.
 * 
 * Returns:
 * - 200 OK with array of characters if authenticated
 * - 401 Unauthorized if not authenticated
 */
export async function GET(request: Request) {
  try {
    // Get the session token from cookies
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_CONFIG.name)?.value;

    if (!sessionToken) {
      const response = NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
      response.headers.set("Access-Control-Allow-Credentials", "true");
      response.headers.set("Access-Control-Allow-Origin", request.headers.get("origin") || "*");
      return response;
    }

    // Find the session and its user
    const session = await getSessionByToken(sessionToken);

    if (!session || !session.user) {
      const response = NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
      response.headers.set("Access-Control-Allow-Credentials", "true");
      response.headers.set("Access-Control-Allow-Origin", request.headers.get("origin") || "*");
      return response;
    }

    // Get all characters for this user
    const characters = await prisma.character.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        name: true,
        foundryWorldId: true,
        foundryActorId: true,
        creditBalance: true,
        katastroWorldId: true,
      },
      orderBy: { name: "asc" },
    });

    const response = NextResponse.json({
      characters,
    });

    // Set CORS headers
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Origin", request.headers.get("origin") || "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    return response;
  } catch (error) {
    console.error("Get characters error:", error);
    const response = NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Origin", request.headers.get("origin") || "*");
    return response;
  }
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

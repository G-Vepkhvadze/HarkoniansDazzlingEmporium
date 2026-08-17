import { NextResponse } from "next/server";
import { validateLinkRequest } from "@/lib/foundry/linking";

export const runtime = 'nodejs';

/**
 * GET /api/foundry/link/:requestId
 * Validate a link request.
 * 
 * This is used by the browser flow to verify the link request exists.
 * 
 * Returns:
 * - 200 OK with link request info if valid
 * - 404 Not Found if request is invalid/expired/used
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await context.params;

    if (!requestId) {
      const response = NextResponse.json(
        { error: "requestId is required" },
        { status: 400 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Validate the link request
    const linkRequest = await validateLinkRequest(requestId);

    if (!linkRequest) {
      const response = NextResponse.json(
        { error: "Invalid, expired, or already used link request" },
        { status: 404 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Return link request info (without sensitive data)
    const response = NextResponse.json({
      foundryWorldId: linkRequest.foundryWorldId,
      foundryActorId: linkRequest.foundryActorId,
      katastroWorldId: linkRequest.katastroWorldId,
      expiresAt: linkRequest.expiresAt,
      message: "Link request is valid.",
    });

    addCorsHeaders(response, request);
    return response;
  } catch (error) {
    console.error("Validate link request error:", error);
    const response = NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
    addCorsHeaders(response, request);
    return response;
  }
}

// POST requests to /api/foundry/link/:requestId are not allowed
export async function POST(request: Request) {
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

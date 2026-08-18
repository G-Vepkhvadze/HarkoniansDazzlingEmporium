import { NextResponse } from "next/server";

/**
 * GET /api/foundry/health
 * Health check endpoint for Foundry module to verify connection.
 * 
 * Returns:
 * - 200 OK with server status
 */
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

export async function GET(request: Request) {
  try {
    const response = NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      service: "HarkoniansDazzlingEmporium Foundry Integration"
    });

    addCorsHeaders(response, request);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      { error: (error as Error).message || "Internal server error" },
      { status: 500 }
    );
    addCorsHeaders(response, request);
    return response;
  }
}

import { NextRequest, NextResponse } from "next/server";

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
 * GET /api/foundry/ws
 * WebSocket endpoint for real-time sync with Foundry.
 * 
 * Note: This is a placeholder. For production WebSocket support in Next.js,
 * you need to either:
 * 1. Use a separate WebSocket server (recommended)
 * 2. Use Next.js experimental WebSocket support
 * 3. Use Server-Sent Events (SSE) as an alternative
 */
export function GET(request: Request) {
  const response = NextResponse.json(
    { 
      error: "WebSocket endpoint requires protocol upgrade",
      message: "Use wss://api.harkonians.quest/v1/foundry/ws for WebSocket connections"
    },
    { status: 426 }
  );
  addCorsHeaders(response, request);
  return response;
}

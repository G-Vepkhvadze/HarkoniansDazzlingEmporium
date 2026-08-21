import { NextResponse } from "next/server";
import { completeWorldPairing } from "@/lib/foundry/pairing";
import { addFoundryCorsHeaders, foundryOptions } from "@/lib/foundry/cors";

export const runtime = 'nodejs';

/**
 * Handle OPTIONS for CORS preflight
 */
export async function OPTIONS(request: Request) {
  return foundryOptions(request);
}

/**
 * POST /api/foundry/pair/confirm
 * 
 * Confirm world pairing by exchanging a pairing code for a world secret.
 * 
 * This endpoint is called by the Foundry module after the DM enters the pairing code.
 * 
 * Request body:
 * {
 *   "pairingCode": "...",
 *   "foundryWorldId": "..."
 * }
 * 
 * Returns:
 * - 200 OK with world data and worldSecret on success
 * - 400 Bad Request if pairing code or world ID is missing
 * - 400 Bad Request if pairing code is invalid/expired/used
 * - 500 Internal Server Error on unexpected errors
 */
export async function POST(request: Request) {
  try {
    // Parse request body
    let body: { pairingCode?: string; foundryWorldId?: string };
    
    try {
      const bodyText = await request.text();
      if (bodyText) {
        body = JSON.parse(bodyText);
      } else {
        body = {};
      }
    } catch {
      body = {};
    }
    
    const pairingCode = body?.pairingCode?.trim();
    const foundryWorldId = body?.foundryWorldId?.trim();
    
    if (!pairingCode) {
      const response = NextResponse.json(
        { error: "pairingCode is required" },
        { status: 400 }
      );
      addFoundryCorsHeaders(response, request);
      return response;
    }
    
    if (!foundryWorldId) {
      const response = NextResponse.json(
        { error: "foundryWorldId is required" },
        { status: 400 }
      );
      addFoundryCorsHeaders(response, request);
      return response;
    }
    
    // Complete the world pairing
    const result = await completeWorldPairing(pairingCode, foundryWorldId);
    
    if (!result.success) {
      const response = NextResponse.json(
        { error: result.error || "Pairing failed" },
        { status: 400 }
      );
      addFoundryCorsHeaders(response, request);
      return response;
    }
    
    // Return success with world data and the one-time world secret
    const response = NextResponse.json({
      success: true,
      world: result.world,
      worldSecret: result.worldSecret
    });
    addFoundryCorsHeaders(response, request);
    return response;
    
  } catch (error) {
    console.error("Pair confirm error:", error);
    const response = NextResponse.json(
      { error: (error as Error).message || "An error occurred during pairing" },
      { status: 500 }
    );
    addFoundryCorsHeaders(response, request);
    return response;
  }
}
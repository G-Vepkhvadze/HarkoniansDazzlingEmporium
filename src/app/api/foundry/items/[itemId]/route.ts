import { NextResponse } from "next/server";
import { getWorldBySecret, getKatastroWorldByFoundryId } from "@/lib/foundry/worldSecret";
import { createAuditLog, createAuditContextFromRequest } from "@/lib/audit";
import {
  validatePublishRequest,
  updateFoundryItem,
  itemExists,
  MAX_FOUNDRY_ITEM_DATA_SIZE,
  getHarkoniansMetadataString,
} from "@/lib/foundry/items";

/**
 * PUT /api/foundry/items/:itemId
 * 
 * Update an existing Foundry D&D 5e Item in the Harkonians store.
 * 
 * This endpoint:
 * - Validates the world secret
 * - Validates the Foundry world identity
 * - Validates the paired Harkonians campaign/world
 * - Validates the authenticated/authorized Harkonians DM
 * - Updates the Item record with new store metadata
 * - Updates the complete Foundry Item JSON in foundryItemData
 * - Updates the updatedAt timestamp
 * - Does NOT alter historical Purchase records
 * 
 * Request headers:
 * - x-foundry-world-secret: string (required) - The world secret for authentication
 * 
 * Request body:
 * {
 *   "foundryWorldId": "...",
 *   "foundryItemId": "...",
 *   "foundryItemUuid": "...",
 *   "foundrySystemId": "dnd5e",
 *   "foundrySystemVersion": "...", (optional)
 *   "name": "...",
 *   "description": "...", (optional)
 *   "rarity": "...", (optional)
 *   "type": "...",
 *   "image": "...", (optional)
 *   "priceCp": 500, (optional, default 0)
 *   "stock": 10, (optional, default 0)
 *   "deal": false, (optional, default false)
 *   "discountPercent": 0, (optional, default 0)
 *   "foundryItemData": { ... } (required - complete Foundry item definition)
 * }
 * 
 * Responses:
 * - 200 OK with updated item data on success
 * - 400 Bad Request on malformed payload
 * - 401 Unauthorized if world secret is invalid
 * - 403 Forbidden if DM is not authorized for this world
 * - 404 Not Found if item does not exist
 * - 413 Payload Too Large if foundryItemData exceeds size limit
 * - 500 Internal Server Error
 */
export const runtime = 'nodejs';

/**
 * Helper to add CORS headers to a response.
 */
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

// Only PUT is supported for this endpoint
export async function GET(request: Request) {
  const response = NextResponse.json(
    { error: "Method not allowed. Use PUT to update items." },
    { status: 405 }
  );
  addCorsHeaders(response, request);
  return response;
}

export async function POST(request: Request) {
  const response = NextResponse.json(
    { error: "Method not allowed. Use PUT to update items, POST /api/foundry/items/publish to create." },
    { status: 405 }
  );
  addCorsHeaders(response, request);
  return response;
}

export async function PATCH(request: Request) {
  const response = NextResponse.json(
    { error: "Method not allowed. Use PUT to update items." },
    { status: 405 }
  );
  addCorsHeaders(response, request);
  return response;
}

export async function DELETE(request: Request) {
  const response = NextResponse.json(
    { error: "Method not allowed." },
    { status: 405 }
  );
  addCorsHeaders(response, request);
  return response;
}

export async function PUT(request: Request, context: { params: Promise<{ itemId: string }> }) {
  try {
    const params = await context.params;
    const itemId = params.itemId;

    // =============================================
    // STEP 1: Validate item exists
    // =============================================
    if (!itemId) {
      const response = NextResponse.json(
        { error: "itemId is required in the URL" },
        { status: 400 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    const itemExistsResult = await itemExists(itemId);
    if (!itemExistsResult) {
      const response = NextResponse.json(
        { error: `Item with ID ${itemId} not found` },
        { status: 404 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // =============================================
    // STEP 2: Parse and validate the request body
    // =============================================
    let bodyText: string;
    try {
      bodyText = await request.text();
    } catch {
      const response = NextResponse.json(
        { error: "Failed to read request body" },
        { status: 400 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Check content length before parsing
    if (bodyText.length > MAX_FOUNDRY_ITEM_DATA_SIZE + 1024) {
      const response = NextResponse.json(
        { error: `Request body exceeds maximum size of ${MAX_FOUNDRY_ITEM_DATA_SIZE / (1024 * 1024)}MB` },
        { status: 413 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    let rawBody: unknown;
    try {
      rawBody = JSON.parse(bodyText);
    } catch {
      const response = NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Validate the payload
    const validation = validatePublishRequest(rawBody);
    if (!validation.valid) {
      const response = NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    const payload = validation.data;

    // =============================================
    // STEP 3: Validate world secret
    // =============================================
    const worldSecret = request.headers.get("x-foundry-world-secret");

    if (!worldSecret) {
      const response = NextResponse.json(
        { error: "World secret is required in x-foundry-world-secret header" },
        { status: 401 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Get the world by its secret
    const world = await getWorldBySecret(worldSecret);

    if (!world) {
      const response = NextResponse.json(
        { error: "Invalid world secret" },
        { status: 401 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Verify the foundryWorldId matches the world from the secret
    if (world.foundryWorldId !== payload.foundryWorldId) {
      const response = NextResponse.json(
        { error: "World secret does not match the specified Foundry world" },
        { status: 401 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // =============================================
    // STEP 4: Verify DM authorization
    // =============================================
    // Get the KatastroWorld to verify it exists and get DM info
    const katastroWorld = await getKatastroWorldByFoundryId(payload.foundryWorldId);

    if (!katastroWorld) {
      const response = NextResponse.json(
        { error: "No paired Harkonians world found for the specified Foundry world" },
        { status: 403 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Verify the DM user from the world matches
    if (world.dmUserId !== katastroWorld.dmUser.id) {
      const response = NextResponse.json(
        { error: "World secret does not match the paired world's DM" },
        { status: 403 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // =============================================
    // STEP 5: Verify the item belongs to this world
    // =============================================
    // Check if the existing item belongs to this world for additional security
    const { prisma } = await import('@/lib/prisma');
    const existingItem = await prisma.item.findUnique({
      where: { id: itemId },
      select: { foundryItemData: true },
    });

    if (existingItem && existingItem.foundryItemData) {
      const harkoniansWorldId = getHarkoniansMetadataString(existingItem.foundryItemData, 'harkoniansWorldId');
      if (harkoniansWorldId && harkoniansWorldId !== world.id) {
        const response = NextResponse.json(
          { error: "Item does not belong to this world" },
          { status: 403 }
        );
        addCorsHeaders(response, request);
        return response;
      }
    }

    // =============================================
    // STEP 6: Update the item
    // =============================================
    const result = await updateFoundryItem(
      itemId,
      payload,
      world.id,
      world.dmUserId
    );

    // =============================================
    // STEP 7: Audit logging
    // =============================================
    const auditContext = createAuditContextFromRequest(request, {
      foundryWorldId: payload.foundryWorldId,
      foundryItemId: payload.foundryItemId,
      foundryItemUuid: payload.foundryItemUuid,
      foundrySystemId: payload.foundrySystemId,
      foundrySystemVersion: payload.foundrySystemVersion ?? null,
      harkoniansWorldId: world.id,
      storeItemId: itemId,
    });

    // Use the DM user ID for the audit log
    await createAuditLog(
      world.dmUserId,
      "FOUNDRY_ITEM_UPDATE",
      "Item",
      itemId,
      auditContext
    );

    // =============================================
    // STEP 8: Return success response
    // =============================================
    // Return only the Store Item ID and basic info, not internal data
    const response = NextResponse.json(
      {
        success: true,
        item: {
          id: result.item.id,
          name: result.item.name,
          type: result.item.type,
          rarity: result.item.rarity,
          price: result.item.price,
          stock: result.item.stock,
        },
      },
      { status: 200 }
    );

    addCorsHeaders(response, request);
    return response;

  } catch (error) {
    // =============================================
    // ERROR HANDLING
    // =============================================
    console.error("Foundry item update error:", error);

    // Don't expose internal errors
    const status = error instanceof Error && error.message.includes('not found') ? 404 : 500;
    const response = NextResponse.json(
      { error: (error as Error).message || "An error occurred while updating the item" },
      { status: status >= 400 && status < 600 ? status : 500 }
    );

    addCorsHeaders(response, request);
    return response;
  }
}

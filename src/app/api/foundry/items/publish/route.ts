import { NextResponse } from "next/server";
import { getWorldBySecret, getKatastroWorldByFoundryId } from "@/lib/foundry/worldSecret";
import { createAuditLog, createAuditContextFromRequest } from "@/lib/audit";
import {
  validatePublishRequest,
  publishFoundryItem,
  MAX_FOUNDRY_ITEM_DATA_SIZE, getHarkoniansMetadata,
} from "@/lib/foundry/items";

/**
 * POST /api/foundry/items/publish
 * 
 * Publish a Foundry D&D 5e Item to the Harkonians store.
 * 
 * This endpoint:
 * - Validates the world secret
 * - Validates the Foundry world identity
 * - Validates the paired Harkonians campaign/world
 * - Validates the authenticated/authorized Harkonians DM
 * - Stores complete Foundry Item JSON in foundryItemData
 * - Creates a normal Harkonians Item record
 * - Returns the Store Item ID
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
 *   "priceGp": 500, (optional, default 0)
 *   "stock": 10, (optional, default 0)
 *   "deal": false, (optional, default false)
 *   "discountPercent": 0, (optional, default 0)
 *   "foundryItemData": { ... } (required - complete Foundry item definition)
 * }
 * 
 * Responses:
 * - 201 Created with item data on success
 * - 400 Bad Request on malformed payload
 * - 401 Unauthorized if world secret is invalid
 * - 403 Forbidden if DM is not authorized for this world
 * - 409 Conflict if item already exists (idempotency)
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

function stripHarkoniansMetadata(
  data: unknown
): Record<string, unknown> | null {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return null;
  }

  const clone = JSON.parse(
    JSON.stringify(data)
  ) as Record<string, unknown>;

  delete clone._harkoniansMetadata;

  return clone;
}

function sameFoundryItemData(
  existingData: unknown,
  incomingData: unknown
): boolean {
  const existing =
    stripHarkoniansMetadata(existingData);

  const incoming =
    stripHarkoniansMetadata(incomingData);

  if (!existing || !incoming) {
    return false;
  }

  return (
    JSON.stringify(existing) ===
    JSON.stringify(incoming)
  );
}


// Handle OPTIONS for CORS preflight
export async function OPTIONS(request: Request) {
  const response = new NextResponse(null, { status: 204 });
  addCorsHeaders(response, request);
  return response;
}

// Only POST is supported for this endpoint
export async function GET(request: Request) {
  const response = NextResponse.json(
    { error: "Method not allowed. Use POST to publish items." },
    { status: 405 }
  );
  addCorsHeaders(response, request);
  return response;
}

export async function PUT(request: Request) {
  const response = NextResponse.json(
    { error: "Method not allowed. Use POST to publish items, PUT /api/foundry/items/:itemId to update." },
    { status: 405 }
  );
  addCorsHeaders(response, request);
  return response;
}

export async function PATCH(request: Request) {
  const response = NextResponse.json(
    { error: "Method not allowed. Use POST to publish items, PUT /api/foundry/items/:itemId to update." },
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

export async function POST(request: Request) {
  try {
    // =============================================
    // STEP 1: Parse and validate the request body
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
    // STEP 2: Validate world secret
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
    // STEP 3: Verify DM authorization
    // =============================================
    // The world secret identifies a paired world, and we need to ensure
    // the DM who owns this world is the one making the request.
    // Since the world secret is the only authentication from Foundry,
    // we use the DM user ID from the world to authorize.
    // The world secret itself is sufficient proof that this request
    // originates from the paired Foundry module.

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
    // STEP 4: Check for existing item (idempotency)
    // =============================================
    // Check if an item with the same Foundry item UUID already exists
    // This provides idempotency for retrying the same publish operation
    const { prisma } = await import('@/lib/prisma');
    const existingItem =
        await prisma.item.findFirst({
          where: {
            foundryItemData: {
              path: [
                "_harkoniansMetadata",
                "foundryItemUuid"
              ],
              equals: payload.foundryItemUuid
            }
          }
        });

    if (existingItem) {
      const metadata =
          getHarkoniansMetadata(
              existingItem.foundryItemData
          );

      const sameWorld =
          metadata?.foundryWorldId ===
          payload.foundryWorldId;

      const sameFoundryItemId =
          metadata?.foundryItemId ===
          payload.foundryItemId;

      const sameName =
          existingItem.name ===
          payload.name;

      const sameJson =
          sameFoundryItemData(
              existingItem.foundryItemData,
              payload.foundryItemData
          );

      if (
          !sameWorld ||
          !sameFoundryItemId ||
          !sameName ||
          !sameJson
      ) {
        const response =
            NextResponse.json(
                {
                  error:
                      "A different Harkonians item already exists for this Foundry Item."
                },
                { status: 409 }
            );

        addCorsHeaders(
            response,
            request
        );

        return response;
      }

      /*
       * The exact same Foundry item already exists.
       * Add the newly submitted stock to the existing stock.
       *
       * -1 means unlimited and remains unlimited.
       */
      const additionalStock =
          payload.stock ?? 0;

      if (
          !Number.isInteger(additionalStock) ||
          additionalStock < 0
      ) {
        const response =
            NextResponse.json(
                {
                  error:
                      "Stock must be a non-negative integer."
                },
                { status: 400 }
            );

        addCorsHeaders(
            response,
            request
        );

        return response;
      }

      const newStock =
          existingItem.stock === -1
              ? -1
              : existingItem.stock +
              additionalStock;

      const updatedItem =
          await prisma.item.update({
            where: {
              id: existingItem.id
            },
            data: {
              stock: newStock
            },
            select: {
              id: true,
              name: true,
              type: true,
              rarity: true,
              price: true,
              stock: true
            }
          });

      const auditContext =
          createAuditContextFromRequest(
              request,
              {
                foundryWorldId:
                payload.foundryWorldId,
                foundryItemId:
                payload.foundryItemId,
                foundryItemUuid:
                payload.foundryItemUuid,
                storeItemId:
                updatedItem.id,
                addedStock:
                additionalStock,
                newStock:
                updatedItem.stock,
                republished: true
              }
          );

      await createAuditLog(
          world.dmUserId,
          "FOUNDRY_ITEM_REPUBLISHED",
          "Item",
          updatedItem.id,
          auditContext
      );

      const response =
          NextResponse.json(
              {
                success: true,
                item: {
                  id: updatedItem.id,
                  name: updatedItem.name,
                  type: updatedItem.type,
                  rarity: updatedItem.rarity,
                  price: updatedItem.price,
                  stock: updatedItem.stock
                },
                addedToExistingStock: true
              },
              { status: 200 }
          );

      addCorsHeaders(
          response,
          request
      );

      return response;
    }

    // =============================================
    // STEP 5: Publish the item
    // =============================================
    const result = await publishFoundryItem(
      payload,
      world.id,
      world.dmUserId
    );

    // =============================================
    // STEP 6: Audit logging
    // =============================================
    const auditContext = createAuditContextFromRequest(request, {
      foundryWorldId: payload.foundryWorldId,
      foundryItemId: payload.foundryItemId,
      foundryItemUuid: payload.foundryItemUuid,
      foundrySystemId: payload.foundrySystemId,
      foundrySystemVersion: payload.foundrySystemVersion ?? null,
      harkoniansWorldId: world.id,
      storeItemId: result.item.id,
    });

    // Use the DM user ID for the audit log
    await createAuditLog(
      world.dmUserId,
      "FOUNDRY_ITEM_PUBLISH",
      "Item",
      result.item.id,
      auditContext
    );

    // =============================================
    // STEP 7: Return success response
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
      { status: 201 }
    );

    addCorsHeaders(response, request);
    return response;

  } catch (error) {
    // =============================================
    // ERROR HANDLING
    // =============================================
    console.error("Foundry item publish error:", error);

    // Don't expose internal errors
    const status = error instanceof Error && error.message.includes('not found') ? 404 : 500;
    const response = NextResponse.json(
      { error: (error as Error).message || "An error occurred while publishing the item" },
      { status: status >= 400 && status < 600 ? status : 500 }
    );

    addCorsHeaders(response, request);
    return response;
  }
}

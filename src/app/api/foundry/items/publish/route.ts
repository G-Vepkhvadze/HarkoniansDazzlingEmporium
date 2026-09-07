import { NextResponse } from "next/server";
import {
  getWorldBySecret,
  getKatastroWorldByFoundryId
} from "@/lib/foundry/worldSecret";
import {
  createAuditLog,
  createAuditContextFromRequest
} from "@/lib/audit";
import {
  validatePublishRequest,
  publishFoundryItem,
  MAX_FOUNDRY_ITEM_DATA_SIZE,
  getHarkoniansMetadata
} from "@/lib/foundry/items";
import { prisma } from "@/lib/prisma";

function addCorsHeaders(
  response: NextResponse,
  request: Request
): void {
  response.headers.set(
    "Access-Control-Allow-Credentials",
    "true"
  );

  response.headers.set(
    "Access-Control-Allow-Origin",
    request.headers.get("origin") || "*"
  );

  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS"
  );

  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-foundry-world-secret"
  );
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

export async function OPTIONS(request: Request) {
  const response = new NextResponse(null, {
    status: 204
  });

  addCorsHeaders(response, request);

  return response;
}

export async function GET(request: Request) {
  const response = NextResponse.json(
    {
      error:
        "Method not allowed. Use POST to publish items."
    },
    { status: 405 }
  );

  addCorsHeaders(response, request);

  return response;
}

export async function PUT(request: Request) {
  const response = NextResponse.json(
    {
      error:
        "Method not allowed. Use POST to publish items, PUT /api/foundry/items/:itemId to update."
    },
    { status: 405 }
  );

  addCorsHeaders(response, request);

  return response;
}

export async function PATCH(request: Request) {
  const response = NextResponse.json(
    {
      error:
        "Method not allowed. Use POST to publish items, PUT /api/foundry/items/:itemId to update."
    },
    { status: 405 }
  );

  addCorsHeaders(response, request);

  return response;
}

export async function DELETE(request: Request) {
  const response = NextResponse.json(
    {
      error: "Method not allowed."
    },
    { status: 405 }
  );

  addCorsHeaders(response, request);

  return response;
}

export async function POST(request: Request) {
  try {
    // Parse request body
    let bodyText: string;

    try {
      bodyText = await request.text();
    } catch {
      const response = NextResponse.json(
        {
          error: "Failed to read request body"
        },
        { status: 400 }
      );

      addCorsHeaders(response, request);
      return response;
    }

    // Check request size before parsing
    if (
      bodyText.length >
      MAX_FOUNDRY_ITEM_DATA_SIZE + 1024
    ) {
      const response = NextResponse.json(
        {
          error: `Request body exceeds maximum size of ${
  MAX_FOUNDRY_ITEM_DATA_SIZE /
  (1024 * 1024)
}MB`
        },
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
        {
          error: "Invalid JSON in request body"
        },
        { status: 400 }
      );

      addCorsHeaders(response, request);
      return response;
    }

    const validation =
      validatePublishRequest(rawBody);

    if (!validation.valid) {
      const response = NextResponse.json(
        {
          error: validation.error
        },
        { status: 400 }
      );

      addCorsHeaders(response, request);
      return response;
    }

    const payload = validation.data;

    // ---------------------------------------------------------
    // Validate world secret
    // ---------------------------------------------------------

    const worldSecret =
      request.headers.get(
        "x-foundry-world-secret"
      );

    if (!worldSecret) {
      const response = NextResponse.json(
        {
          error:
            "World secret is required in x-foundry-world-secret header"
        },
        { status: 401 }
      );

      addCorsHeaders(response, request);
      return response;
    }

    const world =
      await getWorldBySecret(worldSecret);

    if (!world) {
      const response = NextResponse.json(
        {
          error: "Invalid world secret"
        },
        { status: 401 }
      );

      addCorsHeaders(response, request);
      return response;
    }

    if (
      world.foundryWorldId !==
      payload.foundryWorldId
    ) {
      const response = NextResponse.json(
        {
          error:
            "World secret does not match the specified Foundry world"
        },
        { status: 401 }
      );

      addCorsHeaders(response, request);
      return response;
    }

    // ---------------------------------------------------------
    // Validate paired Harkonians world / DM
    // ---------------------------------------------------------

    const katastroWorld =
      await getKatastroWorldByFoundryId(
        payload.foundryWorldId
      );

    if (!katastroWorld) {
      const response = NextResponse.json(
        {
          error:
            "No paired Harkonians world found for the specified Foundry world"
        },
        { status: 403 }
      );

      addCorsHeaders(response, request);
      return response;
    }

    if (
      world.dmUserId !==
      katastroWorld.dmUser.id
    ) {
      const response = NextResponse.json(
        {
          error:
            "World secret does not match the paired world's DM"
        },
        { status: 403 }
      );

      addCorsHeaders(response, request);
      return response;
    }

    // ---------------------------------------------------------
    // Check whether this exact Foundry item already exists
    // ---------------------------------------------------------

    const existingItem =
      await prisma.item.findFirst({
        where: {
          foundryItemData: {
            path: [
              "_harkoniansMetadata",
              "foundryItemUuid"
            ],
            equals:
              payload.foundryItemUuid
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

      // Same UUID but different actual item data:
      // reject rather than silently merging.
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

      // -------------------------------------------------------
      // Existing exact item: add stock
      // -------------------------------------------------------

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

      let updatedItem;

      if (existingItem.stock === -1) {
        // Already unlimited. Leave it unlimited.
        updatedItem =
          await prisma.item.findUnique({
            where: {
              id: existingItem.id
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
      } else {
        // Atomic increment prevents lost updates
        // when multiple publishes happen concurrently.
        updatedItem =
          await prisma.item.update({
            where: {
              id: existingItem.id
            },
            data: {
              stock: {
                increment:
                  additionalStock
              }
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
      }

      if (!updatedItem) {
        throw new Error(
          "Failed to retrieve the existing item after republishing."
        );
      }

      // -------------------------------------------------------
      // Audit
      // -------------------------------------------------------

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
            previousStock:
              existingItem.stock,
            addedStock:
              additionalStock,
            newStock:
              updatedItem.stock,
            republished: true
          }
        );

      await createAuditLog(
        world.dmUserId,
        "FOUNDRY_ITEM_PUBLISH",
        "Item",
        updatedItem.id,
        auditContext
      );

      // -------------------------------------------------------
      // Return existing item
      // -------------------------------------------------------

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

    // ---------------------------------------------------------
    // New item
    // ---------------------------------------------------------

    const result =
      await publishFoundryItem(
        payload,
        world.id,
        world.dmUserId
      );

    // ---------------------------------------------------------
    // Audit
    // ---------------------------------------------------------

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
          foundrySystemId:
            payload.foundrySystemId,
          foundrySystemVersion:
            payload.foundrySystemVersion ??
            null,
          harkoniansWorldId:
            world.id,
          storeItemId:
            result.item.id
        }
      );

    await createAuditLog(
      world.dmUserId,
      "FOUNDRY_ITEM_PUBLISH",
      "Item",
      result.item.id,
      auditContext
    );

    // ---------------------------------------------------------
    // Success
    // ---------------------------------------------------------

    const response =
      NextResponse.json(
        {
          success: true,
          item: {
            id: result.item.id,
            name: result.item.name,
            type: result.item.type,
            rarity: result.item.rarity,
            price: result.item.price,
            stock: result.item.stock
          }
        },
        { status: 201 }
      );

    addCorsHeaders(
      response,
      request
    );

    return response;

  } catch (error) {
    console.error(
      "Foundry item publish error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "An error occurred while publishing the item";

    const status =
      message.includes("not found")
        ? 404
        : 500;

    const response =
      NextResponse.json(
        {
          error: message
        },
        { status }
      );

    addCorsHeaders(
      response,
      request
    );

    return response;
  }
}

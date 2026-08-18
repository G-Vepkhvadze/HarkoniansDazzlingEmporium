import { NextResponse } from "next/server";
import { getWorldBySecret, getKatastroWorldByFoundryId } from "@/lib/foundry/worldSecret";
import { prisma } from "@/lib/prisma";
import { createAuditLog, createAuditContextFromRequest } from "@/lib/audit";

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
 * GET /api/foundry/items?worldId=...
 * Get all items published from a Foundry world.
 * 
 * Request query:
 * - worldId: Foundry world ID (required)
 * 
 * Request headers:
 * - x-foundry-world-secret: World secret for authentication
 * 
 * Returns:
 * - 200 OK with array of items
 * - 401 Unauthorized if authentication fails
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const worldId = searchParams.get("worldId");

    if (!worldId) {
      const response = NextResponse.json(
        { error: "worldId query parameter is required" },
        { status: 400 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Validate world secret
    const worldSecret = request.headers.get("x-foundry-world-secret");
    if (!worldSecret) {
      const response = NextResponse.json(
        { error: "World secret is required in x-foundry-world-secret header" },
        { status: 401 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    const world = await getWorldBySecret(worldSecret);
    if (!world || world.foundryWorldId !== worldId) {
      const response = NextResponse.json(
        { error: "Invalid world secret or world ID mismatch" },
        { status: 401 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Get all items for this world
    const items = await prisma.item.findMany({
      where: {
        foundryItemData: {
          path: ["_harkoniansMetadata", "foundryWorldId"],
          equals: worldId
        }
      },
      select: {
        id: true,
        name: true,
        type: true,
        rarity: true,
        price: true,
        stock: true,
        description: true,
        image: true,
        foundryItemData: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Map to simpler format
    const formattedItems = items.map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      rarity: item.rarity,
      price: item.price,
      stock: item.stock,
      description: item.description,
      img: item.image,
      foundryData: item.foundryItemData
    }));

    const response = NextResponse.json({
      success: true,
      worldId: worldId,
      items: formattedItems,
      count: formattedItems.length
    });

    addCorsHeaders(response, request);
    return response;
  } catch (error) {
    console.error("Get items error:", error);
    const response = NextResponse.json(
      { error: (error as Error).message || "An error occurred" },
      { status: 500 }
    );
    addCorsHeaders(response, request);
    return response;
  }
}

/**
 * POST /api/foundry/items
 * Create a new item from Foundry data.
 * This is a simpler endpoint than /publish for direct item creation.
 * 
 * Request headers:
 * - x-foundry-world-secret: World secret for authentication
 * 
 * Request body:
 * {
 *   "foundry": {
 *     "worldId": "...",
 *     "itemId": "...",
 *     "itemUuid": "..."
 *   },
 *   "item": {
 *     "name": "...",
 *     "type": "...",
 *     "img": "...",
 *     "system": { ... },
 *     "rarity"?: "...",
 *     "description"?: "...",
 *     "price"?: 100
 *   }
 * }
 * 
 * Returns:
 * - 201 Created with new item
 * - 401 Unauthorized if authentication fails
 */
export async function POST(request: Request) {
  try {
    // Validate world secret
    const worldSecret = request.headers.get("x-foundry-world-secret");
    if (!worldSecret) {
      const response = NextResponse.json(
        { error: "World secret is required in x-foundry-world-secret header" },
        { status: 401 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    const world = await getWorldBySecret(worldSecret);
    if (!world) {
      const response = NextResponse.json(
        { error: "Invalid world secret" },
        { status: 401 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Parse request body
    let body: {
      foundry?: {
        worldId?: string;
        itemId?: string;
        itemUuid?: string;
      };
      item?: {
        name?: string;
        type?: string;
        img?: string;
        system?: any;
        rarity?: string;
        description?: string;
        price?: number;
      };
    } = {};
    try {
      const bodyText = await request.text();
      if (bodyText) {
        body = JSON.parse(bodyText);
      }
    } catch {
      const response = NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    const { foundry, item: itemData } = body;

    if (!foundry?.worldId || !foundry.itemId || !itemData?.name) {
      const response = NextResponse.json(
        { error: "foundry.worldId, foundry.itemId, and item.name are required" },
        { status: 400 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Verify world ID matches
    if (world.foundryWorldId !== foundry.worldId) {
      const response = NextResponse.json(
        { error: "World secret does not match the specified Foundry world" },
        { status: 401 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Check if item already exists (idempotency by Foundry item UUID)
    if (foundry.itemUuid) {
      const existingItem = await prisma.item.findFirst({
        where: {
          foundryItemData: {
            path: ["_harkoniansMetadata", "foundryItemUuid"],
            equals: foundry.itemUuid
          }
        },
        select: { id: true }
      });

      if (existingItem) {
        const response = NextResponse.json({
          success: true,
          item: {
            id: existingItem.id,
            exists: true
          },
          message: "Item already exists"
        });
        addCorsHeaders(response, request);
        return response;
      }
    }

    // Create the item
    const newItem = await prisma.item.create({
      data: {
        name: itemData.name,
        type: itemData.type as any || 'WEAPON',
        description: itemData.description || '',
        rarity: itemData.rarity as any || 'COMMON',
        image: itemData.img || '',
        price: itemData.price || 0,
        stock: 0, // Start with 0 stock, DM can update
        foundryItemData: {
          _harkoniansMetadata: {
            foundryWorldId: foundry.worldId,
            foundryItemId: foundry.itemId,
            foundryItemUuid: foundry.itemUuid,
            createdAt: new Date().toISOString()
          },
          ...itemData.system
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

    // Log the creation
    const context = createAuditContextFromRequest(request, {
      foundryWorldId: foundry.worldId,
      foundryItemId: foundry.itemId,
      foundryItemUuid: foundry.itemUuid || null,
      itemId: newItem.id,
      itemName: newItem.name
    });
    await createAuditLog(
      world.dmUserId,
      "FOUNDRY_ITEM_CREATE",
      "Item",
      newItem.id,
      context
    );

    const response = NextResponse.json({
      success: true,
      item: newItem,
      message: "Item created successfully"
    }, { status: 201 });

    addCorsHeaders(response, request);
    return response;
  } catch (error) {
    console.error("Create item error:", error);
    const response = NextResponse.json(
      { error: (error as Error).message || "An error occurred" },
      { status: 500 }
    );
    addCorsHeaders(response, request);
    return response;
  }
}

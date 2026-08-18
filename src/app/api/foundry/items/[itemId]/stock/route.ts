import { NextResponse } from "next/server";
import { getWorldBySecret } from "@/lib/foundry/worldSecret";
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
 * PUT /api/foundry/items/:itemId/stock
 * Update the stock of an item.
 * 
 * Request headers:
 * - x-foundry-world-secret: World secret for authentication
 * 
 * Request body:
 * {
 *   "stock": 10
 * }
 * 
 * Returns:
 * - 200 OK with updated item
 * - 401 Unauthorized if authentication fails
 * - 404 Not Found if item not found
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;

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

    // Find the item
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        name: true,
        stock: true,
        foundryItemData: true
      }
    });

    if (!item) {
      const response = NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Verify this item belongs to this world
    const foundryWorldId = item.foundryItemData?._harkoniansMetadata?.foundryWorldId;
    if (foundryWorldId && foundryWorldId !== world.foundryWorldId) {
      const response = NextResponse.json(
        { error: "Item does not belong to this world" },
        { status: 403 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Parse request body
    let body: { stock?: number } = {};
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

    const { stock } = body;

    if (stock === undefined) {
      const response = NextResponse.json(
        { error: "stock is required" },
        { status: 400 }
      );
      addCorsHeaders(response, request);
      return response;
    }

    // Update the item stock
    const updatedItem = await prisma.item.update({
      where: { id: itemId },
      data: {
        stock: Math.max(0, stock)
      },
      select: {
        id: true,
        name: true,
        stock: true
      }
    });

    // Log the update
    const context = createAuditContextFromRequest(request, {
      itemId: item.id,
      oldStock: item.stock,
      newStock: updatedItem.stock
    });
    await createAuditLog(
      world.dmUserId,
      "ITEM_STOCK_UPDATE",
      "Item",
      item.id,
      context
    );

    const response = NextResponse.json({
      success: true,
      item: {
        id: updatedItem.id,
        name: updatedItem.name,
        stock: updatedItem.stock
      },
      message: "Stock updated successfully"
    });

    addCorsHeaders(response, request);
    return response;
  } catch (error) {
    console.error("Update stock error:", error);
    const response = NextResponse.json(
      { error: (error as Error).message || "An error occurred" },
      { status: 500 }
    );
    addCorsHeaders(response, request);
    return response;
  }
}

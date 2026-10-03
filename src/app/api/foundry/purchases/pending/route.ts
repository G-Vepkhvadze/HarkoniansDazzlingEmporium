import { NextResponse } from "next/server";
import { requireFullFoundryAuthorization } from "@/lib/foundry/worldSecretMiddleware";
import { prisma } from "@/lib/prisma";
import { addFoundryCorsHeaders, foundryOptions } from "@/lib/foundry/cors";

export const runtime = "nodejs";

export async function OPTIONS(request: Request) {
  return foundryOptions(request);
}

/**
 * GET /api/foundry/purchases/pending
 *
 * Returns PENDING purchases for the currently authenticated Foundry
 * character. This is the durable fallback for purchases whose Supabase
 * Realtime event was missed while Foundry was offline/disconnected.
 */
export async function GET(request: Request) {
  try {
    const auth =
      await requireFullFoundryAuthorization(request);

    const purchases =
      await prisma.purchase.findMany({
        where: {
          characterId: auth.character.id,
          status: "PENDING"
        },
        include: {
          item: true,
          character: true
        },
        orderBy: {
          createdAt: "asc"
        }
      });

    const payload = purchases.map((purchase) => ({
      purchaseId: purchase.id,
      actorId: purchase.character.foundryActorId,
      quantity: purchase.quantity,
      item: {
        id: purchase.item?.id ?? null,
        name: purchase.itemName,
        type: purchase.item?.type ?? "equipment",
        description: purchase.item?.description ?? "",
        rarity: purchase.item?.rarity ?? "COMMON",
        image: purchase.item?.image ?? "",
        foundryItemData:
          purchase.item?.foundryItemData ?? null
      }
    }));

    const response = NextResponse.json({
      success: true,
      purchases: payload
    });

    addFoundryCorsHeaders(response, request);
    return response;
  } catch (error) {
    console.error(
      "Foundry pending purchase sync failed:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to retrieve pending purchases.";

    const status =
      message.startsWith("UNAUTHENTICATED")
        ? 401
        : message.startsWith("FORBIDDEN")
          ? 403
          : 500;

    const response = NextResponse.json(
      { error: message },
      { status }
    );

    addFoundryCorsHeaders(response, request);
    return response;
  }
}

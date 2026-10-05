import { NextResponse } from "next/server";
import { getVaultItems, createVaultItem } from "@/lib/vault";
import { requireDM, unauthorizedResponse } from "@/lib/auth/routeProtection";

export const runtime = 'nodejs';

/**
 * GET /api/vault
 * Get all vault items with like counts
 * Public endpoint - anyone can view vault items
 */
export async function GET() {
  try {
    const items = await getVaultItems();
    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching vault items:", error);
    return NextResponse.json(
      { error: "Failed to fetch vault items" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vault
 * Create a new vault item
 * DM-only endpoint
 */
export async function POST(req: Request) {
  try {
    const user = await requireDM();
    if (!user) {
      return unauthorizedResponse("Unauthorized - DM access required");
    }

    const body = await req.json();
    const { image, artist, quote } = body;

    if (typeof image !== "string" || !image.trim() ||
        typeof artist !== "string" || !artist.trim() ||
        typeof quote !== "string" || !quote.trim()) {
      return NextResponse.json(
        { error: "Image, artist, and quote are required" },
        { status: 400 }
      );
    }

    const created = await createVaultItem({ image: image.trim(), artist: artist.trim(), quote: quote.trim() });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Error creating vault item:", error);
    return NextResponse.json(
      { error: "Failed to create vault item" },
      { status: 500 }
    );
  }
}

// PUT, DELETE, PATCH not supported at this level
export async function PUT() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Method not allowed - use /api/vault/[id] for deletion" },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}

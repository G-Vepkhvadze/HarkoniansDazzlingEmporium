import { NextResponse } from "next/server";
import { toggleVaultItemLike } from "@/lib/vault";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/routeProtection";

export const runtime = 'nodejs';

/**
 * POST /api/vault/like
 * Toggle like/unlike for a vault item
 * Requires authentication (any user can like/unlike)
 * Request body: { vaultItemId: string }
 */
export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    if (!user) {
      return unauthorizedResponse("Unauthorized - login required");
    }

    const body = await req.json();
    const { vaultItemId } = body;

    if (!vaultItemId) {
      return NextResponse.json(
        { error: "vaultItemId is required" },
        { status: 400 }
      );
    }

    // Toggle the like status
    const isNowLiked = await toggleVaultItemLike(vaultItemId, user.id);

    return NextResponse.json({
      success: true,
      isLiked: isNowLiked,
      vaultItemId,
    });
  } catch (error) {
    console.error("Error toggling vault item like:", error);
    return NextResponse.json(
      { error: "Failed to toggle like status" },
      { status: 500 }
    );
  }
}

// GET not supported
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}

// Other methods not supported
export async function PUT() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
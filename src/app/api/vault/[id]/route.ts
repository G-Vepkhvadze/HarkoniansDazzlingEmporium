import { NextResponse } from "next/server";
import { deleteVaultItem } from "@/lib/vault";
import { requireDM, unauthorizedResponse } from "@/lib/auth/routeProtection";

export const runtime = 'nodejs';

/**
 * DELETE /api/vault/[id]
 * Delete a vault item
 * DM-only endpoint
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireDM();
    if (!user) {
      return unauthorizedResponse("Unauthorized - DM access required");
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "Vault item ID is required" },
        { status: 400 }
      );
    }

    await deleteVaultItem(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting vault item:", error);
    return NextResponse.json(
      { error: "Failed to delete vault item" },
      { status: 500 }
    );
  }
}

// GET, POST, PUT, PATCH not supported at individual item level
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed - use /api/vault for getting items" },
    { status: 405 }
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "Method not allowed - use /api/vault for creating items" },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: "Method not allowed - vault items cannot be updated" },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: "Method not allowed - vault items cannot be updated" },
    { status: 405 }
  );
}
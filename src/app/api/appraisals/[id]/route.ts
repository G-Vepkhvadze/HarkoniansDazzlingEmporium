import { NextResponse } from "next/server";
import { requireDM, unauthorizedResponse } from "@/lib/auth/routeProtection";
import { deleteAppraisal } from "@/lib/appraisals";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireDM();
    if (!user) {
      return unauthorizedResponse("Unauthorized - DM access required");
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Appraisal ID is required" }, { status: 400 });
    }

    const deleted = await deleteAppraisal(id);
    if (!deleted) {
      return NextResponse.json({ error: "Appraisal not found" }, { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting appraisal:", error);
    return NextResponse.json({ error: "Failed to delete appraisal" }, { status: 500 });
  }
}

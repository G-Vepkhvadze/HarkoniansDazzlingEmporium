import { NextResponse } from "next/server";
import { requireDM, unauthorizedResponse } from "@/lib/auth/routeProtection";
import { createAppraisal, getAppraisals } from "@/lib/appraisals";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await getAppraisals());
  } catch (error) {
    console.error("Error fetching appraisals:", error);
    return NextResponse.json({ error: "Failed to fetch appraisals" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireDM();
    if (!user) {
      return unauthorizedResponse("Unauthorized - DM access required");
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Item name and description are required" }, { status: 400 });
    }

    const { itemName, itemDescription } = body as Record<string, unknown>;
    if (typeof itemName !== "string" || !itemName.trim() ||
        typeof itemDescription !== "string" || !itemDescription.trim()) {
      return NextResponse.json({ error: "Item name and description are required" }, { status: 400 });
    }

    const appraisal = await createAppraisal(itemName.trim(), itemDescription.trim());
    return NextResponse.json(appraisal, { status: 201 });
  } catch (error) {
    console.error("Error creating appraisal:", error);
    return NextResponse.json({ error: "Failed to create appraisal" }, { status: 500 });
  }
}

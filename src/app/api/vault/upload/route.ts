import { NextResponse } from "next/server";
import { getSupabase, VAULT_BUCKET } from "@/lib/supabase";
import { requireDM, unauthorizedResponse } from "@/lib/auth/routeProtection";

export const runtime = 'nodejs';

/**
 * POST /api/vault/upload
 * Upload an image for a vault item
 * DM-only endpoint
 * Form data: { file: File }
 * Returns: { path: string } - the storage path of the uploaded image
 * Note: Client should ensure image width <= 900px before upload
 */
export async function POST(req: Request) {
  try {
    const user = await requireDM();
    if (!user) {
      return unauthorizedResponse("Unauthorized - DM access required");
    }

    const form = await req.formData();
    const file = form.get("file") as unknown as File;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Read the file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get file extension
    const ext = file.name.includes(".")
      ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
      : ".png";

    // Generate filename
    const base = file.name.slice(0, file.name.lastIndexOf(".")) || "vault-item";
    const sluggedBase = base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const filename = `${sluggedBase || "vault-item"}-${Date.now()}${ext}`;
    const storagePath = `${VAULT_BUCKET}/${filename}`;

    const supabase = getSupabase();

    // Upload to Supabase storage
    const { error } = await supabase.storage
      .from(VAULT_BUCKET)
      .upload(filename, buffer, {
        contentType: file.type || "image/png",
        upsert: false,
      });

    if (error) {
      console.error("Supabase upload error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ path: storagePath });
  } catch (error) {
    console.error("Vault upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload vault image" },
      { status: 500 }
    );
  }
}

// Other methods not supported
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}

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
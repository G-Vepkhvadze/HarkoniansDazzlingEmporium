import { NextResponse } from "next/server";
import { getSupabase, ITEMS_BUCKET } from "@/lib/supabase";

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file") as unknown as File;
  if (!file) return new Response("No file", { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Sanitize the original filename and keep its extension
  const safeName = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const ext = safeName.includes(".") ? safeName.slice(safeName.lastIndexOf(".")) : ".png";
  const baseName = safeName.includes(".") ? safeName.slice(0, safeName.lastIndexOf(".")) : safeName;
  const filename = `${baseName}-${Date.now()}${ext}`;
  const storagePath = `${ITEMS_BUCKET}/${filename}`;

  const supabase = getSupabase();

  const { error } = await supabase.storage
    .from(ITEMS_BUCKET)
    .upload(filename, buffer, {
      contentType: file.type || "image/png",
      upsert: false,
    });

  if (error) {
    console.error("Supabase upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Store the storage path (e.g. "items/foo.png") in the DB
  return NextResponse.json({ path: storagePath });
}
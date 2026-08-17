import { NextResponse } from "next/server";
import { getSupabase, ITEMS_BUCKET } from "@/lib/supabase";
import { requireDM, unauthorizedResponse } from "@/lib/auth/routeProtection";

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const user = await requireDM();
  if (!user) {
    return unauthorizedResponse("Unauthorized - DM access required");
  }

  const form = await req.formData();
  const file = form.get("file") as unknown as File;
  if (!file) return new Response("No file", { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
    : ".png";

  const itemName = form.get("itemName");
  const hasItemName = typeof itemName === "string" && itemName.trim().length > 0;
  const rawBase = hasItemName
    ? (itemName as string).trim()
    : file.name.slice(0, file.name.lastIndexOf("."));

  const sluggedBase = rawBase
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const base = sluggedBase || "item";
  const filename = `${base}-${Date.now()}${ext}`;
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

  return NextResponse.json({ path: storagePath });
}
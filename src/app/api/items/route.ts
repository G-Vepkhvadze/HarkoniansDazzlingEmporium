import { NextResponse } from "next/server";
import { getItems, createItem, updateItem, deleteItem } from "@/lib/items";

export async function GET() {
  const items = await getItems();
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const body = await req.json();
  const created = await createItem(body);
  return NextResponse.json(created);
}

export async function PUT(req: Request) {
  const body = await req.json();
  // Support both single-item and batch (array) updates
  if (Array.isArray(body)) {
    const results = await Promise.all(
      body.map((item) => {
        const { id, ...rest } = item;
        if (!id) throw new Error("Missing id in batch update");
        return updateItem(id, rest);
      })
    );
    return NextResponse.json(results);
  }
  const { id, ...rest } = body;
  if (!id) return new Response("Missing id", { status: 400 });
  const updated = await updateItem(id, rest);
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });
  await deleteItem(id);
  return new Response(null, { status: 204 });
}
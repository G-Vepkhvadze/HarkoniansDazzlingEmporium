import { NextResponse } from "next/server";
import { getItems, createItem, updateItem, deleteItem } from "@/lib/items";
import { requireDM, unauthorizedResponse } from "@/lib/auth/routeProtection";
import { unstable_cache } from "next/cache";

export const runtime = 'nodejs';

// Cache items for 60 seconds to reduce database load
export const revalidate = 60;

// GET requests are public (for the marketplace)
export async function GET() {
  // Use unstable_cache for GET requests to avoid duplicate queries
  const getCachedItems = unstable_cache(
    async () => getItems(),
    ['items-all'],
    { revalidate: 60, tags: ['items'] }
  );
  
  const items = await getCachedItems();
  return NextResponse.json(items);
}

// POST, PUT, DELETE require DM authentication
export async function POST(req: Request) {
  const user = await requireDM();
  if (!user) {
    return unauthorizedResponse("Unauthorized - DM access required");
  }
  
  const body = await req.json();
  const created = await createItem(body);
  return NextResponse.json(created);
}

export async function PUT(req: Request) {
  const user = await requireDM();
  if (!user) {
    return unauthorizedResponse("Unauthorized - DM access required");
  }
  
  const body = await req.json();
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
  const user = await requireDM();
  if (!user) {
    return unauthorizedResponse("Unauthorized - DM access required");
  }
  
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });
  await deleteItem(id);
  return new Response(null, { status: 204 });
}
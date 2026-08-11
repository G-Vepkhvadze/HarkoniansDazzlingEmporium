import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get('file') as unknown as File;
  if (!file) return new Response('No file', { status: 400 });
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const filename = `${Date.now()}-${file.name}`;
  const publicDir = path.join(process.cwd(), 'public', 'ItemImages');
  await fs.mkdir(publicDir, { recursive: true });
  const dest = path.join(publicDir, filename);
  await fs.writeFile(dest, buffer);
  const publicPath = `/ItemImages/${filename}`;
  return NextResponse.json({ path: publicPath });
}

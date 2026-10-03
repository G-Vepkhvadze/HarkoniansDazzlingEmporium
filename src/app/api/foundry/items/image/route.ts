import { NextResponse } from "next/server";
import { getWorldBySecret } from "@/lib/foundry/worldSecret";
import { uploadMagicImage } from "@/lib/supabase/storage";
import { addFoundryCorsHeaders, foundryOptions } from "@/lib/foundry/cors";

export const runtime = "nodejs";

const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/webp",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/avif",
  "image/svg+xml",
]);

export async function OPTIONS(request: Request) {
  return foundryOptions(request);
}

/**
 * POST /api/foundry/items/image
 *
 * Receives a Foundry-local image as multipart/form-data and stores it in
 * the private server-side Supabase client under the public magic-image
 * bucket. The service-role key never leaves the server.
 */
export async function POST(request: Request) {
  try {
    const worldSecret =
      request.headers.get("x-foundry-world-secret");

    if (!worldSecret) {
      const response = NextResponse.json(
        { error: "World secret is required." },
        { status: 401 }
      );
      addFoundryCorsHeaders(response, request);
      return response;
    }

    const world = await getWorldBySecret(worldSecret);

    if (!world) {
      const response = NextResponse.json(
        { error: "Invalid world secret." },
        { status: 401 }
      );
      addFoundryCorsHeaders(response, request);
      return response;
    }

    const formData = await request.formData();
    const entry = formData.get("file");

    if (!(entry instanceof File)) {
      const response = NextResponse.json(
        { error: "A file field is required." },
        { status: 400 }
      );
      addFoundryCorsHeaders(response, request);
      return response;
    }

    if (entry.size <= 0) {
      const response = NextResponse.json(
        { error: "Image file is empty." },
        { status: 400 }
      );
      addFoundryCorsHeaders(response, request);
      return response;
    }

    if (entry.size > MAX_IMAGE_SIZE) {
      const response = NextResponse.json(
        {
          error:
            `Image exceeds the maximum size of ${MAX_IMAGE_SIZE / (1024 * 1024)}MB.`
        },
        { status: 413 }
      );
      addFoundryCorsHeaders(response, request);
      return response;
    }

    if (!ALLOWED_TYPES.has(entry.type)) {
      const response = NextResponse.json(
        {
          error:
            `Unsupported image type: ${entry.type || "unknown"}`
        },
        { status: 415 }
      );
      addFoundryCorsHeaders(response, request);
      return response;
    }

    const buffer =
      Buffer.from(await entry.arrayBuffer());

    const url = await uploadMagicImage(
      buffer,
      entry.name || "foundry-image",
      entry.type
    );

    const response = NextResponse.json({
      success: true,
      url,
      bucket: "magic-image",
    });

    addFoundryCorsHeaders(response, request);
    return response;
  } catch (error) {
    console.error(
      "Foundry image upload error:",
      error
    );

    const response = NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to upload Foundry image."
      },
      { status: 500 }
    );

    addFoundryCorsHeaders(response, request);
    return response;
  }
}

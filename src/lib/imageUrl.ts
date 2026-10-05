const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const MAGIC_IMAGE_BUCKET = "magic-image";

function toSupabasePublicUrl(storagePath: string): string {
  if (!supabaseUrl) return storagePath;
  const cleanPath = storagePath.replace(/^\/+/, "");

  if (cleanPath.startsWith(`${MAGIC_IMAGE_BUCKET}/`)) {
    return `${supabaseUrl}/storage/v1/object/public/${cleanPath}`;
  }

  if (cleanPath.startsWith("items/")) {
    return `${supabaseUrl}/storage/v1/object/public/${cleanPath}`;
  }

  // Foundry uploads live under magic-image/foundry/...
  return `${supabaseUrl}/storage/v1/object/public/${MAGIC_IMAGE_BUCKET}/${cleanPath}`;
}

export function getImageUrl(imagePath: string | null | undefined): string {
  if (!imagePath) return "";

  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }

  if (!supabaseUrl) {
    return imagePath;
  }

  if (imagePath.startsWith("/items/")) {
    return `${supabaseUrl}/storage/v1/object/public/items/${imagePath.slice("/items/".length)}`;
  }

  if (imagePath.startsWith("/magic-image/")) {
    return `${supabaseUrl}/storage/v1/object/public/magic-image/${imagePath.slice("/magic-image/".length)}`;
  }

  if (imagePath.startsWith("/")) {
    return imagePath;
  }

  return toSupabasePublicUrl(imagePath);
}

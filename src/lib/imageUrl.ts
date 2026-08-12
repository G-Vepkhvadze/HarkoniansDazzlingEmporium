const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

function toSupabasePublicUrl(storagePath: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${storagePath}`;
}

export function getImageUrl(imagePath: string | null | undefined): string {
  if (!imagePath) return "";

  // Already a full URL — return as-is
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }

  // Supabase storage path like "items/foo.png" (no leading slash)
  if (!imagePath.startsWith("/") && supabaseUrl) {
    return toSupabasePublicUrl(imagePath);
  }

  // Legacy public path like "/items/foo.png" → resolve to Supabase storage bucket "items"
  if (imagePath.startsWith("/items/") && supabaseUrl) {
    return toSupabasePublicUrl(imagePath.slice(1));
  }

  // Legacy local public path like "/ItemImages/foo.png" — keep as-is
  return imagePath;
}

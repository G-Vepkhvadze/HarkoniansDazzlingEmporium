const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

function toSupabasePublicUrl(storagePath: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${storagePath}`;
}

export function getImageUrl(imagePath: string | null | undefined): string {
  if (!imagePath) return "";

  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }

  if (!imagePath.startsWith("/") && supabaseUrl) {
    return toSupabasePublicUrl(imagePath);
  }

  if (imagePath.startsWith("/items/") && supabaseUrl) {
    return toSupabasePublicUrl(imagePath.slice(1));
  }

  return imagePath;
}

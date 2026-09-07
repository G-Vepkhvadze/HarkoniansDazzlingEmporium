import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
    process.env.SUPABASE_URL;

const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
    throw new Error(
        "SUPABASE_URL is not configured."
    );
}

if (!supabaseServiceRoleKey) {
    throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is not configured."
    );
}

const supabase = createClient(
    supabaseUrl,
    supabaseServiceRoleKey
);

const BUCKET = "magic-image";

export async function uploadMagicImage(
    buffer: Buffer,
    fileName: string,
    contentType: string
): Promise<string> {
    const safeFileName =
        fileName
            .replace(/[^a-zA-Z0-9._-]/g, "_")
            .replace(/^_+/, "");

    const path =
        `foundry/${crypto.randomUUID()}-${safeFileName}`;

    const { error } =
        await supabase.storage
            .from(BUCKET)
            .upload(
                path,
                buffer,
                {
                    contentType,
                    cacheControl: "31536000",
                    upsert: false
                }
            );

    if (error) {
        throw new Error(
            `Failed to upload image to Supabase Storage: ${error.message}`
        );
    }

    const {
        data
    } =
        supabase.storage
            .from(BUCKET)
            .getPublicUrl(path);

    return data.publicUrl;
}

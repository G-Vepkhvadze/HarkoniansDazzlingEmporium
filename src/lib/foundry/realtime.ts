import prisma from "@/lib/prisma";

interface FoundryBroadcastMessage {
    event: string;
    payload: unknown;
}

function getSupabaseConfig() {
    const url =
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        process.env.SUPABASE_URL;

    const secretKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SECRET_KEY;

    if (!url) {
        throw new Error(
            "SUPABASE_URL is not configured."
        );
    }

    if (!secretKey) {
        throw new Error(
            "SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is not configured."
        );
    }

    return {
        url:
            url.replace(/\/$/, ""),

        secretKey
    };
}

export async function broadcastToCharacter(
    characterId: string,
    message: FoundryBroadcastMessage
) {
    const {
        url,
        secretKey
    } =
        getSupabaseConfig();

    const topic =
        `foundry:character:${characterId}`;

    const endpoint =
        `${url}/realtime/v1/api/broadcast/${encodeURIComponent(
            topic
        )}/events/${encodeURIComponent(
            message.event
        )}?private=true`;

    const response =
        await fetch(
            endpoint,
            {
                method: "POST",

                headers: {
                    apikey:
                    secretKey,

                    Authorization:
                        `Bearer ${secretKey}`,

                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify(
                        message.payload
                    )
            }
        );

    if (!response.ok) {
        const body =
            await response.text();

        throw new Error(
            `Supabase Broadcast failed (${response.status}): ${body}`
        );
    }

    return true;
}
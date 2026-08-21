import crypto from "node:crypto";

interface FoundryRealtimeClaims {
    characterId: string;
    foundryWorldId: string;
}

function base64Url(
    input: Buffer | string
): string {
    return Buffer
        .from(input)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

function signHs256(
    data: string,
    secret: string
): string {
    return base64Url(
        crypto
            .createHmac(
                "sha256",
                secret
            )
            .update(data)
            .digest()
    );
}

export function createFoundryRealtimeToken({
                                               characterId,
                                               foundryWorldId
                                           }: FoundryRealtimeClaims): {
    token: string;
    expiresAt: number;
} {
    const secret =
        process.env.SUPABASE_JWT_SECRET;

    if (!secret) {
        throw new Error(
            "SUPABASE_JWT_SECRET is not configured."
        );
    }

    /*
     * Keep this intentionally short.
     *
     * Supabase Realtime will refresh authorization
     * when a new JWT is supplied via setAuth().
     */
    const expiresAt =
        Math.floor(
            Date.now() / 1000
        ) + 15 * 60;

    const header = {
        alg: "HS256",
        typ: "JWT"
    };

    /*
     * "sub" is the character ID because our
     * realtime.messages RLS policy uses it.
     */
    const payload = {
        sub: characterId,

        role: "authenticated",

        character_id:
        characterId,

        foundry_world_id:
        foundryWorldId,

        iss: "harkonians.quest",
        iat:
            Math.floor(
                Date.now() / 1000
            ),
        exp: expiresAt
    };

    const encodedHeader =
        base64Url(
            JSON.stringify(header)
        );

    const encodedPayload =
        base64Url(
            JSON.stringify(payload)
        );

    const unsigned =
        `${encodedHeader}.${encodedPayload}`;

    const signature =
        signHs256(
            unsigned,
            secret
        );

    return {
        token:
            `${unsigned}.${signature}`,

        expiresAt
    };
}
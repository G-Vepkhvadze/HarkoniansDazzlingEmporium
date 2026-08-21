import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
    SESSION_COOKIE_CONFIG,
    getSessionByToken
} from "@/lib/auth/index";

import {
    prisma
} from "@/lib/prisma";

import {
    validateLinkRequest
} from "@/lib/foundry/linking";

import {
    addFoundryCorsHeaders,
    foundryOptions
} from "@/lib/foundry/cors";

export const runtime = "nodejs";

// Handle OPTIONS for CORS preflight
export async function OPTIONS(
    request: Request
) {
    return foundryOptions(request);
}

export async function GET(
    request: Request
) {
    const url =
        new URL(request.url);

    const requestId =
        url.searchParams.get(
            "requestId"
        );

    if (!requestId) {
        const response = NextResponse.json(
            {
                error:
                    "requestId is required."
            },
            { status: 400 }
        );
        addFoundryCorsHeaders(response, request);
        return response;
    }

    const cookieStore =
        await cookies();

    const sessionToken =
        cookieStore.get(
            SESSION_COOKIE_CONFIG.name
        )?.value;

    const session =
        sessionToken
            ? await getSessionByToken(
                sessionToken
            )
            : null;

    if (!session) {
        const response = NextResponse.json(
            {
                error:
                    "Authentication required."
            },
            { status: 401 }
        );
        addFoundryCorsHeaders(response, request);
        return response;
    }

    const linkRequest =
        await validateLinkRequest(
            requestId
        );

    if (!linkRequest) {
        const response = NextResponse.json(
            {
                error:
                    "Invalid or expired link request."
            },
            { status: 400 }
        );
        addFoundryCorsHeaders(response, request);
        return response;
    }

    const characters =
        await prisma.character.findMany({
            where: {
                userId: session.user.id,
                katastroWorldId:
                linkRequest.katastroWorldId,
                foundryWorldId:
                linkRequest.foundryWorldId,

                /*
                 * Don't offer a character
                 * already bound to another actor.
                 */
                OR: [
                    {
                        foundryActorId: null
                    },
                    {
                        foundryActorId:
                        linkRequest.foundryActorId
                    }
                ]
            },

            select: {
                id: true,
                name: true,
                foundryWorldId: true,
                foundryActorId: true,
                katastroWorldId: true
            },

            orderBy: {
                name: "asc"
            }
        });

    const response = NextResponse.json({
        characters
    });
    addFoundryCorsHeaders(response, request);
    return response;
}
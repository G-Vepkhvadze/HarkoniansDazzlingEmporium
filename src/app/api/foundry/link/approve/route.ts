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

export async function POST(
    request: Request
) {
    const body =
        await request.json();

    const requestId =
        typeof body?.requestId === "string"
            ? body.requestId.trim()
            : "";

    const characterId =
        typeof body?.characterId === "string"
            ? body.characterId.trim()
            : "";

    if (
        !requestId ||
        !characterId
    ) {
        const response = NextResponse.json(
            {
                error:
                    "requestId and characterId are required."
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

    const character =
        await prisma.character.findFirst({
            where: {
                id: characterId,
                userId: session.user.id,
                katastroWorldId:
                linkRequest.katastroWorldId
            }
        });

    if (!character) {
        const response = NextResponse.json(
            {
                error:
                    "Character is not available for this link."
            },
            { status: 403 }
        );
        addFoundryCorsHeaders(response, request);
        return response;
    }

    /*
     * If the character is already assigned
     * to a different actor, don't overwrite it.
     */
    if (
        character.foundryActorId &&
        character.foundryActorId !==
        linkRequest.foundryActorId
    ) {
        const response = NextResponse.json(
            {
                error:
                    "This character is already linked to another Foundry Actor."
            },
            { status: 409 }
        );
        addFoundryCorsHeaders(response, request);
        return response;
    }

    await prisma.character.update({
        where: {
            id: character.id
        },

        data: {
            foundryWorldId:
            linkRequest.foundryWorldId,

            foundryActorId:
            linkRequest.foundryActorId,

            katastroWorldId:
            linkRequest.katastroWorldId
        }
    });

    await prisma.foundryLinkRequest.update({
        where: {
            id: linkRequest.id
        },

        data: {
            authorizedCharacter: {
                connect: {
                    id: character.id
                }
            },

            authorizedAt:
                new Date()
        }
    });

    const response = NextResponse.json({
        success: true
    });
    addFoundryCorsHeaders(response, request);
    return response;
}
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

export const runtime = "nodejs";

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
        return NextResponse.json(
            {
                error:
                    "requestId and characterId are required."
            },
            { status: 400 }
        );
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
        return NextResponse.json(
            {
                error:
                    "Authentication required."
            },
            { status: 401 }
        );
    }

    const linkRequest =
        await validateLinkRequest(
            requestId
        );

    if (!linkRequest) {
        return NextResponse.json(
            {
                error:
                    "Invalid or expired link request."
            },
            { status: 400 }
        );
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
        return NextResponse.json(
            {
                error:
                    "Character is not available for this link."
            },
            { status: 403 }
        );
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
        return NextResponse.json(
            {
                error:
                    "This character is already linked to another Foundry Actor."
            },
            { status: 409 }
        );
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
            authorizedCharacterId:
            character.id,

            authorizedAt:
                new Date()
        }
    });

    return NextResponse.json({
        success: true
    });
}
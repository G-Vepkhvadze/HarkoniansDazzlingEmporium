import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import {
    getWorldBySecret
} from "@/lib/foundry/worldSecret";

import {
    createCharacterToken
} from "@/lib/foundry/characterToken";

import {
    validateLinkRequest
} from "@/lib/foundry/linking";

import {
    addFoundryCorsHeaders
} from "@/lib/foundry/cors";

export const runtime = "nodejs";

export async function OPTIONS(
    request: Request
) {
    const response =
        new NextResponse(null, {
            status: 204
        });

    addFoundryCorsHeaders(
        response,
        request
    );

    return response;
}

export async function POST(
    request: Request
) {
    try {
        const body =
            await request.json();

        const requestId =
            typeof body?.requestId === "string"
                ? body.requestId.trim()
                : "";

        const foundryWorldId =
            typeof body?.foundryWorldId === "string"
                ? body.foundryWorldId.trim()
                : "";

        const worldSecret =
            request.headers.get(
                "x-foundry-world-secret"
            );

        if (
            !requestId ||
            !foundryWorldId
        ) {
            const response =
                NextResponse.json(
                    {
                        error:
                            "requestId and foundryWorldId are required."
                    },
                    { status: 400 }
                );

            addFoundryCorsHeaders(
                response,
                request
            );

            return response;
        }

        if (!worldSecret) {
            const response =
                NextResponse.json(
                    {
                        error:
                            "World secret is required."
                    },
                    { status: 401 }
                );

            addFoundryCorsHeaders(
                response,
                request
            );

            return response;
        }

        const world =
            await getWorldBySecret(
                worldSecret
            );

        if (!world) {
            const response =
                NextResponse.json(
                    {
                        error:
                            "Invalid world secret."
                    },
                    { status: 401 }
                );

            addFoundryCorsHeaders(
                response,
                request
            );

            return response;
        }

        if (
            world.foundryWorldId !==
            foundryWorldId
        ) {
            const response =
                NextResponse.json(
                    {
                        error:
                            "Foundry world does not match paired world."
                    },
                    { status: 403 }
                );

            addFoundryCorsHeaders(
                response,
                request
            );

            return response;
        }

        const linkRequest =
            await validateLinkRequest(
                requestId
            );

        if (!linkRequest) {
            const response =
                NextResponse.json(
                    {
                        error:
                            "Invalid, expired, or already used link request."
                    },
                    { status: 400 }
                );

            addFoundryCorsHeaders(
                response,
                request
            );

            return response;
        }

        if (
            linkRequest.foundryWorldId !==
            foundryWorldId
        ) {
            const response =
                NextResponse.json(
                    {
                        error:
                            "Link request belongs to another Foundry world."
                    },
                    { status: 403 }
                );

            addFoundryCorsHeaders(
                response,
                request
            );

            return response;
        }

        const requestRecord =
            await prisma.foundryLinkRequest.findUnique({
                where: {
                    id: linkRequest.id
                },
                select: {
                    authorizedCharacterId: true
                }
            });

        if (
            !requestRecord?.authorizedCharacterId
        ) {
            const response =
                NextResponse.json(
                    {
                        error:
                            "Character has not approved this link yet."
                    },
                    { status: 409 }
                );

            addFoundryCorsHeaders(
                response,
                request
            );

            return response;
        }

        const character =
            await prisma.character.findUnique({
                where: {
                    id:
                    requestRecord.authorizedCharacterId
                },
                select: {
                    id: true,
                    name: true,
                    userId: true,
                    foundryWorldId: true,
                    foundryActorId: true,
                    katastroWorldId: true
                }
            });

        if (!character) {
            throw new Error(
                "Authorized character no longer exists."
            );
        }

        if (
            character.foundryWorldId !==
            foundryWorldId ||
            character.foundryActorId !==
            linkRequest.foundryActorId ||
            character.katastroWorldId !==
            world.id
        ) {
            const response =
                NextResponse.json(
                    {
                        error:
                            "Character authorization does not match this Foundry actor."
                    },
                    { status: 403 }
                );

            addFoundryCorsHeaders(
                response,
                request
            );

            return response;
        }

        const characterToken =
            await createCharacterToken(
                character.id
            );

        await prisma.foundryLinkRequest.update({
            where: {
                id: linkRequest.id
            },
            data: {
                used: true
            }
        });

        const response =
            NextResponse.json(
                {
                    success: true,

                    character: {
                        id: character.id,
                        name: character.name
                    },

                    characterId:
                    character.id,

                    characterToken,

                    foundryActorId:
                    character.foundryActorId
                }
            );

        addFoundryCorsHeaders(
            response,
            request
        );

        return response;

    } catch (error) {
        console.error(
            "Harkonians | Actor link exchange failed",
            error
        );

        const response =
            NextResponse.json(
                {
                    error:
                        error instanceof Error
                            ? error.message
                            : "Actor link exchange failed."
                },
                { status: 500 }
            );

        addFoundryCorsHeaders(
            response,
            request
        );

        return response;
    }
}
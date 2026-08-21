import { NextResponse } from "next/server";

import {
    validateCharacterToken
} from "@/lib/foundry/characterToken";

import {
    getWorldBySecret
} from "@/lib/foundry/worldSecret";

import {
    createFoundryRealtimeToken
} from "@/lib/foundry/realtimeToken";

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

export async function GET(
    request: Request
) {
    try {
        const worldSecret =
            request.headers.get(
                "x-foundry-world-secret"
            );

        const authorization =
            request.headers.get(
                "authorization"
            );

        if (!worldSecret) {
            const response =
                NextResponse.json(
                    {
                        error:
                            "World secret is required."
                    },
                    {
                        status: 401
                    }
                );

            addFoundryCorsHeaders(
                response,
                request
            );

            return response;
        }

        if (!authorization?.startsWith(
            "Bearer "
        )) {
            const response =
                NextResponse.json(
                    {
                        error:
                            "Character token is required."
                    },
                    {
                        status: 401
                    }
                );

            addFoundryCorsHeaders(
                response,
                request
            );

            return response;
        }

        const characterToken =
            authorization.slice(
                "Bearer ".length
            );

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
                    {
                        status: 401
                    }
                );

            addFoundryCorsHeaders(
                response,
                request
            );

            return response;
        }

        const tokenData = await validateCharacterToken(characterToken);
        
        if (!tokenData) {
            const response =
                NextResponse.json(
                    {
                        error:
                            "Invalid or expired character token."
                    },
                    {
                        status: 401
                    }
                );

            addFoundryCorsHeaders(
                response,
                request
            );

            return response;
        }

        const character = tokenData.character;

        if (!character) {
            const response =
                NextResponse.json(
                    {
                        error:
                            "Invalid or expired character token."
                    },
                    {
                        status: 401
                    }
                );

            addFoundryCorsHeaders(
                response,
                request
            );

            return response;
        }

        if (
            character.katastroWorldId !==
            world.id
        ) {
            const response =
                NextResponse.json(
                    {
                        error:
                            "Character does not belong to this Foundry world."
                    },
                    {
                        status: 403
                    }
                );

            addFoundryCorsHeaders(
                response,
                request
            );

            return response;
        }

        if (
            character.foundryWorldId !==
            world.foundryWorldId
        ) {
            const response =
                NextResponse.json(
                    {
                        error:
                            "Character is linked to another Foundry world."
                    },
                    {
                        status: 403
                    }
                );

            addFoundryCorsHeaders(
                response,
                request
            );

            return response;
        }

        if (
            !character.foundryActorId
        ) {
            const response =
                NextResponse.json(
                    {
                        error:
                            "Character is not linked to a Foundry Actor."
                    },
                    {
                        status: 409
                    }
                );

            addFoundryCorsHeaders(
                response,
                request
            );

            return response;
        }

        const realtime =
            createFoundryRealtimeToken({
                characterId:
                character.id,

                foundryWorldId:
                character.foundryWorldId
            });

        const response =
            NextResponse.json({
                success: true,

                token:
                realtime.token,

                expiresAt:
                realtime.expiresAt,

                characterId:
                character.id,

                foundryActorId:
                character.foundryActorId
            });

        addFoundryCorsHeaders(
            response,
            request
        );

        return response;

    } catch (error) {
        console.error(
            "Harkonians | Realtime token generation failed",
            error
        );

        const response =
            NextResponse.json(
                {
                    error:
                        error instanceof Error
                            ? error.message
                            : "Failed to create realtime token."
                },
                {
                    status: 500
                }
            );

        addFoundryCorsHeaders(
            response,
            request
        );

        return response;
    }
}
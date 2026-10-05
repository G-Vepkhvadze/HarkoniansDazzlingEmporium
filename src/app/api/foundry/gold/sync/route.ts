import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import {
    requireFullFoundryAuthorization
} from "@/lib/foundry/worldSecretMiddleware";

import {
    addFoundryCorsHeaders,
    foundryOptions
} from "@/lib/foundry/cors";

import {
    createAuditLog,
    createAuditContextFromRequest
} from "@/lib/audit";

export const runtime = "nodejs";

type SyncGoldBody = {
    foundryWorldId?: string;
    foundryActorId?: string;
    gold?: number;
    expectedGold?: number;
};

function response(
    body: Record<string, unknown>,
    status: number,
    request: Request
) {
    const result =
        NextResponse.json(body, { status });

    addFoundryCorsHeaders(
        result,
        request
    );

    return result;
}

export async function OPTIONS(request: Request) {
    return foundryOptions(request);
}

/**
 * POST /api/foundry/gold/sync
 *
 * Synchronizes Foundry gold with Harkonians.
 *
 * expectedGold is the balance Foundry believes
 * Harkonians currently has.
 *
 * If Harkonians has changed since that baseline
 * (for example because a purchase deducted gold),
 * this endpoint returns 409 with the authoritative
 * server balance instead of overwriting it.
 */
export async function POST(request: Request) {
    try {
        const auth =
            await requireFullFoundryAuthorization(
                request
            );

        let body: SyncGoldBody;

        try {
            const parsed =
                await request.json();

            if (
                !parsed ||
                typeof parsed !== "object" ||
                Array.isArray(parsed)
            ) {
                return response(
                    {
                        error:
                            "Request body must be a JSON object."
                    },
                    400,
                    request
                );
            }

            body = parsed as SyncGoldBody;
        } catch {
            return response(
                {
                    error:
                        "Invalid JSON in request body."
                },
                400,
                request
            );
        }

        const foundryWorldId =
            typeof body.foundryWorldId === "string"
                ? body.foundryWorldId.trim()
                : "";

        const foundryActorId =
            typeof body.foundryActorId === "string"
                ? body.foundryActorId.trim()
                : "";

        const gold =
            body.gold;

        const expectedGold =
            body.expectedGold;

        /*
         * Validate required IDs.
         */
        if (
            !foundryWorldId ||
            !foundryActorId
        ) {
            return response(
                {
                    error:
                        "foundryWorldId and foundryActorId are required."
                },
                400,
                request
            );
        }

        /*
         * Validate incoming Foundry gold.
         */
        if (
            typeof gold !== "number" ||
            !Number.isFinite(gold) ||
            !Number.isInteger(gold) ||
            gold < 0
        ) {
            return response(
                {
                    error:
                        "gold must be a non-negative whole number."
                },
                400,
                request
            );
        }

        /*
         * Normal syncs MUST contain a known server baseline.
         *
         * Initial gold setup belongs to /gold/bootstrap.
         */
        if (
            typeof expectedGold !== "number" ||
            !Number.isFinite(expectedGold) ||
            !Number.isInteger(expectedGold) ||
            expectedGold < 0
        ) {
            return response(
                {
                    error:
                        "expectedGold must be a non-negative whole number."
                },
                400,
                request
            );
        }

        /*
         * Make sure the authenticated character really is
         * the Foundry actor/world supplied in the request.
         */
        if (
            auth.world.foundryWorldId !==
            foundryWorldId ||

            auth.character.foundryWorldId !==
            foundryWorldId ||

            auth.character.foundryActorId !==
            foundryActorId ||

            auth.character.katastroWorldId !==
            auth.world.id
        ) {
            return response(
                {
                    error:
                        "Character token does not match the supplied Foundry actor."
                },
                403,
                request
            );
        }

        /*
         * Read the authoritative current balance.
         */
        const character =
            await prisma.character.findUnique({
                where: {
                    id: auth.character.id
                },

                select: {
                    id: true,
                    name: true,
                    creditBalance: true,
                    foundryWorldId: true,
                    foundryActorId: true,
                    katastroWorldId: true
                }
            });

        if (!character) {
            return response(
                {
                    error:
                        "Character not found."
                },
                404,
                request
            );
        }

        /*
         * Protect against the character being unlinked
         * or re-linked between authentication and this query.
         */
        if (
            character.foundryWorldId !==
            foundryWorldId ||

            character.foundryActorId !==
            foundryActorId ||

            character.katastroWorldId !==
            auth.world.id
        ) {
            return response(
                {
                    error:
                        "Character is no longer linked to the supplied Foundry actor."
                },
                403,
                request
            );
        }

        const oldBalance =
            character.creditBalance;

        /*
         * IMPORTANT:
         *
         * This is what protects purchases.
         *
         * Example:
         *
         * Foundry thinks server = 500
         * Player buys item for 100
         * Server is now          = 400
         *
         * Foundry sends:
         *
         * gold: 500
         * expectedGold: 500
         *
         * We must NOT change the server back to 500.
         *
         * Instead we return 409 + gold: 400.
         *
         * The VTT then applies 400 to the Actor.
         */
        if (
            oldBalance !== expectedGold
        ) {
            return response(
                {
                    error:
                        "Gold changed on Harkonians before this Foundry update could be applied.",

                    conflict: true,

                    gold: oldBalance
                },
                409,
                request
            );
        }

        /*
         * Atomic compare-and-set.
         *
         * Even though we checked above, something could
         * change the balance between the SELECT and UPDATE.
         *
         * updateMany with creditBalance: expectedGold makes
         * that race safe.
         */
        const updateResult =
            await prisma.character.updateMany({
                where: {
                    id: character.id,
                    creditBalance: expectedGold
                },

                data: {
                    creditBalance: gold
                }
            });

        /*
         * Something changed the balance after our SELECT.
         */
        if (updateResult.count !== 1) {
            const latest =
                await prisma.character.findUnique({
                    where: {
                        id: character.id
                    },

                    select: {
                        creditBalance: true
                    }
                });

            return response(
                {
                    error:
                        "Gold changed on Harkonians before this Foundry update could be applied.",

                    conflict: true,

                    gold:
                        latest?.creditBalance ??
                        oldBalance
                },
                409,
                request
            );
        }

        /*
         * Read back the authoritative result.
         */
        const updatedCharacter =
            await prisma.character.findUnique({
                where: {
                    id: character.id
                },

                select: {
                    id: true,
                    name: true,
                    creditBalance: true,
                    foundryWorldId: true,
                    foundryActorId: true,
                    katastroWorldId: true
                }
            });

        if (!updatedCharacter) {
            return response(
                {
                    error:
                        "Character disappeared after gold synchronization."
                },
                500,
                request
            );
        }

        /*
         * Audit logging is secondary.
         *
         * A logging problem should never turn a successful
         * gold sync into a failed sync.
         */
        try {
            await createAuditLog(
                auth.world.dmUserId,

                "CREDIT_ADJUSTMENT",

                "Character",

                updatedCharacter.id,

                createAuditContextFromRequest(
                    request,
                    {
                        foundryWorldId,
                        foundryActorId,
                        source:
                            "foundry_gold_sync",
                        oldBalance,
                        newBalance:
                        updatedCharacter.creditBalance
                    }
                )
            );
        } catch (error) {
            console.error(
                "Gold sync succeeded but audit logging failed:",
                error
            );
        }

        /*
         * DO NOT manually broadcast gold_update here.
         *
         * Your PostgreSQL migration already contains:
         *
         * harkonians_character_gold_realtime
         *
         * which broadcasts gold_update whenever
         * Character.creditBalance changes.
         *
         * Manually broadcasting here would cause duplicate
         * gold_update messages.
         */

        return response(
            {
                success: true,

                actorId:
                updatedCharacter.foundryActorId,

                characterId:
                updatedCharacter.id,

                gold:
                updatedCharacter.creditBalance,

                message:
                    "Gold synced successfully."
            },
            200,
            request
        );
    } catch (error) {
        console.error(
            "Sync gold error:",
            error
        );

        const message =
            error instanceof Error
                ? error.message
                : "Failed to synchronize gold.";

        const status =
            message.startsWith(
                "UNAUTHENTICATED"
            )
                ? 401
                : message.startsWith(
                    "FORBIDDEN"
                )
                    ? 403
                    : 500;

        return response(
            {
                error: message
            },
            status,
            request
        );
    }
}
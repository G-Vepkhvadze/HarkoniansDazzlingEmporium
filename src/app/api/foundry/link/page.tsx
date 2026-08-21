"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface Character {
    id: string;
    name: string;
    foundryWorldId: string | null;
    foundryActorId: string | null;
    katastroWorldId: string | null;
}

export default function FoundryLinkPage() {
    const searchParams =
        useSearchParams();

    const requestId =
        searchParams.get(
            "requestId"
        );

    const [characters, setCharacters] =
        useState<Character[]>([]);

    const [selectedCharacter, setSelectedCharacter] =
        useState("");

    const [loading, setLoading] =
        useState(true);

    const [submitting, setSubmitting] =
        useState(false);

    const [error, setError] =
        useState("");

    const [success, setSuccess] =
        useState(false);

    useEffect(() => {
        async function load() {
            if (!requestId) {
                setError(
                    "Missing Foundry link request."
                );
                setLoading(false);
                return;
            }

            try {
                const response =
                    await fetch(
                        `/api/foundry/link/characters?requestId=${encodeURIComponent(requestId)}`,
                        {
                            credentials:
                                "include"
                        }
                    );

                const data =
                    await response.json();

                if (!response.ok) {
                    throw new Error(
                        data?.error ||
                        "Unable to load characters."
                    );
                }

                setCharacters(
                    data.characters ?? []
                );

            } catch (error) {
                setError(
                    error instanceof Error
                        ? error.message
                        : "Unable to load characters."
                );
            } finally {
                setLoading(false);
            }
        }

        load();
    }, [requestId]);

    async function approve() {
        if (
            !requestId ||
            !selectedCharacter
        ) {
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            const response =
                await fetch(
                    "/api/foundry/link/approve",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        credentials: "include",

                        body: JSON.stringify({
                            requestId,
                            characterId:
                            selectedCharacter
                        })
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.error ||
                    "Failed to approve link."
                );
            }

            setSuccess(true);

        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "Failed to approve link."
            );
        } finally {
            setSubmitting(false);
        }
    }

    if (success) {
        return (
            <main className="mx-auto max-w-xl p-8">
                <h1>
                    Foundry Actor Linked
                </h1>

                <p>
                    This Harkonians character
                    has been authorized.
                </p>

                <p>
                    Return to Foundry.
                    The module will finish
                    the connection automatically.
                </p>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-xl p-8">
            <h1>
                Link Foundry Character
            </h1>

            <p>
                Choose which Harkonians
                character should control the
                Foundry Actor requesting this
                connection.
            </p>

            {loading && (
                <p>Loading characters...</p>
            )}

            {!loading &&
                characters.length === 0 && (
                    <p>
                        You do not have any
                        characters available for
                        this Foundry world.
                    </p>
                )}

            {characters.length > 0 && (
                <>
                    <select
                        value={selectedCharacter}
                        onChange={(event) =>
                            setSelectedCharacter(
                                event.target.value
                            )
                        }
                    >
                        <option value="">
                            Select a character
                        </option>

                        {characters.map(
                            (character) => (
                                <option
                                    key={character.id}
                                    value={character.id}
                                >
                                    {character.name}
                                </option>
                            )
                        )}
                    </select>

                    <button
                        type="button"
                        disabled={
                            !selectedCharacter ||
                            submitting
                        }
                        onClick={approve}
                    >
                        {submitting
                            ? "Linking..."
                            : "Approve Link"}
                    </button>
                </>
            )}

            {error && (
                <p>{error}</p>
            )}
        </main>
    );
}
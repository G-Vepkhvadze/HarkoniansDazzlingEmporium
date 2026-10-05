"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";

import {
  createClient,
  type RealtimeChannel,
  type SupabaseClient
} from "@supabase/supabase-js";

import {
  useAuth
} from "@/components/AuthProvider/AuthProvider";

interface Character {
  id: string;
  name: string;
  creditBalance: number;
  foundryWorldId: string | null;
  foundryActorId: string | null;
}

interface RealtimeTokenResponse {
  token: string;
  expiresAt: number;
}

interface GoldUpdateEventDetail {
  characterId: string;
  gold: number;
}

const SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_PUBLISHABLE_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function normalizeGold(
    value: unknown
): number | null {
  const gold =
      Number(value);

  if (!Number.isFinite(gold)) {
    return null;
  }

  return Math.max(
      0,
      Math.floor(gold)
  );
}

export default function CurrentGold() {
  const {
    isAuthenticated,
    loading
  } = useAuth();

  const [
    goldAmount,
    setGoldAmount
  ] =
      useState<number | null>(
          null
      );

  const [
    characterId,
    setCharacterId
  ] =
      useState<string | null>(
          null
      );

  const clientRef =
      useRef<SupabaseClient | null>(
          null
      );

  const channelRef =
      useRef<RealtimeChannel | null>(
          null
      );

  /*
   * Fetch the current authoritative character
   * balance from Harkonians.
   *
   * This also acts as a recovery mechanism if
   * a realtime message was ever missed.
   */
  const refreshGold =
      useCallback(
          async () => {
            if (!isAuthenticated) {
              return null;
            }

            try {
              const response =
                  await fetch(
                      "/api/characters",
                      {
                        credentials:
                            "include",

                        cache:
                            "no-store"
                      }
                  );

              if (!response.ok) {
                console.error(
                    "Harkonians | Failed to refresh character gold:",
                    response.status
                );

                return null;
              }

              const data =
                  await response.json();

              const linkedCharacters:
                  Character[] =
                  (
                      data.characters ||
                      []
                  ).filter(
                      (
                          character:
                          Character
                      ) =>
                          Boolean(
                              character
                                  .foundryWorldId
                          ) &&
                          Boolean(
                              character
                                  .foundryActorId
                          )
                  );

              /*
               * Current behaviour:
               *
               * The header displays the first linked
               * character.
               *
               * If you later want multiple active
               * characters, we should move this into
               * a global selected-character context.
               */
              const linked =
                  linkedCharacters[0];

              if (!linked) {
                setCharacterId(
                    null
                );

                setGoldAmount(
                    0
                );

                return null;
              }

              const gold =
                  normalizeGold(
                      linked.creditBalance
                  );

              setCharacterId(
                  linked.id
              );

              setGoldAmount(
                  gold ?? 0
              );

              return linked;

            } catch (error) {
              console.error(
                  "Harkonians | Failed to refresh gold:",
                  error
              );

              return null;
            }
          },
          [isAuthenticated]
      );

  useEffect(() => {
    if (!isAuthenticated) {
      setGoldAmount(
          null
      );

      setCharacterId(
          null
      );

      channelRef.current
          ?.unsubscribe();

      channelRef.current =
          null;

      clientRef.current
          ?.removeAllChannels();

      clientRef.current =
          null;

      return;
    }

    let cancelled =
        false;

    /*
     * Immediate browser-local update.
     *
     * The purchase page dispatches this after the
     * server has successfully committed the purchase.
     */
    const handleLocalGoldUpdate =
        (
            event: Event
        ) => {
          const customEvent =
              event as CustomEvent<
                  GoldUpdateEventDetail
              >;

          const incomingCharacterId =
              customEvent
                  .detail
                  ?.characterId;

          const gold =
              normalizeGold(
                  customEvent
                      .detail
                      ?.gold
              );

          if (
              !incomingCharacterId ||
              gold === null
          ) {
            return;
          }

          /*
           * Only update this header if the event belongs
           * to the character currently displayed here.
           */
          if (
              characterId &&
              incomingCharacterId !==
              characterId
          ) {
            return;
          }

          setGoldAmount(
              gold
          );
        };

    window.addEventListener(
        "harkonians:gold-updated",
        handleLocalGoldUpdate
    );

    /*
     * Recover the authoritative balance whenever
     * the player comes back to this browser tab.
     */
    const handleFocus =
        () => {
          void refreshGold();
        };

    const handleVisibilityChange =
        () => {
          if (
              document.visibilityState ===
              "visible"
          ) {
            void refreshGold();
          }
        };

    window.addEventListener(
        "focus",
        handleFocus
    );

    document.addEventListener(
        "visibilitychange",
        handleVisibilityChange
    );

    async function start() {
      const linked =
          await refreshGold();

      if (
          cancelled ||
          !linked
      ) {
        return;
      }

      if (
          !SUPABASE_URL ||
          !SUPABASE_PUBLISHABLE_KEY
      ) {
        console.error(
            "Harkonians | Realtime disabled because Supabase public environment variables are missing."
        );

        return;
      }

      try {
        const tokenResponse =
            await fetch(
                `/api/characters/realtime-token?characterId=${encodeURIComponent(
                    linked.id
                )}`,
                {
                  credentials:
                      "include",

                  cache:
                      "no-store"
                }
            );

        if (
            !tokenResponse.ok ||
            cancelled
        ) {
          console.error(
              "Harkonians | Failed to get website realtime token:",
              tokenResponse.status
          );

          return;
        }

        const tokenData:
            RealtimeTokenResponse =
            await tokenResponse.json();

        let cachedToken =
            tokenData.token;

        let cachedExpiresAt =
            Number(
                tokenData.expiresAt
            ) ||
            Math.floor(
                Date.now() /
                1000
            ) +
            300;

        const supabase =
            createClient(
                SUPABASE_URL,
                SUPABASE_PUBLISHABLE_KEY,
                {
                  realtime: {
                    params: {
                      eventsPerSecond:
                          10
                    }
                  },

                  /*
                   * This callback lets Realtime obtain
                   * a fresh short-lived JWT as needed.
                   */
                  accessToken:
                      async () => {
                        const now =
                            Math.floor(
                                Date.now() /
                                1000
                            );

                        if (
                            cachedToken &&
                            cachedExpiresAt >
                            now + 60
                        ) {
                          return cachedToken;
                        }

                        try {
                          const response =
                              await fetch(
                                  `/api/characters/realtime-token?characterId=${encodeURIComponent(
                                      linked.id
                                  )}`,
                                  {
                                    credentials:
                                        "include",

                                    cache:
                                        "no-store"
                                  }
                              );

                          if (
                              !response.ok
                          ) {
                            console.error(
                                "Harkonians | Failed to refresh realtime token:",
                                response.status
                            );

                            return cachedToken;
                          }

                          const refreshed:
                              RealtimeTokenResponse =
                              await response.json();

                          cachedToken =
                              refreshed.token;

                          cachedExpiresAt =
                              Number(
                                  refreshed.expiresAt
                              ) ||
                              now +
                              300;

                          return cachedToken;

                        } catch (
                            error
                            ) {
                          console.error(
                              "Harkonians | Realtime token refresh failed:",
                              error
                          );

                          return cachedToken;
                        }
                      }
                }
            );

        /*
         * Authenticate BEFORE joining the private
         * character channel.
         */
        supabase.realtime.setAuth(
            tokenData.token
        );

        clientRef.current =
            supabase;

        const channel =
            supabase
                .channel(
                    `foundry:character:${linked.id}`,
                    {
                      config: {
                        private:
                            true
                      }
                    }
                )
                .on(
                    "broadcast",
                    {
                      event:
                          "gold_update"
                    },
                    (event) => {
                      const gold =
                          normalizeGold(
                              event
                                  .payload
                                  ?.gold
                          );

                      if (
                          gold === null ||
                          cancelled
                      ) {
                        return;
                      }

                      /*
                       * Database/Foundry-originated update.
                       */
                      setGoldAmount(
                          gold
                      );

                      console.log(
                          `Harkonians | Website gold updated to ${gold} GP`
                      );
                    }
                );

        channelRef.current =
            channel;

        channel.subscribe(
            (
                status,
                error
            ) => {
              if (
                  status ===
                  "SUBSCRIBED"
              ) {
                console.log(
                    `Harkonians | Website gold realtime connected for ${linked.name}`
                );

                return;
              }

              if (
                  status ===
                  "CHANNEL_ERROR" ||
                  status ===
                  "TIMED_OUT"
              ) {
                console.error(
                    "Harkonians | Website gold realtime channel error:",
                    error
                );

                /*
                 * Even if realtime fails, recover the
                 * authoritative database value.
                 */
                void refreshGold();
              }
            }
        );

      } catch (error) {
        console.error(
            "Harkonians | Website realtime setup failed:",
            error
        );
      }
    }

    void start();

    return () => {
      cancelled =
          true;

      window.removeEventListener(
          "harkonians:gold-updated",
          handleLocalGoldUpdate
      );

      window.removeEventListener(
          "focus",
          handleFocus
      );

      document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange
      );

      channelRef.current
          ?.unsubscribe();

      channelRef.current =
          null;

      clientRef.current
          ?.removeAllChannels();

      clientRef.current =
          null;
    };
  }, [
    isAuthenticated,
    refreshGold,
    characterId
  ]);

  if (
      loading ||
      !isAuthenticated
  ) {
    return null;
  }

  return (
      <div className="current-gold">
        Current Gold:{" "}
        {(goldAmount ?? 0)
            .toLocaleString()}
      </div>
  );
}
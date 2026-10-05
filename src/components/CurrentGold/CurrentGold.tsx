"use client";

import { useEffect, useRef, useState } from "react";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { useAuth } from "@/components/AuthProvider/AuthProvider";

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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export default function CurrentGold() {
  const { isAuthenticated, loading } = useAuth();
  const [goldAmount, setGoldAmount] = useState<number | null>(null);
  const [characterId, setCharacterId] = useState<string | null>(null);
  const clientRef = useRef<SupabaseClient | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setGoldAmount(null);
      setCharacterId(null);
      channelRef.current?.unsubscribe();
      channelRef.current = null;
      clientRef.current?.removeAllChannels();
      clientRef.current = null;
      return;
    }

    let cancelled = false;

    async function loadCharacter() {
      try {
        const response = await fetch("/api/characters", {
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) return;

        const data = await response.json();
        const linkedCharacters: Character[] = (data.characters || []).filter(
          (character: Character) => character.foundryWorldId && character.foundryActorId
        );

        const linked = linkedCharacters[0];

        if (cancelled) return;

        if (!linked) {
          setCharacterId(null);
          setGoldAmount(0);
          return;
        }

        setCharacterId(linked.id);
        setGoldAmount(linked.creditBalance);

        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return;
        }

        const tokenResponse = await fetch(
          `/api/characters/realtime-token?characterId=${encodeURIComponent(linked.id)}`,
          { credentials: "include", cache: "no-store" }
        );

        if (!tokenResponse.ok || cancelled) return;

        const tokenData: RealtimeTokenResponse = await tokenResponse.json();

        let cachedToken = tokenData.token;
        let cachedExpiresAt = Number(tokenData.expiresAt) || Math.floor(Date.now() / 1000) + 300;

        const supabase = createClient(
          SUPABASE_URL,
          SUPABASE_PUBLISHABLE_KEY,
          {
            realtime: {
              params: { eventsPerSecond: 10 },
            },
            accessToken: async () => {
              const now = Math.floor(Date.now() / 1000);

              if (cachedToken && cachedExpiresAt > now + 60) {
                return cachedToken;
              }

              try {
                const response = await fetch(
                  `/api/characters/realtime-token?characterId=${encodeURIComponent(linked.id)}`,
                  { credentials: "include", cache: "no-store" }
                );

                if (!response.ok) return cachedToken;
                const refreshed: RealtimeTokenResponse = await response.json();
                cachedToken = refreshed.token;
                cachedExpiresAt = Number(refreshed.expiresAt) || now + 300;
                return cachedToken;
              } catch {
                return cachedToken;
              }
            },
          }
        );

        supabase.realtime.setAuth(tokenData.token);
        clientRef.current = supabase;

        const channel = supabase
          .channel(`foundry:character:${linked.id}`, { config: { private: true } })
          .on("broadcast", { event: "gold_update" }, (event) => {
            const gold = Number(event.payload?.gold);
            if (Number.isFinite(gold) && !cancelled) {
              setGoldAmount(Math.max(0, Math.floor(gold)));
            }
          });

        channelRef.current = channel;

        channel.subscribe((status, error) => {
          if (status === "SUBSCRIBED") {
            console.log("Harkonians | Gold realtime connected");
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error("Harkonians | Gold realtime channel error:", error);
          }
        });
      } catch {
        // Keep the server-provided balance if realtime setup fails.
      }
    }

    void loadCharacter();

    return () => {
      cancelled = true;
      channelRef.current?.unsubscribe();
      channelRef.current = null;
      clientRef.current?.removeAllChannels();
      clientRef.current = null;
    };
  }, [isAuthenticated]);

  if (loading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="current-gold">
      Current Gold:{" "}
      {(goldAmount ?? 0).toLocaleString()}
    </div>
  );
}

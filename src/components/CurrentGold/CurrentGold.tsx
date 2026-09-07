"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider/AuthProvider";

interface Character {
  id: string;
  name: string;
  creditBalance: number;
  foundryWorldId: string | null;
  foundryActorId: string | null;
}

export default function CurrentGold() {
  const { isAuthenticated, loading } = useAuth();
  const [goldAmount, setGoldAmount] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setGoldAmount(null);
      return;
    }

    async function fetchGold() {
      try {
        const response = await fetch("/api/characters", {
          credentials: "include",
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        const linkedCharacters: Character[] =
          (data.characters || []).filter(
            (character: Character) =>
              character.foundryWorldId &&
              character.foundryActorId
          );

        if (linkedCharacters.length > 0) {
          setGoldAmount(
            linkedCharacters[0].creditBalance
          );
        } else {
          setGoldAmount(0);
        }
      } catch {
        // Keep the previous value if the request fails.
      }
    }

    fetchGold();
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

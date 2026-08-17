"use client";

import { useState, useEffect } from "react";
import { getCurrentUserClient } from "@/lib/auth";

/**
 * CurrentGold component - displays the character's current gold amount.
 * Shows 0 as default since there are no actual Foundry characters connected.
 */
export default function CurrentGold() {
  const [goldAmount, setGoldAmount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGold() {
      try {
        const user = await getCurrentUserClient();
        // For now, always set to 0 as there are no actual Foundry characters connected
        // In the future, this would fetch from the character data
        setGoldAmount(0);
      } catch {
        setGoldAmount(0);
      } finally {
        setLoading(false);
      }
    }

    fetchGold();
  }, []);

  if (loading) {
    return null;
  }

  return (
    <div
      className="current-gold"
      style={{
        padding: "0.5rem 1rem",
        background: "rgba(45, 30, 20, 0.9)",
        border: "1px solid rgba(216, 170, 79, 0.28)",
        borderRadius: "2px",
        textAlign: "center",
        color: "var(--gold-soft)",
        fontWeight: 700,
        fontSize: "0.9rem",
      }}
    >
      Current Gold: {goldAmount.toLocaleString()}
    </div>
  );
}

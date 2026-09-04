"use client";

import { useAuth } from "@/components/AuthProvider/AuthProvider";

/**
 * CurrentGold component - displays the character's current gold amount.
 * Shows 0 as default since there are no actual Foundry characters connected.
 */
export default function CurrentGold() {
  const { isAuthenticated, loading } = useAuth();
  const goldAmount = 0; // For now, always 0 as there are no actual Foundry characters connected

  if (loading) {
    return null;
  }

  // Only show for authenticated users
  if (!isAuthenticated) {
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

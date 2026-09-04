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
    <div className="current-gold">
      Current Gold: {goldAmount.toLocaleString()}
    </div>
  );
}

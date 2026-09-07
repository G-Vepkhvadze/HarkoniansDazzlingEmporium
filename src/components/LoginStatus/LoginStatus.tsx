"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider/AuthProvider";

/**
 * Character data for the login status.
 */
interface CharacterData {
  id: string;
  name: string;
}

/**
 * LoginStatus component - displays the current user's login state.
 * Shows: "Logged in as DM" or "Logged in as Player [character name]"
 * If user has multiple characters, shows the first one.
 * Links to the user profile page when clicked.
 */
export default function LoginStatus() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If authenticated, fetch characters
    async function fetchCharacters() {
      if (!isAuthenticated || !user) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/characters", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setCharacters(data.characters || []);
        }
      } catch {
        // Failed to fetch characters, continue without them
      } finally {
        setLoading(false);
      }
    }

    fetchCharacters();
  }, [isAuthenticated, user]);

  if (authLoading || loading) {
    // Don't show anything while loading
    return null;
  }

  if (!user || !isAuthenticated) {
    // Not logged in - show nothing
    return null;
  }

  // Format the display text based on role
  // For DM: "Logged in as DM"
  // For PLAYER: "Logged in as Player [character name]" - show first character if available
  let displayText = "";
  if (user.role === "DM") {
    displayText = `Logged in as DM`;
  } else if (user.role === "PLAYER") {
    // Show first character name in brackets if available
    const characterName = characters.length > 0 ? characters[0].name : "";
    displayText = `Logged in as Player [${characterName}]`;
  }

  return (
    <Link
      href="/user"
      className="login-status"
    >
      {displayText}
    </Link>
  );
}

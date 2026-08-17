"use client";
import { useState, useEffect, Suspense } from "react";
import { isLoggedIn, getCurrentUserClient, logout } from "@/lib/auth";
import Link from "next/link";

function UserPageContent() {
  const [user, setUser] = useState<{ id: string; username: string; role: string } | null>(null);
  const [characters, setCharacters] = useState<{ id: string; name: string; creditBalance: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const loggedIn = await isLoggedIn();
      
      if (!loggedIn) {
        window.location.href = "/auth";
        return;
      }

      const currentUser = await getCurrentUserClient();
      setUser(currentUser);

      // Fetch user's characters
      try {
        const response = await fetch("/api/characters", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setCharacters(data.characters || []);
        }
      } catch {
        // Failed to fetch characters
      }

      setLoading(false);
    }

    fetchData();
  }, []);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      window.location.href = "/";
    } catch {
      // Logout failed, but redirect anyway
      window.location.href = "/";
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
        <h1>User Profile</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null; // Redirecting to login
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "1.5rem", fontSize: "1.8rem" }}>User Profile</h1>

      <section style={{ 
        padding: "1.5rem", 
        background: "var(--background-secondary)", 
        borderRadius: "8px", 
        marginBottom: "1.5rem",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
      }}>
        <h2 style={{ marginBottom: "1rem", fontSize: "1.3rem", borderBottom: "1px solid var(--border-color, #333)", paddingBottom: "0.5rem" }}>
          Account Information
        </h2>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <div><strong>Username:</strong> <span style={{ color: "var(--accent)" }}>{user.username}</span></div>
          <div><strong>Role:</strong> {user.role}</div>
          <div><strong>User ID:</strong> <code style={{ fontSize: "0.85rem", opacity: "0.7" }}>{user.id}</code></div>
        </div>
      </section>

      {user.role === "DM" && (
        <section style={{ 
          padding: "1.5rem", 
          background: "var(--background-secondary)", 
          borderRadius: "8px", 
          marginBottom: "1.5rem",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <h2 style={{ marginBottom: "1rem", fontSize: "1.3rem", borderBottom: "1px solid var(--border-color, #333)", paddingBottom: "0.5rem" }}>
            Dungeon Master Access
          </h2>
          <p style={{ marginBottom: "1rem" }}>You have Dungeon Master privileges for the Katastro campaign.</p>
          <Link
            href="/foundry/pair"
            style={{
              display: "inline-block",
              padding: "0.5rem 1rem",
              background: "var(--accent)",
              color: "white",
              borderRadius: "4px",
              textDecoration: "none",
            }}
          >
            Pair Foundry World
          </Link>
        </section>
      )}

      <section style={{ 
        padding: "1.5rem", 
        background: "var(--background-secondary)", 
        borderRadius: "8px", 
        marginBottom: "1.5rem",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
      }}>
        <h2 style={{ marginBottom: "1rem", fontSize: "1.3rem", borderBottom: "1px solid var(--border-color, #333)", paddingBottom: "0.5rem" }}>
          Your Characters
        </h2>
        {characters.length > 0 ? (
          <ul style={{ paddingLeft: "0", listStyle: "none", margin: "0" }}>
            {characters.map((character) => (
              <li 
                key={character.id} 
                style={{
                  padding: "0.75rem",
                  marginBottom: "0.5rem",
                  background: "var(--background-tertiary, rgba(0,0,0,0.2))",
                  borderRadius: "4px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <span><strong>{character.name}</strong></span>
                <span>Credit: {character.creditBalance} CP</span>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: "var(--muted, #888)", fontStyle: "italic" }}>You don't have any characters yet.</p>
        )}
        {user.role !== "DM" && (
          <div style={{ marginTop: "1rem" }}>
            <Link
              href="/foundry/link"
              style={{
                display: "inline-block",
                padding: "0.5rem 1rem",
                background: "var(--accent)",
                color: "white",
                borderRadius: "4px",
                textDecoration: "none",
              }}
            >
              Link Foundry Character
            </Link>
          </div>
        )}
      </section>

      <div style={{ 
        marginTop: "2rem", 
        paddingTop: "1rem", 
        borderTop: "1px solid var(--border-color, #333)",
        display: "flex",
        gap: "1rem",
        alignItems: "center"
      }}>
        <Link 
          href="/" 
          style={{
            padding: "0.5rem 1rem",
            background: "var(--background-secondary)",
            color: "inherit",
            borderRadius: "4px",
            textDecoration: "none",
          }}
        >
          Back to Homepage
        </Link>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          style={{
            padding: "0.5rem 1rem",
            background: "var(--red, #dc2626)",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "0.9rem",
          }}
        >
          {isLoggingOut ? "Logging out..." : "Log Out"}
        </button>
      </div>
    </div>
  );
}

export default function UserPage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem" }}><h1>User Profile</h1><p>Loading...</p></div>}>
      <UserPageContent />
    </Suspense>
  );
}

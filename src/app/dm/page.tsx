"use client";
import { useState, useEffect, Suspense } from "react";
import { isLoggedIn, isDMClient, getCurrentUserClient, logout } from "@/lib/auth";
import Link from "next/link";

function DMPageContent() {
  const [isDm, setIsDm] = useState<boolean | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<{ id: string; username: string; role: string } | null>(null);
  const [items, setItems] = useState<{
    id: string;
    name: string;
    price: number;
    stock: number;
    deal: boolean;
    discountPercent: number;
  }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const loggedIn = await isLoggedIn();
      setIsAuthenticated(loggedIn);

      if (!loggedIn) {
        window.location.href = "/auth";
        return;
      }

      const dm = await isDMClient();
      setIsDm(dm);

      if (!dm) {
        window.location.href = "/";
        return;
      }

      const currentUser = await getCurrentUserClient();
      setUser(currentUser);

      // Fetch items for DM management
      try {
        const response = await fetch("/api/items", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setItems(data.items || []);
        }
      } catch {
        // Failed to fetch items
      }

      setLoading(false);
    }

    checkAuth();
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
      <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
        <h1 style={{ marginBottom: "1.5rem", fontSize: "1.8rem" }}>Dungeon Master Admin Panel</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated || !isDm) {
    return null; // Redirecting
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "1.5rem", fontSize: "1.8rem" }}>Dungeon Master Admin Panel</h1>

      <section style={{ 
        padding: "1.5rem", 
        background: "var(--background-secondary)", 
        borderRadius: "8px", 
        marginBottom: "1.5rem",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
      }}>
        <h2 style={{ marginBottom: "1rem", fontSize: "1.3rem", borderBottom: "1px solid var(--border-color, #333)", paddingBottom: "0.5rem" }}>
          Welcome, <span style={{ color: "var(--accent)" }}>{user?.username}!</span>
        </h2>
        <p>You are the Dungeon Master for the Katastro campaign. Hey Lily.</p>
      </section>

      <div style={{ 
        display: "grid", 
        gap: "1rem", 
        marginBottom: "2rem",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))"
      }}>
        <Link
          href="/foundry/pair"
          style={{
            display: "block",
            padding: "1.5rem",
            background: "var(--background-secondary)",
            borderRadius: "8px",
            textDecoration: "none",
            color: "inherit",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            transition: "transform 0.2s",
          }}
        >
          <h3 style={{ marginBottom: "0.5rem", color: "var(--accent)" }}>Foundry World Pairing</h3>
          <p style={{ margin: "0", color: "var(--muted, #ccc)" }}>Connect FoundryVTT to Harkonians</p>
        </Link>

        <Link
          href="/user"
          style={{
            display: "block",
            padding: "1.5rem",
            background: "var(--background-secondary)",
            borderRadius: "8px",
            textDecoration: "none",
            color: "inherit",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            transition: "transform 0.2s",
          }}
        >
          <h3 style={{ marginBottom: "0.5rem", color: "var(--accent)" }}>User Profile</h3>
          <p style={{ margin: "0", color: "var(--muted, #ccc)" }}>View your profile and characters</p>
        </Link>

        <div style={{ 
          padding: "1.5rem", 
          background: "var(--background-secondary)", 
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <h3 style={{ marginBottom: "0.5rem", color: "var(--accent)" }}>Store Management</h3>
          <p style={{ margin: "0", color: "var(--muted, #ccc)" }}>Total items in marketplace: {items.length}</p>
          <Link
            href="/thesupersecretpagenobodyhasaccessto"
            style={{
              display: "inline-block",
              padding: "0.5rem 1rem",
              background: "var(--accent)",
              color: "white",
              borderRadius: "4px",
              textDecoration: "none",
              marginTop: "1rem",
            }}
          >
            Manage Items (Legacy Admin)
          </Link>
        </div>

        <div style={{ 
          padding: "1.5rem", 
          background: "var(--background-secondary)", 
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <h3 style={{ marginBottom: "0.5rem", color: "var(--accent)" }}>Campaign Management</h3>
          <p style={{ margin: "0", color: "var(--muted, #ccc)" }}>Coming soon: I have plans upon plans.</p>
        </div>
      </div>

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

export default function DMPage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem" }}><h1>Dungeon Master Admin Panel</h1><p>Loading...</p></div>}>
      <DMPageContent />
    </Suspense>
  );
}

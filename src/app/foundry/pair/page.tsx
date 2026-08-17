"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, isDMClient } from "@/lib/auth";

export default function FoundryPairPage() {
  const [isDm, setIsDm] = useState<boolean | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [pairingCode, setPairingCode] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [pairingStatus, setPairingStatus] = useState<{
    isPaired: boolean;
    world?: { id: string; foundryWorldId: string };
  } | null>(null);

  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      const loggedIn = await isLoggedIn();
      const dm = await isDMClient();
      setIsAuthenticated(loggedIn);
      setIsDm(dm);

      if (!loggedIn) {
        // Redirect to login
        router.push("/auth");
      } else if (!dm) {
        // Only DM can pair worlds
        setError("Only the Dungeon Master can pair a Foundry world.");
      } else {
        // Check current pairing status
        try {
          const response = await fetch("/api/foundry/pair", {
            credentials: "include",
          });
          if (response.ok) {
            const data = await response.json();
            setPairingStatus(data);
          }
        } catch {
          // Failed to check status
        }
      }
    }
    checkAuth();
  }, [router]);

  async function generatePairingCode() {
    if (!isDm) {
      setError("Only the Dungeon Master can generate pairing codes.");
      return;
    }

    setIsLoading(true);
    setError("");
    setStatus("");

    try {
      const response = await fetch("/api/foundry/pair", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to generate pairing code");
        return;
      }

      const data = await response.json();
      setPairingCode(data.code);
      setStatus(
        `Pairing code generated! Enter this code in your Foundry module. Expires in ${data.expiresIn / 60} minutes.`
      );
    } catch {
      setError("An error occurred while generating the pairing code");
    } finally {
      setIsLoading(false);
    }
  }

  if (isAuthenticated === null || isDm === null) {
    return (
      <div style={{ padding: "2rem" }}>
        <h1>Foundry World Pairing</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Redirecting to login
  }

  if (!isDm) {
    return (
      <div style={{ padding: "2rem" }}>
        <h1>Foundry World Pairing</h1>
        <p style={{ color: "var(--red)" }}>{error || "Only the Dungeon Master can pair a Foundry world."}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Foundry World Pairing</h1>

      <div style={{ margin: "2rem 0" }}>
        <h2>Katastro Campaign Pairing</h2>
        <p>
          To connect your Foundry VTT world to Harkonians, follow these steps:
        </p>
        <ol style={{ paddingLeft: "2rem", margin: "1rem 0" }}>
          <li>Click the button below to generate a pairing code</li>
          <li>Enter this code in your Foundry module's Harkonians configuration</li>
        </ol>

        <button
          onClick={generatePairingCode}
          disabled={isLoading}
          style={{
            padding: "0.6rem 1rem",
            marginTop: "1rem",
            fontSize: "1.1rem",
          }}
        >
          {isLoading ? "Generating..." : "Generate Pairing Code"}
        </button>

        {pairingCode && (
          <div
            style={{
              marginTop: "1rem",
              padding: "1rem",
              background: "var(--background-secondary)",
              borderRadius: "8px",
              fontFamily: "monospace",
              fontSize: "1.2rem",
              textAlign: "center",
              wordBreak: "break-all",
            }}
          >
            {pairingCode}
          </div>
        )}

        {status && (
          <div style={{ marginTop: "1rem", color: "var(--green)" }}>{status}</div>
        )}

        {error && (
          <div style={{ marginTop: "1rem", color: "var(--red)" }}>{error}</div>
        )}
      </div>

      {pairingStatus && (
        <div
          style={{
            marginTop: "2rem",
            padding: "1rem",
            background: "var(--background-secondary)",
            borderRadius: "8px",
          }}
        >
          <h3>Current Pairing Status</h3>
          <p>
            {pairingStatus.isPaired
              ? `World is already paired: ${pairingStatus.world?.foundryWorldId}`
              : "World is not yet paired."}
          </p>
        </div>
      )}

      <div style={{ marginTop: "2rem", padding: "1rem", background: "var(--background-secondary)", borderRadius: "8px" }}>
        <h3>Security Notes</h3>
        <ul style={{ paddingLeft: "1.5rem" }}>
          <li>The pairing code expires after 15 minutes</li>
          <li>Each code can only be used once</li>
        </ul>
      </div>
    </div>
  );
}

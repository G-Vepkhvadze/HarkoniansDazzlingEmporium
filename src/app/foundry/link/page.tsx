"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isLoggedIn, getCurrentUserClient } from "@/lib/auth";

function FoundryLinkPageContent() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<{ id: string; username: string; role: string } | null>(null);
  const [linkRequest, setLinkRequest] = useState<{
    foundryWorldId: string;
    foundryActorId: string;
    katastroWorldId: string;
  } | null>(null);
  const [characters, setCharacters] = useState<{ id: string; name: string }[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>("");
  const [characterName, setCharacterName] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateCharacter, setShowCreateCharacter] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  // Get requestId from query params
  const requestId = searchParams.get("requestId");

  useEffect(() => {
    async function checkAuth() {
      const loggedIn = await isLoggedIn();
      setIsAuthenticated(loggedIn);

      if (!loggedIn) {
        // Redirect to login with return URL
        router.push(`/auth?returnUrl=/foundry/link?requestId=${requestId}`);
        return;
      }

      // Get current user
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

      // Validate the link request if we have a requestId
      if (requestId) {
        try {
          const response = await fetch(`/api/foundry/link/${requestId}`, {
            credentials: "include",
          });
          if (response.ok) {
            const data = await response.json();
            setLinkRequest(data);
          } else if (response.status === 404) {
            setError("This link request is invalid, expired, or already used.");
          } else {
            setError("Failed to validate link request.");
          }
        } catch {
          setError("An error occurred while validating the link request.");
        }
      }
    }
    checkAuth();
  }, [requestId, router]);

  async function handleCreateCharacter() {
    if (!user || !linkRequest) {
      setError("You must be logged in and have a valid link request.");
      return;
    }

    if (!characterName.trim()) {
      setError("Please enter a character name.");
      return;
    }

    setIsLoading(true);
    setError("");
    setStatus("");

    try {
      setStatus(`Character "${characterName}" will be linked to your Foundry Actor.`);
      setShowCreateCharacter(false);
    } catch (err) {
      setError("An error occurred while creating the character.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSelectExistingCharacter() {
    if (!user || !linkRequest || !selectedCharacterId) {
      setError("Please select a character.");
      return;
    }

    setIsLoading(true);
    setError("");
    setStatus("");

    try {
      const selectedCharacter = characters.find(c => c.id === selectedCharacterId);
      if (selectedCharacter) {
        setStatus(`Your character "${selectedCharacter.name}" will be linked to Foundry Actor ${linkRequest.foundryActorId}.`);
      } else {
        setError("Selected character not found.");
      }
    } catch (err) {
      setError("An error occurred while linking the character.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLinkWithNewCharacter() {
    if (characters.length > 0) {
      setShowCreateCharacter(false);
    } else {
      setShowCreateCharacter(true);
    }
  }

  if (isAuthenticated === null) {
    return (
      <div style={{ padding: "2rem" }}>
        <h1>Link Foundry Character</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!user) {
    return (
      <div style={{ padding: "2rem" }}>
        <h1>Link Foundry Character</h1>
        <p>Please log in to continue.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Link Foundry Character</h1>

      {!requestId && (
        <div style={{ padding: "1rem", background: "var(--background-secondary)", borderRadius: "8px", marginBottom: "1rem" }}>
          <p>No link request specified. Please initiate linking from your Foundry module.</p>
        </div>
      )}

      {error && (
        <div style={{ color: "var(--red)", marginBottom: "1rem" }}>{error}</div>
      )}

      {linkRequest && (
        <div style={{ marginTop: "2rem" }}>
          <h2>Linking Foundry Actor to Harkonians</h2>
          <div style={{ padding: "1rem", background: "var(--background-secondary)", borderRadius: "8px", margin: "1rem 0" }}>
            <p><strong>Foundry Actor:</strong> {linkRequest.foundryActorId}</p>
            <p><strong>Foundry World:</strong> {linkRequest.foundryWorldId}</p>
          </div>

          <p>
            {characters.length > 0
              ? "You already have Harkonians characters. You can link this Foundry Actor to one of them, or create a new character."
              : "You don't have any Harkonians characters yet. You'll need to create one."}
          </p>

          <div style={{ margin: "1rem 0", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <button onClick={handleLinkWithNewCharacter} disabled={isLoading} style={{ padding: "0.6rem 1rem", fontSize: "1rem" }}>
              {characters.length > 0 ? "Select Existing Character" : "Create New Character"}
            </button>
          </div>

          {showCreateCharacter && (
            <div style={{ marginTop: "1rem", padding: "1rem", background: "var(--background-secondary)", borderRadius: "8px" }}>
              <h3>Create New Character</h3>
              <p>This will create a new Harkonians character linked to your Foundry Actor.</p>
              <label style={{ display: "block", marginTop: "1rem" }}>
                Character Name
                <input type="text" value={characterName} onChange={(e) => setCharacterName(e.target.value)} placeholder="Enter your character's name" style={{ display: "block", width: "100%", padding: "0.5rem", marginTop: "0.5rem", maxWidth: "400px" }} />
              </label>
              <button onClick={handleCreateCharacter} disabled={isLoading || !characterName.trim()} style={{ padding: "0.6rem 1rem", marginTop: "1rem" }}>
                {isLoading ? "Creating..." : "Create and Link Character"}
              </button>
            </div>
          )}

          {characters.length > 0 && !showCreateCharacter && (
            <div style={{ marginTop: "1rem", padding: "1rem", background: "var(--background-secondary)", borderRadius: "8px" }}>
              <h3>Select Existing Character</h3>
              <p>Select which of your existing Harkonians characters to link to this Foundry Actor.</p>
              <select value={selectedCharacterId} onChange={(e) => setSelectedCharacterId(e.target.value)} style={{ display: "block", width: "100%", padding: "0.5rem", margin: "0.5rem 0", maxWidth: "400px" }}>
                <option value="">Select a character...</option>
                {characters.map((character) => (
                  <option key={character.id} value={character.id}>{character.name}</option>
                ))}
              </select>
              <button onClick={handleSelectExistingCharacter} disabled={isLoading || !selectedCharacterId} style={{ padding: "0.6rem 1rem", marginTop: "0.5rem" }}>
                {isLoading ? "Linking..." : "Link Selected Character"}
              </button>
            </div>
          )}

          {status && (
            <div style={{ marginTop: "1rem", padding: "1rem", background: "var(--background-secondary)", borderRadius: "8px", color: "var(--green)" }}>
              <p>{status}</p>
              <p><strong>Important:</strong> After confirming, return to your Foundry module to complete the linking process.</p>
            </div>
          )}
        </div>
      )}

      {!linkRequest && requestId && (
        <div style={{ marginTop: "1rem", padding: "1rem", background: "var(--background-secondary)", borderRadius: "8px" }}>
          <p>Validating link request...</p>
        </div>
      )}

      <div style={{ marginTop: "2rem", padding: "1rem", background: "var(--background-secondary)", borderRadius: "8px" }}>
        <h3>How Linking Works</h3>
        <ol style={{ paddingLeft: "1.5rem" }}>
          <li>Initiate linking from your Foundry module</li>
          <li>You'll be redirected here to authenticate</li>
          <li>Select or create a Harkonians character</li>
          <li>Return to Foundry to complete the process</li>
          <li>Your Foundry Actor will now be connected to your Harkonians Character</li>
        </ol>
        <p style={{ marginTop: "1rem" }}><strong>Note:</strong> Each Foundry Actor can only be linked to one Harkonians Character.</p>
      </div>
    </div>
  );
}

export default function FoundryLinkPage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem" }}><h1>Link Foundry Character</h1><p>Loading...</p></div>}>
      <FoundryLinkPageContent />
    </Suspense>
  );
}

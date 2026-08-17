// This file provides client-side authentication utilities.
// Server-side authentication is handled in src/lib/auth/index.ts

const SESSION_COOKIE_NAME = "harkonians_session";

/**
 * Client-side session information (minimal, from API)
 */
export interface ClientSession {
  user: {
    id: string;
    username: string;
    role: string;
  } | null;
}

/**
 * Check if the user is logged in (client-side).
 * This makes a request to the /api/auth/me endpoint.
 * 
 * Note: This is an async check. For initial page load, consider using
 * the server-side getCurrentUser() instead.
 */
export async function isLoggedIn(): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/me", {
      credentials: "include",
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return !!data?.user;
  } catch {
    return false;
  }
}

/**
 * Get the current user from the client side.
 * Makes a request to /api/auth/me.
 */
export async function getCurrentUserClient(): Promise<{
  id: string;
  username: string;
  role: string;
} | null> {
  try {
    const response = await fetch("/api/auth/me", {
      credentials: "include",
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return data.user || null;
  } catch {
    return null;
  }
}

/**
 * Login a user (client-side).
 * Posts to /api/auth/login.
 * @param username - The username
 * @param password - The password
 * @returns Promise resolving to true on success, false on failure
 */
export async function login(username: string, password: string): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
      credentials: "include",
    });
    
    if (!response.ok) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Logout the current user (client-side).
 * Posts to /api/auth/logout.
 */
export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Logout failed, but we can still try to clear local state
    console.error("Logout request failed");
  }
}

/**
 * Get the current username (client-side).
 * Uses the cached session or fetches from API.
 */
export async function getUsername(): Promise<string | null> {
  const user = await getCurrentUserClient();
  return user?.username || null;
}

/**
 * Check if the current user is a DM (client-side).
 */
export async function isDMClient(): Promise<boolean> {
  const user = await getCurrentUserClient();
  return user?.role === "DM";
}

/**
 * Check if the current user is a PLAYER (client-side).
 */
export async function isPlayerClient(): Promise<boolean> {
  const user = await getCurrentUserClient();
  return user?.role === "PLAYER";
}

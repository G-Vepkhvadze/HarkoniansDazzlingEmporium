import { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { getSessionByToken, createSession, deleteSession, SESSION_COOKIE_MAX_AGE } from "./session";
import { verifyCredentials, getUserById } from "./user";

// Session cookie name
const SESSION_COOKIE_NAME = "harkonians_session";

/**
 * Authentication result type
 */
export interface AuthResult {
  user: {
    id: string;
    username: string;
    role: UserRole;
  } | null;
  error?: string;
}

/**
 * Session user type (what we store in the session)
 */
export interface SessionUser {
  id: string;
  username: string;
  role: UserRole;
}

/**
 * Login a user with username and password.
 * Creates a session and sets the session cookie.
 * @param username - The username
 * @param password - The password
 * @returns Promise resolving to auth result
 */
export async function login(username: string, password: string): Promise<AuthResult> {
  const user = await verifyCredentials(username, password);

  if (!user) {
    // Generic error message - don't reveal if username or password was wrong
    return { user: null, error: "Invalid username or password" };
  }

  // Create a new session
  const session = await createSession(user.id);

  // Set the session cookie
  // Note: In Next.js server components, we can't set cookies directly here
  // The cookie will be set in the login API route

  return {
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  };
}

/**
 * Logout the current user.
 * Deletes the session and clears the session cookie.
 * Note: This is for server-side use. For client-side, use the API route.
 */
export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    // Delete the session from the database
    await deleteSession(sessionToken);
  }

  // Cookie deletion will be handled in the logout API route
}

/**
 * Get the current authenticated user from the session cookie.
 * @returns Promise resolving to SessionUser or null if not authenticated
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  const session = await getSessionByToken(sessionToken);

  if (!session || !session.user) {
    return null;
  }

  return {
    id: session.user.id,
    username: session.user.username,
    role: session.user.role,
  };
}

/**
 * Check if the current user is authenticated.
 * @returns Promise resolving to true if authenticated, false otherwise
 */
export async function isAuthenticated(): Promise<boolean> {
  return (await getCurrentUser()) !== null;
}

/**
 * Check if the current user has the DM role.
 * @returns Promise resolving to true if user is DM, false otherwise
 */
export async function isDM(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === UserRole.DM;
}

/**
 * Check if the current user has the PLAYER role.
 * @returns Promise resolving to true if user is PLAYER, false otherwise
 */
export async function isPlayer(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === UserRole.PLAYER;
}

/**
 * Require authentication for a route.
 * Throws an error if not authenticated.
 * @returns Promise resolving to the current user
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

/**
 * Require DM role for a route.
 * Throws an error if not authenticated or not DM.
 * @returns Promise resolving to the current user
 */
export async function requireDM(): Promise<SessionUser> {
  const user = await requireAuth();
  if (user.role !== UserRole.DM) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

/**
 * Get the session token from cookies.
 * @returns The session token or null
 */
export async function getSessionTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
}

/**
 * Session cookie configuration
 */
export const SESSION_COOKIE_CONFIG = {
  name: SESSION_COOKIE_NAME,
  maxAge: SESSION_COOKIE_MAX_AGE,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

// Re-export session utilities for convenience
export { getSessionByToken, createSession, deleteSession, SESSION_COOKIE_MAX_AGE, cleanupExpiredSessions, extendSession } from "./session";

// Re-export user utilities for convenience
export { getUserById, getUserByUsername, createUser, isUsernameAvailable, verifyCredentials, updateUserRole, deleteUser, getAllUsers } from "./user";

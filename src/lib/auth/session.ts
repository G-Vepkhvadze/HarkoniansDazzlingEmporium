import { prisma } from "../prisma";

// Session configuration
const SESSION_DURATION_HOURS = 24;
const SESSION_DURATION_MS = SESSION_DURATION_HOURS * 60 * 60 * 1000;

/**
 * Generate a cryptographically secure random session token.
 * Uses Web Crypto API (available in browsers and Node.js 15+)
 * Falls back to Math.random for Edge Runtime compatibility.
 * @returns A hex-encoded random token
 */
export function generateSessionToken(): string {
  // Try Web Crypto API first (works in modern Node.js and browsers)
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  
  // Fallback for environments without Web Crypto
  // Note: This is less secure but ensures functionality
  const array = new Uint8Array(32);
  for (let i = 0; i < array.length; i++) {
    array[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Calculate the expiration date for a new session.
 * @returns Date object representing the expiration time
 */
export function getSessionExpiration(): Date {
  return new Date(Date.now() + SESSION_DURATION_MS);
}

/**
 * Create a new session for a user.
 * @param userId - The ID of the user to create a session for
 * @returns Promise resolving to the created session
 */
export async function createSession(userId: string) {
  const token = generateSessionToken();
  const expiresAt = getSessionExpiration();

  return prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });
}

/**
 * Find a session by its token.
 * @param token - The session token to look up
 * @returns Promise resolving to the session or null if not found/expired
 */
export async function getSessionByToken(token: string) {
  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          role: true,
        },
      },
    },
  });

  // Check if session exists and is not expired
  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return session;
}

/**
 * Delete a session by its token.
 * @param token - The session token to delete
 * @returns Promise resolving when the session is deleted
 */
export async function deleteSession(token: string) {
  await prisma.session.deleteMany({
    where: { token },
  });
}

/**
 * Delete all sessions for a user (e.g., on password change or logout all).
 * @param userId - The user ID whose sessions should be deleted
 * @returns Promise resolving when all sessions are deleted
 */
export async function deleteAllSessionsForUser(userId: string) {
  await prisma.session.deleteMany({
    where: { userId },
  });
}

/**
 * Delete all expired sessions.
 * This can be run periodically to clean up the database.
 * @returns Promise resolving to the count of deleted sessions
 */
export async function cleanupExpiredSessions() {
  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
  return result.count;
}

/**
 * Extend a session's expiration.
 * @param token - The session token to extend
 * @returns Promise resolving to the updated session or null if not found
 */
export async function extendSession(token: string) {
  const expiresAt = getSessionExpiration();

  return prisma.session.updateMany({
    where: { token },
    data: { expiresAt },
  });
}

// Export session duration for use in cookie settings
export const SESSION_COOKIE_MAX_AGE = SESSION_DURATION_MS / 1000; // in seconds

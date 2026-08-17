/**
 * Route protection utilities for API routes.
 * These functions can be used to protect individual routes without middleware.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionByToken } from "./session";

// Session cookie name
const SESSION_COOKIE_NAME = "harkonians_session";

// User role type
type UserRole = "PLAYER" | "DM";

/**
 * Check if the current request is authenticated as a DM.
 * Returns the user if authenticated and authorized, null otherwise.
 */
export async function requireDM(): Promise<{
  id: string;
  username: string;
  role: UserRole;
} | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  const session = await getSessionByToken(sessionToken);

  if (!session || !session.user) {
    return null;
  }

  if (session.user.role !== "DM") {
    return null;
  }

  return {
    id: session.user.id,
    username: session.user.username,
    role: session.user.role,
  };
}

/**
 * Check if the current request is authenticated (any role).
 * Returns the user if authenticated, null otherwise.
 */
export async function requireAuth(): Promise<{
  id: string;
  username: string;
  role: UserRole;
} | null> {
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
 * Create a 401 Unauthorized response.
 */
export function unauthorizedResponse(message = "Unauthorized") {
  return NextResponse.json(
    { error: message },
    { status: 401 }
  );
}

/**
 * Create a 403 Forbidden response.
 */
export function forbiddenResponse(message = "Forbidden") {
  return NextResponse.json(
    { error: message },
    { status: 403 }
  );
}

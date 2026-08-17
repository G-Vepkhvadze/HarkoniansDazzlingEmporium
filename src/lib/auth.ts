// Auth library entry point for CLIENT-SIDE usage only.
// For SERVER-SIDE usage, import directly from:
// - @/lib/auth/index (server auth utilities)
// - @/lib/auth/session (session management)
// - @/lib/auth/user (user management)

// Client-side exports only
export type { ClientSession } from "./auth/client";
export {
  isLoggedIn,
  getCurrentUserClient,
  login,
  logout,
  getUsername,
  isDMClient,
  isPlayerClient,
} from "./auth/client";

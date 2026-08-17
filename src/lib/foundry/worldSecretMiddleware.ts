/**
 * World secret middleware for Foundry integration.
 * 
 * This middleware validates the X-Foundry-World-Secret header and ensures
 * that requests are coming from a paired Katastro world.
 * 
 * World secrets are trusted bearer credentials that:
 * - Identify a paired Katastro Foundry world
 * - Are stored hashed in the database
 * - Are returned once to the Foundry module at pairing time
 * - Must be stored securely by the Foundry module
 * 
 * IMPORTANT: Possession of a worldSecret alone does NOT grant:
 * - Access to player accounts
 * - Access to arbitrary characters
 * - Ability to change credit
 * - Ability to make purchases
 * - DM privileges
 * 
 * World secret must be combined with other authentication (character token,
 * DM session) for actual access to resources.
 */

import { getWorldBySecret } from './worldSecret';
import { UserRole } from '@prisma/client';
import { requireCharacterToken, extractTokenFromRequest } from './characterToken';

// =============================================
// WORLD SECRET EXTRACTION
// =============================================

/**
 * Extract the world secret from the request.
 * 
 * @param request - The incoming request
 * @returns The world secret string or null
 */
export function extractWorldSecret(request: Request): string | null {
  return request.headers.get('x-foundry-world-secret') ?? null;
}

// =============================================
// WORLD SECRET VALIDATION
// =============================================

/**
 * Validate the world secret from the request and return the world info.
 * 
 * @param request - The incoming request
 * @returns Promise resolving to world info if valid, null otherwise
 */
export async function validateWorldSecretFromRequest(
  request: Request
): Promise<{
  id: string;
  foundryWorldId: string;
  dmUserId: string;
} | null> {
  const worldSecret = extractWorldSecret(request);
  
  if (!worldSecret) {
    return null;
  }
  
  return await getWorldBySecret(worldSecret);
}

/**
 * Require a valid world secret for the request.
 * 
 * @param request - The incoming request
 * @returns Promise resolving to world info
 * @throws Error if world secret is invalid or missing
 */
export async function requireWorldSecret(
  request: Request
): Promise<{
  id: string;
  foundryWorldId: string;
  dmUserId: string;
}> {
  const world = await validateWorldSecretFromRequest(request);
  
  if (!world) {
    throw new Error('UNAUTHENTICATED: Invalid or missing world secret');
  }
  
  return world;
}

/**
 * Require both world secret AND DM authorization.
 * 
 * This is for DM-only endpoints that require both:
 * 1. A valid world secret (proving the request is from a paired Katastro world)
 * 2. A valid DM session (proving the user is authenticated as DM)
 * 
 * @param request - The incoming request
 * @param dmUserId - The DM user ID from the session
 * @returns Promise resolving to world info
 * @throws Error if authentication fails
 */
export async function requireDmWithWorldSecret(
  request: Request,
  dmUserId: string
): Promise<{
  world: {
    id: string;
    foundryWorldId: string;
    dmUserId: string;
  };
}> {
  const world = await requireWorldSecret(request);
  
  // Verify that the DM user owns this world
  if (world.dmUserId !== dmUserId) {
    throw new Error('FORBIDDEN: DM does not own this world');
  }
  
  return { world };
}

// =============================================
// WORLD CONTEXT UTILITIES
// =============================================

/**
 * Check if the request's world secret matches the specified world.
 * 
 * @param request - The incoming request
 * @param katastroWorldId - The expected KatastroWorld ID
 * @returns Promise resolving to true if valid, false otherwise
 */
export async function validateWorldSecretForWorld(
  request: Request,
  katastroWorldId: string
): Promise<boolean> {
  const worldSecret = extractWorldSecret(request);
  
  if (!worldSecret) {
    return false;
  }
  
  const world = await getWorldBySecret(worldSecret);
  
  if (!world) {
    return false;
  }
  
  return world.id === katastroWorldId;
}

/**
 * Require that the world secret matches the specified world.
 * 
 * @param request - The incoming request
 * @param katastroWorldId - The expected KatastroWorld ID
 * @returns Promise that resolves if valid
 * @throws Error if world secret is invalid or doesn't match
 */
export async function requireWorldSecretForWorld(
  request: Request,
  katastroWorldId: string
): Promise<void> {
  const isValid = await validateWorldSecretForWorld(request, katastroWorldId);
  
  if (!isValid) {
    throw new Error('UNAUTHENTICATED: Invalid world secret for this world');
  }
}

// =============================================
// COMBINED AUTHORIZATION
// =============================================

/**
 * Authorization result combining character token and world secret.
 */
export interface FoundryAuthorization {
  character: {
    id: string;
    userId: string;
    name: string;
    creditBalance: number;
    foundryWorldId: string | null;
    foundryActorId: string | null;
    katastroWorldId: string | null;
  };
  user: {
    id: string;
    username: string;
    role: UserRole;
  };
  world: {
    id: string;
    foundryWorldId: string;
    dmUserId: string;
  };
}

/**
 * Require complete Foundry authorization:
 * - Valid character API token
 * - Valid world secret
 * - World secret matches the character's world
 * 
 * @param request - The incoming request
 * @returns Promise resolving to complete authorization info
 * @throws Error if any authorization check fails
 */
export async function requireFullFoundryAuthorization(
  request: Request
): Promise<FoundryAuthorization> {
  // First, get the character from the token
  const characterResult = await requireCharacterToken(request);
  
  // Then, get the world from the secret
  const world = await requireWorldSecret(request);
  
  // Verify that the character belongs to this world
  if (characterResult.character.katastroWorldId !== world.id) {
    throw new Error('FORBIDDEN: Character does not belong to this world');
  }
  
  return {
    character: characterResult.character,
    user: characterResult.user,
    world,
  };
}

/**
 * Require DM authorization with world secret.
 * This is the highest level of Foundry authorization.
 * 
 * @param request - The incoming request
 * @param dmUserId - The DM user ID from the session
 * @returns Promise resolving to complete authorization info
 * @throws Error if any authorization check fails
 */
export async function requireDmFoundryAuthorization(
  request: Request,
  dmUserId: string
): Promise<FoundryAuthorization> {
  const auth = await requireFullFoundryAuthorization(request);
  
  // Additionally verify that the authenticated user is the DM for this world
  if (auth.user.id !== dmUserId || auth.user.role !== UserRole.DM) {
    throw new Error('FORBIDDEN: DM authorization required');
  }
  
  // Verify that the DM owns this world
  if (auth.world.dmUserId !== dmUserId) {
    throw new Error('FORBIDDEN: DM does not own this world');
  }
  
  return auth;
}

// Export world secret extraction separately for convenience
export { extractWorldSecretFromRequest } from './characterToken';

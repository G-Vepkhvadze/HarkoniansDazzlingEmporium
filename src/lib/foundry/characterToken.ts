/**
 * Character API token utilities for Foundry integration.
 * 
 * Character-scoped tokens allow the Foundry module to make authenticated
 * requests on behalf of a specific character. These tokens:
 * - Are scoped to a single Character
 * - Do NOT grant access to the User account
 * - Do NOT grant DM privileges
 * - Must be used with a valid worldSecret for Foundry requests
 * 
 * Possession of a character token allows:
 * - Reading the character's data
 * - Making purchases (deducting from character's creditBalance)
 * - Accessing the character's purchase history
 * - Browsing items
 * 
 * Possession of a character token does NOT allow:
 * - Modifying the character's creditBalance directly
 * - Accessing other characters
 * - Accessing other users' data
 * - DM operations
 */

import { prisma } from '../prisma';
import { hashToken, verifyToken, generateSecureToken } from '../crypto';

// User role type
type UserRole = "PLAYER" | "DM";

// =============================================
// TOKEN CONSTANTS
// =============================================

/**
 * Default expiration for character API tokens (30 days).
 */
export const CHARACTER_TOKEN_EXPIRY_DAYS = 30;

/**
 * Default expiration in milliseconds.
 */
export const CHARACTER_TOKEN_EXPIRY_MS = CHARACTER_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

// =============================================
// TOKEN GENERATION
// =============================================

/**
 * Generate a new character API token.
 * 
 * @param characterId - The Character ID to generate a token for
 * @param expiresInDays - Expiration in days (default: 30)
 * @returns Promise resolving to { token: string, tokenHash: string }
 */
export async function generateCharacterToken(
  characterId: string,
  expiresInDays: number = CHARACTER_TOKEN_EXPIRY_DAYS
): Promise<{ token: string; tokenHash: string }> {
  const token = generateSecureToken(32);
  const tokenHash = await hashToken(token);
  return { token, tokenHash };
}

/**
 * Create and store a new character API token.
 * 
 * @param characterId - The Character ID to create a token for
 * @param expiresInDays - Expiration in days (default: 30)
 * @returns Promise resolving to the raw token (returned once)
 */
export async function createCharacterToken(
  characterId: string,
  expiresInDays: number = CHARACTER_TOKEN_EXPIRY_DAYS
): Promise<string> {
  const { token, tokenHash } = await generateCharacterToken(characterId, expiresInDays);
  
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
  
  await prisma.characterApiToken.create({
    data: {
      tokenHash,
      characterId,
      expiresAt,
    },
  });
  
  return token;
}

// =============================================
// TOKEN VALIDATION
// =============================================

/**
 * Validate a character API token and return the associated character.
 * 
 * @param token - The raw token to validate
 * @returns Promise resolving to { character, user, token } if valid, null otherwise
 */
export async function validateCharacterToken(
  token: string
): Promise<{
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
} | null> {
  const tokenHash = await hashToken(token);
  
  const charToken = await prisma.characterApiToken.findUnique({
    where: { tokenHash },
    include: {
      character: {
        include: {
          user: {
            select: { id: true, username: true, role: true },
          },
        },
      },
    },
  });
  
  if (!charToken) {
    return null;
  }
  
  if (charToken.expiresAt < new Date()) {
    // Token expired - optionally clean up
    await prisma.characterApiToken.delete({
      where: { tokenHash },
    });
    return null;
  }
  
  return {
    character: {
      id: charToken.character.id,
      userId: charToken.character.userId,
      name: charToken.character.name,
      creditBalance: charToken.character.creditBalance,
      foundryWorldId: charToken.character.foundryWorldId,
      foundryActorId: charToken.character.foundryActorId,
      katastroWorldId: charToken.character.katastroWorldId,
    },
    user: {
      id: charToken.character.user.id,
      username: charToken.character.user.username,
      role: charToken.character.user.role,
    },
  };
}

/**
 * Get the character ID from a validated token.
 * 
 * @param token - The raw token
 * @returns Promise resolving to character ID if valid, null otherwise
 */
export async function getCharacterIdFromToken(token: string): Promise<string | null> {
  const result = await validateCharacterToken(token);
  return result?.character.id ?? null;
}

// =============================================
// TOKEN MANAGEMENT
// =============================================

/**
 * Revoke a character API token.
 * 
 * @param token - The raw token to revoke
 * @returns Promise resolving to true if revoked, false if not found
 */
export async function revokeCharacterToken(token: string): Promise<boolean> {
  const tokenHash = await hashToken(token);
  
  try {
    await prisma.characterApiToken.delete({
      where: { tokenHash },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Revoke all character API tokens for a specific character.
 * 
 * @param characterId - The Character ID
 * @returns Promise resolving when all tokens are revoked
 */
export async function revokeAllCharacterTokens(characterId: string): Promise<void> {
  await prisma.characterApiToken.deleteMany({
    where: { characterId },
  });
}

/**
 * Revoke all character API tokens for a specific user.
 * 
 * @param userId - The User ID
 * @returns Promise resolving when all tokens are revoked
 */
export async function revokeAllUserCharacterTokens(userId: string): Promise<void> {
  const characters = await prisma.character.findMany({
    where: { userId },
    select: { id: true },
  });
  
  const characterIds = characters.map(c => c.id);
  
  await prisma.characterApiToken.deleteMany({
    where: { characterId: { in: characterIds } },
  });
}

/**
 * Clean up expired character API tokens.
 * 
 * @returns Promise resolving to the count of tokens removed
 */
export async function cleanupExpiredCharacterTokens(): Promise<number> {
  const result = await prisma.characterApiToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

// =============================================
// TOKEN MIDDLEWARE
// =============================================

/**
 * Middleware to require a valid character API token.
 * 
 * @param request - The incoming request
 * @returns Promise resolving to the character context
 * @throws Error if token is invalid or expired
 */
export async function requireCharacterToken(
  request: Request
): Promise<{
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
}> {
  const token = extractTokenFromRequest(request);
  
  if (!token) {
    throw new Error('UNAUTHENTICATED: No character token provided');
  }
  
  const result = await validateCharacterToken(token);
  
  if (!result) {
    throw new Error('UNAUTHENTICATED: Invalid or expired character token');
  }
  
  return result;
}

/**
 * Extract the character token from the request.
 * Checks Authorization header for Bearer token.
 * 
 * @param request - The incoming request
 * @returns The token string or null
 */
export function extractTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader) {
    return null;
  }
  
  // Check for Bearer token
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7);
  }
  
  // Check for token in custom header (for Foundry requests)
  return request.headers.get('x-character-token') ?? null;
}

/**
 * Get the world secret from the request.
 * 
 * @param request - The incoming request
 * @returns The world secret or null
 */
export function extractWorldSecretFromRequest(request: Request): string | null {
  return request.headers.get('x-foundry-world-secret') ?? null;
}

/**
 * Require both character token and world secret for Foundry requests.
 * 
 * @param request - The incoming request
 * @returns Promise resolving to character context and world info
 * @throws Error if authentication fails
 */
export async function requireFoundryCharacterToken(
  request: Request
): Promise<{
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
  worldSecret: string;
}> {
  const characterResult = await requireCharacterToken(request);
  const worldSecret = extractWorldSecretFromRequest(request);
  
  if (!worldSecret) {
    throw new Error('UNAUTHENTICATED: No world secret provided');
  }
  
  return {
    ...characterResult,
    worldSecret,
  };
}

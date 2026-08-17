/**
 * Character linking utilities for Foundry integration.
 * 
 * Handles the creation, validation, and management of link requests
 * for connecting Foundry Actors to Harkonians Characters.
 */

import { prisma } from "../prisma";
import { generateSecureToken, hashToken, verifyToken } from "../crypto";
import { UserRole } from "@prisma/client";

// =============================================
// LINK REQUEST CONFIGURATION
// =============================================

/**
 * Link request expiration in milliseconds (15 minutes).
 */
export const LINK_REQUEST_EXPIRY_MS = 15 * 60 * 1000;

// =============================================
// LINK REQUEST GENERATION
// =============================================

/**
 * Create a new link request for character linking.
 * 
 * This is called by the Foundry module when a player wants to link their character.
 * 
 * @param foundryWorldId - The Foundry world ID
 * @param foundryActorId - The Foundry Actor ID
 * @param katastroWorldId - The Katastro world ID
 * @returns Promise resolving to { requestId: string, rawRequestId: string }
 */
export async function createLinkRequest(
  foundryWorldId: string,
  foundryActorId: string,
  katastroWorldId: string
): Promise<{ requestId: string; rawRequestId: string }> {
  // Verify the world exists and is paired
  const world = await prisma.katastroWorld.findUnique({
    where: { id: katastroWorldId },
  });

  if (!world || world.foundryWorldId !== foundryWorldId) {
    throw new Error("Invalid or unpaired world");
  }

  // Check if this actor is already linked
  const existingLink = await prisma.character.findFirst({
    where: {
      foundryWorldId,
      foundryActorId,
    },
  });

  if (existingLink) {
    throw new Error("This Foundry Actor is already linked to a Harkonians Character");
  }

  // Generate a secure request ID
  const rawRequestId = generateSecureToken(32);
  const requestIdHash = await hashToken(rawRequestId);

  // Create the link request
  await prisma.foundryLinkRequest.create({
    data: {
      requestIdHash,
      foundryWorldId,
      foundryActorId,
      katastroWorldId,
      expiresAt: new Date(Date.now() + LINK_REQUEST_EXPIRY_MS),
    },
  });

  return { requestId: rawRequestId, rawRequestId };
}

/**
 * Validate a link request and return its data.
 * 
 * @param requestId - The raw request ID
 * @returns Promise resolving to link request data if valid, null otherwise
 */
export async function validateLinkRequest(
  requestId: string
): Promise<{
  id: string;
  foundryWorldId: string;
  foundryActorId: string;
  katastroWorldId: string;
  used: boolean;
  expiresAt: Date;
} | null> {
  const requestIdHash = await hashToken(requestId);

  const linkRequest = await prisma.foundryLinkRequest.findUnique({
    where: { requestIdHash },
  });

  if (!linkRequest) {
    return null;
  }

  // Check if expired
  if (linkRequest.expiresAt < new Date()) {
    // Clean up expired request
    await prisma.foundryLinkRequest.delete({
      where: { requestIdHash },
    });
    return null;
  }

  // Check if already used
  if (linkRequest.used) {
    return null;
  }

  return {
    id: linkRequest.id,
    foundryWorldId: linkRequest.foundryWorldId,
    foundryActorId: linkRequest.foundryActorId,
    katastroWorldId: linkRequest.katastroWorldId,
    used: linkRequest.used,
    expiresAt: linkRequest.expiresAt,
  };
}

/**
 * Mark a link request as used.
 * 
 * @param requestId - The request ID
 * @returns Promise resolving to true if marked, false if not found
 */
export async function markLinkRequestAsUsed(requestId: string): Promise<boolean> {
  const requestIdHash = await hashToken(requestId);

  try {
    await prisma.foundryLinkRequest.update({
      where: { requestIdHash },
      data: { used: true },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Complete the character linking process.
 * 
 * @param requestId - The link request ID
 * @param userId - The Harkonians user ID to link to
 * @param characterName - The name for the new character
 * @returns Promise resolving to { success: boolean, character?: Character, error?: string }
 */
export async function completeCharacterLinking(
  requestId: string,
  userId: string,
  characterName: string
): Promise<{
  success: boolean;
  character?: { id: string; name: string };
  error?: string;
}> {
  // Validate the link request
  const linkRequest = await validateLinkRequest(requestId);

  if (!linkRequest) {
    return {
      success: false,
      error: "Invalid, expired, or already used link request",
    };
  }

  // Verify the user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return {
      success: false,
      error: "User not found",
    };
  }

  // Check if this user already has a character with this actor linked
  const existingCharacter = await prisma.character.findFirst({
    where: {
      userId,
      foundryWorldId: linkRequest.foundryWorldId,
      foundryActorId: linkRequest.foundryActorId,
    },
  });

  if (existingCharacter) {
    return {
      success: false,
      error: "This actor is already linked to one of your characters",
    };
  }

  // Create the character
  const character = await prisma.character.create({
    data: {
      userId,
      name: characterName,
      foundryWorldId: linkRequest.foundryWorldId,
      foundryActorId: linkRequest.foundryActorId,
      katastroWorldId: linkRequest.katastroWorldId,
      creditBalance: 0,
    },
    select: {
      id: true,
      name: true,
    },
  });

  // Mark the link request as used
  await markLinkRequestAsUsed(requestId);

  return {
    success: true,
    character,
  };
}

/**
 * Clean up expired link requests.
 * 
 * @returns Promise resolving to the count of requests removed
 */
export async function cleanupExpiredLinkRequests(): Promise<number> {
  const result = await prisma.foundryLinkRequest.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });

  return result.count;
}

// =============================================
// CHARACTER LINKING VIA AUTH CODE (Browser Flow)
// =============================================

/**
 * Auth code expiration in milliseconds (10 minutes).
 */
export const AUTH_CODE_EXPIRY_MS = 10 * 60 * 1000;

/**
 * Create an auth code for browser-based character linking.
 * 
 * This is called during the browser flow where the user authenticates
 * and then confirms the link back in Foundry.
 * 
 * @param userId - The authenticated user ID
 * @param characterId - Optional pre-selected character ID
 * @param linkRequestId - The link request ID from Foundry
 * @returns Promise resolving to { code: string, authCodeId: string }
 */
export async function createAuthCode(
  userId: string,
  characterId?: string,
  linkRequestId?: string
): Promise<{ code: string; authCodeId: string }> {
  // Generate a secure auth code
  const code = generateSecureToken(24); // 48 char hex
  const codeHash = await hashToken(code);

  // Calculate expiration
  const expiresAt = new Date(Date.now() + AUTH_CODE_EXPIRY_MS);

  // Create the auth code
  const authCode = await prisma.authCode.create({
    data: {
      codeHash,
      userId,
      characterId,
      expiresAt,
    },
    select: {
      id: true,
    },
  });

  // If a link request ID is provided, store the relationship
  // (This allows the Foundry module to exchange the auth code for character access)
  // For now, we just return the code

  return { code, authCodeId: authCode.id };
}

/**
 * Validate an auth code and return its data.
 * 
 * @param code - The auth code to validate
 * @returns Promise resolving to auth code data if valid, null otherwise
 */
export async function validateAuthCode(
  code: string
): Promise<{
  id: string;
  userId: string;
  characterId: string | null;
  used: boolean;
  expiresAt: Date;
} | null> {
  const codeHash = await hashToken(code);

  const authCode = await prisma.authCode.findUnique({
    where: { codeHash },
    include: {
      user: {
        select: { id: true, username: true, role: true },
      },
      character: {
        select: { id: true, name: true },
      },
    },
  });

  if (!authCode) {
    return null;
  }

  // Check if expired
  if (authCode.expiresAt < new Date()) {
    // Clean up expired code
    await prisma.authCode.delete({
      where: { codeHash },
    });
    return null;
  }

  // Check if already used
  if (authCode.used) {
    return null;
  }

  return {
    id: authCode.id,
    userId: authCode.userId,
    characterId: authCode.characterId || null,
    used: authCode.used,
    expiresAt: authCode.expiresAt,
  };
}

/**
 * Mark an auth code as used.
 * 
 * @param code - The auth code
 * @returns Promise resolving to true if marked, false if not found
 */
export async function markAuthCodeAsUsed(code: string): Promise<boolean> {
  const codeHash = await hashToken(code);

  try {
    await prisma.authCode.update({
      where: { codeHash },
      data: { used: true },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Exchange an auth code for a character token.
 * 
 * This is the final step in the browser flow:
 * 1. User authenticates in browser
 * 2. User confirms linking to their character
 * 3. Browser returns auth code to Foundry
 * 4. Foundry exchanges auth code for character-scoped token
 * 
 * @param authCode - The auth code from the browser flow
 * @param linkRequestId - The link request ID (for validation)
 * @returns Promise resolving to { success: boolean, characterToken?: string, error?: string }
 */
export async function exchangeAuthCodeForToken(
  authCode: string,
  linkRequestId: string
): Promise<{
  success: boolean;
  characterToken?: string;
  characterId?: string;
  error?: string;
}> {
  // Validate the auth code
  const authCodeData = await validateAuthCode(authCode);

  if (!authCodeData) {
    return {
      success: false,
      error: "Invalid, expired, or already used auth code",
    };
  }

  // Validate the link request
  const linkRequest = await validateLinkRequest(linkRequestId);

  if (!linkRequest) {
    return {
      success: false,
      error: "Invalid, expired, or already used link request",
    };
  }

  // Mark auth code as used
  await markAuthCodeAsUsed(authCode);

  // If a character was pre-selected, use it
  let characterId = authCodeData.characterId;

  // If no character was pre-selected, create a new one
  if (!characterId) {
    // Create a character with a default name based on the Foundry actor
    const character = await prisma.character.create({
      data: {
        userId: authCodeData.userId,
        name: `Linked from Foundry (${linkRequest.foundryActorId})`,
        foundryWorldId: linkRequest.foundryWorldId,
        foundryActorId: linkRequest.foundryActorId,
        katastroWorldId: linkRequest.katastroWorldId,
        creditBalance: 0,
      },
      select: {
        id: true,
      },
    });
    characterId = character.id;
  }

  // Mark link request as used
  await markLinkRequestAsUsed(linkRequestId);

  // Generate a character API token
  const { createCharacterToken } = await import("./characterToken");
  const characterToken = await createCharacterToken(characterId);

  return {
    success: true,
    characterToken,
    characterId,
  };
}

/**
 * Get all characters for a user.
 * 
 * @param userId - The user ID
 * @returns Promise resolving to array of characters
 */
export async function getCharactersForUser(userId: string) {
  return prisma.character.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      foundryWorldId: true,
      foundryActorId: true,
      creditBalance: true,
      katastroWorldId: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { name: "asc" },
  });
}

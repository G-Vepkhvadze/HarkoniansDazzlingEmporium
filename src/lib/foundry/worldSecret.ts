/**
 * World secret utilities for Katastro Foundry world pairing.
 * 
 * World secrets are trusted bearer credentials that authenticate requests
 * from the Foundry module. They are NOT proof of Foundry origin (since module
 * code can be inspected), but they do identify a paired Katastro world.
 * 
 * Possession of a worldSecret alone does NOT grant:
 * - Access to player accounts
 * - Access to arbitrary characters
 * - Ability to change credit
 * - Ability to make purchases
 * - DM privileges
 * 
 * DM authorization requires both:
 * 1. A valid Harkonians DM session
 * 2. A valid worldSecret for the Katastro world
 */

import { prisma } from '../prisma';
import { generateSecureToken, hashToken, verifyToken } from '../crypto';

// =============================================
// WORLD SECRET GENERATION
// =============================================

/**
 * Generate a new world secret for Katastro world pairing.
 * 
 * @param dmUserId - The Harkonians User ID of the DM
 * @param foundryWorldId - The Foundry world ID
 * @returns Promise resolving to { raw: string, hash: string, world: KatastroWorld }
 */
export async function generateWorldSecret(
  dmUserId: string,
  foundryWorldId: string
): Promise<{ raw: string; hash: string }> {
  const raw = generateSecureToken(32);
  const hash = await hashToken(raw);
  return { raw, hash };
}

/**
 * Create a new KatastroWorld record and generate its secret.
 * 
 * @param dmUserId - The Harkonians User ID of the DM
 * @param foundryWorldId - The Foundry world ID
 * @returns Promise resolving to the created KatastroWorld
 */
export async function createKatastroWorld(
  dmUserId: string,
  foundryWorldId: string
): Promise<{ world: { id: string; foundryWorldId: string }; rawSecret: string }> {
  const { raw, hash } = await generateWorldSecret(dmUserId, foundryWorldId);
  
  const world = await prisma.katastroWorld.create({
    data: {
      worldSecretHash: hash,
      foundryWorldId,
      dmUserId,
    },
    select: {
      id: true,
      foundryWorldId: true,
    },
  });
  
  return { world, rawSecret: raw };
}

// =============================================
// WORLD SECRET VALIDATION
// =============================================

/**
 * Validate a world secret against the stored hash.
 * 
 * @param inputSecret - The secret provided by the client
 * @param katastroWorldId - The KatastroWorld ID to validate against
 * @returns Promise resolving to true if valid, false otherwise
 */
export async function validateWorldSecret(
  inputSecret: string,
  katastroWorldId: string
): Promise<boolean> {
  const world = await prisma.katastroWorld.findUnique({
    where: { id: katastroWorldId },
    select: { worldSecretHash: true },
  });
  
  if (!world) {
    return false;
  }
  
  return verifyToken(inputSecret, world.worldSecretHash);
}

/**
 * Validate a world secret and return the world if valid.
 * 
 * @param inputSecret - The secret provided by the client
 * @returns Promise resolving to KatastroWorld if valid, null otherwise
 */
export async function getWorldBySecret(
  inputSecret: string
): Promise<{ id: string; foundryWorldId: string; dmUserId: string } | null> {
  const worlds = await prisma.katastroWorld.findMany({
    select: { id: true, foundryWorldId: true, dmUserId: true, worldSecretHash: true },
  });
  
  for (const world of worlds) {
    const isValid = await verifyToken(inputSecret, world.worldSecretHash);
    if (isValid) {
      return {
        id: world.id,
        foundryWorldId: world.foundryWorldId,
        dmUserId: world.dmUserId,
      };
    }
  }
  
  return null;
}

// =============================================
// WORLD MANAGEMENT
// =============================================

/**
 * Get a KatastroWorld by its ID.
 * 
 * @param id - The KatastroWorld ID
 * @returns Promise resolving to the world or null
 */
export async function getKatastroWorld(id: string) {
  return prisma.katastroWorld.findUnique({
    where: { id },
    include: {
      dmUser: {
        select: { id: true, username: true, role: true },
      },
    },
  });
}

/**
 * Get a KatastroWorld by its Foundry world ID.
 * 
 * @param foundryWorldId - The Foundry world ID
 * @returns Promise resolving to the world or null
 */
export async function getKatastroWorldByFoundryId(foundryWorldId: string) {
  return prisma.katastroWorld.findFirst({
    where: { foundryWorldId },
    include: {
      dmUser: {
        select: { id: true, username: true, role: true },
      },
    },
  });
}

/**
 * Check if a Katastro world is already paired.
 * 
 * @returns Promise resolving to true if paired, false otherwise
 */
export async function isKatastroWorldPaired(): Promise<boolean> {
  const count = await prisma.katastroWorld.count();
  return count > 0;
}

/**
 * Remove a KatastroWorld pairing (DM only).
 * This also removes all related data.
 * 
 * @param id - The KatastroWorld ID to remove
 * @returns Promise resolving when removal is complete
 */
export async function removeKatastroWorld(id: string): Promise<void> {
  await prisma.katastroWorld.delete({
    where: { id },
  });
}

/**
 * Remove a KatastroWorld by its world secret (for cleanup).
 * 
 * @param worldSecret - The world secret
 * @returns Promise resolving to true if removed, false if not found
 */
export async function removeKatastroWorldBySecret(worldSecret: string): Promise<boolean> {
  const world = await getWorldBySecret(worldSecret);
  if (!world) {
    return false;
  }
  
  await removeKatastroWorld(world.id);
  return true;
}

// =============================================
// WORLD SECRET EXPIRATION
// =============================================

/**
 * World secrets do not currently expire, but this utility is provided
 * for future use if expiration is added.
 * 
 * @param worldId - The KatastroWorld ID
 * @param newSecret - Optional new secret to rotate to
 * @returns Promise resolving to the new raw secret if generated
 */
export async function rotateWorldSecret(
  worldId: string,
  newSecret?: string
): Promise<string | null> {
  const { raw, hash } = newSecret 
    ? { raw: newSecret, hash: await hashToken(newSecret) }
    : await generateWorldSecret('', '');
  
  await prisma.katastroWorld.update({
    where: { id: worldId },
    data: { worldSecretHash: hash },
  });
  
  return raw;
}

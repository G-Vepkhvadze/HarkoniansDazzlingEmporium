/**
 * Foundry world pairing utilities.
 * 
 * Handles the creation, validation, and management of pairing codes
 * for linking Foundry worlds to Harkonians campaigns.
 */

import { prisma } from "../prisma";
import { generatePairingCode, hashToken, verifyToken } from "../crypto";

// User role type
type UserRole = "PLAYER" | "DM";

// =============================================
// PAIRING CODE CONFIGURATION
// =============================================

/**
 * Pairing code expiration in milliseconds (15 minutes).
 */
export const PAIRING_CODE_EXPIRY_MS = 15 * 60 * 1000;

/**
 * Maximum number of active pairing codes per user.
 */
export const MAX_PAIRING_CODES_PER_USER = 5;

// =============================================
// PAIRING CODE GENERATION
// =============================================

/**
 * Generate a new pairing code for world pairing.
 * 
 * @param dmUserId - The Harkonians DM user ID
 * @param katastroWorldId - Optional existing KatastroWorld ID for re-pairing
 * @returns Promise resolving to { code: string, codeHash: string, requestId: string }
 */
export async function generatePairingRequest(
  dmUserId: string,
  katastroWorldId?: string
): Promise<{
  code: string;
  codeHash: string;
  requestId: string;
}> {
  // Verify the user is a DM
  const user = await prisma.user.findUnique({
    where: { id: dmUserId },
    select: { role: true },
  });

  if (!user || user.role !== "DM") {
    throw new Error("Only DM users can create pairing codes");
  }

  // Check existing world if provided
  if (katastroWorldId) {
    const existingWorld = await prisma.katastroWorld.findUnique({
      where: { id: katastroWorldId },
    });
    if (!existingWorld) {
      throw new Error("Specified Katastro world not found");
    }
  }

  // Generate a human-readable pairing code
  const code = generatePairingCode();
  const codeHash = await hashToken(code);

  // Generate a request ID for tracking
  const requestId = crypto.randomUUID();

  return { code, codeHash, requestId };
}

/**
 * Create and store a new pairing code request.
 * 
 * @param dmUserId - The Harkonians DM user ID
 * @param katastroWorldId - Optional existing KatastroWorld ID
 * @returns Promise resolving to { code: string, requestId: string }
 */
export async function createPairingCode(
  dmUserId: string,
  katastroWorldId?: string
): Promise<{ code: string; requestId: string }> {
  // Clean up expired pairing codes for this user first
  await cleanupExpiredPairingCodes(dmUserId);

  // Generate the pairing code
  const { code, codeHash, requestId } = await generatePairingRequest(
    dmUserId,
    katastroWorldId
  );

  // Calculate expiration
  const expiresAt = new Date(Date.now() + PAIRING_CODE_EXPIRY_MS);

  // Create the pairing code record
  await prisma.foundryPairingCode.create({
    data: {
      codeHash,
      userId: dmUserId,
      katastroWorldId,
      expiresAt,
    },
  });

  return { code, requestId };
}

// =============================================
// PAIRING CODE VALIDATION
// =============================================

/**
 * Validate a pairing code and return the associated data.
 * 
 * @param code - The pairing code to validate
 * @returns Promise resolving to pairing code data if valid, null otherwise
 */
export async function validatePairingCode(
  code: string
): Promise<{
  id: string;
  userId: string;
  katastroWorldId: string | null;
  used: boolean;
  expiresAt: Date;
} | null> {
  const codeHash = await hashToken(code);

  const pairingCode = await prisma.foundryPairingCode.findUnique({
    where: { codeHash },
  });

  if (!pairingCode) {
    return null;
  }

  // Check if expired
  if (pairingCode.expiresAt < new Date()) {
    return null;
  }

  // Check if already used
  if (pairingCode.used) {
    return null;
  }

  return {
    id: pairingCode.id,
    userId: pairingCode.userId,
    katastroWorldId: pairingCode.katastroWorldId,
    used: pairingCode.used,
    expiresAt: pairingCode.expiresAt,
  };
}

/**
 * Mark a pairing code as used.
 * 
 * @param code - The pairing code or codeHash
 * @returns Promise resolving to true if marked, false if not found
 */
export async function markPairingCodeAsUsed(code: string): Promise<boolean> {
  const codeHash = await hashToken(code);

  try {
    await prisma.foundryPairingCode.update({
      where: { codeHash },
      data: { used: true },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Clean up expired pairing codes.
 * 
 * @returns Promise resolving to the count of codes removed
 */
export async function cleanupExpiredPairingCodes(
  userId?: string
): Promise<number> {
  const where: Record<string, unknown> = {
    expiresAt: { lt: new Date() },
  };

  if (userId) {
    where.userId = userId;
  }

  const result = await prisma.foundryPairingCode.deleteMany({
    where,
  });

  return result.count;
}

// =============================================
// WORLD PAIRING MANAGEMENT
// =============================================

/**
 * Pair a Foundry world with a Katastro world using a valid pairing code.
 * 
 * @param pairingCode - The valid pairing code
 * @param foundryWorldId - The Foundry world ID to pair
 * @returns Promise resolving to { success: boolean, world: { id: string; foundryWorldId: string }, worldSecret?: string, error?: string }
 */
export async function completeWorldPairing(
  pairingCode: string,
  foundryWorldId: string
): Promise<{
  success: boolean;
  world: { id: string; foundryWorldId: string };
  worldSecret?: string;
  error?: string;
}> {
  // Validate the pairing code
  const pairingData = await validatePairingCode(pairingCode);

  if (!pairingData) {
    return {
      success: false,
      world: { id: "", foundryWorldId: "" },
      error: "Invalid, expired, or already used pairing code",
    };
  }

  // Mark the code as used
  await markPairingCodeAsUsed(pairingCode);

  // Create or update the KatastroWorld
  let world: { id: string; foundryWorldId: string };

  if (pairingData.katastroWorldId) {
    // Update existing world with new Foundry ID
    world = await prisma.katastroWorld.update({
      where: { id: pairingData.katastroWorldId },
      data: {
        foundryWorldId,
        dmUserId: pairingData.userId,
      },
      select: {
        id: true,
        foundryWorldId: true,
      },
    });

    return {
      success: true,
      world,
    };
  } else {
    // Generate a new world secret
    const { raw: rawSecret, hash: secretHash } = await (
      await import("../crypto")
    ).generateWorldSecret();

    // Create a new KatastroWorld
    world = await prisma.katastroWorld.create({
      data: {
        worldSecretHash: secretHash,
        foundryWorldId,
        dmUserId: pairingData.userId,
      },
      select: {
        id: true,
        foundryWorldId: true,
      },
    });

    // Return the raw secret for the Foundry module to store
    // Note: This is returned to the caller - must be handled securely
    return {
      success: true,
      world,
      worldSecret: rawSecret,
    };
  }
}

/**
 * Get all pairing codes for a user.
 * 
 * @param userId - The user ID
 * @returns Promise resolving to array of pairing codes
 */
export async function getPairingCodesForUser(userId: string) {
  return prisma.foundryPairingCode.findMany({
    where: { userId },
    select: {
      id: true,
      katastroWorldId: true,
      used: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Revoke/unuse a pairing code.
 * 
 * @param codeId - The pairing code ID
 * @returns Promise resolving to true if revoked
 */
export async function revokePairingCode(codeId: string): Promise<boolean> {
  try {
    await prisma.foundryPairingCode.delete({
      where: { id: codeId },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a world is already paired.
 * 
 * @param foundryWorldId - The Foundry world ID
 * @returns Promise resolving to true if paired
 */
export async function isWorldAlreadyPaired(foundryWorldId: string): Promise<boolean> {
  const count = await prisma.katastroWorld.count({
    where: { foundryWorldId },
  });
  return count > 0;
}

// =============================================
// PAIRING STATUS
// =============================================

/**
 * Get the pairing status for the current Katastro installation.
 * 
 * @returns Promise resolving to { isPaired: boolean, world?: KatastroWorld }
 */
export async function getPairingStatus() {
  const world = await prisma.katastroWorld.findFirst({
    select: {
      id: true,
      foundryWorldId: true,
      dmUserId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    isPaired: !!world,
    world,
  };
}

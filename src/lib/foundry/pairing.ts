/**
 * Foundry world pairing utilities.
 * 
 * Handles the creation, validation, and management of pairing codes
 * for linking Foundry worlds to Harkonians campaigns.
 */

import { prisma } from "../prisma";
import { generatePairingCode, hashToken, verifyToken, isValidPairingCodeFormat } from "../crypto";

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

export async function validatePairingCode(
    code: string
): Promise<{
  id: string;
  userId: string;
  katastroWorldId: string | null;
  used: boolean;
  expiresAt: Date;
} | null> {
  const normalizedCode = code.trim().toUpperCase();

  if (!isValidPairingCodeFormat(normalizedCode)) {
    return null;
  }

  const candidates = await prisma.foundryPairingCode.findMany({
    where: {
      used: false,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  for (const candidate of candidates) {
    if (await verifyToken(normalizedCode, candidate.codeHash)) {
      return {
        id: candidate.id,
        userId: candidate.userId,
        katastroWorldId: candidate.katastroWorldId,
        used: candidate.used,
        expiresAt: candidate.expiresAt,
      };
    }
  }

  return null;
}
/**
 * Mark a pairing code as used.
 *
 * @returns Promise resolving to true if marked, false if not found
 * @param pairingCodeId
 */
export async function markPairingCodeAsUsed(
    pairingCodeId: string
): Promise<boolean> {
  try {
    const result = await prisma.foundryPairingCode.updateMany({
      where: {
        id: pairingCodeId,
        used: false,
        expiresAt: {
          gt: new Date()
        }
      },
      data: {
        used: true
      }
    });

    return result.count === 1;
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
  world?: {
    id: string;
    foundryWorldId: string;
  };
  worldSecret?: string;
  error?: string;
}> {
  const normalizedPairingCode = pairingCode?.trim().toUpperCase();
  const normalizedFoundryWorldId = foundryWorldId?.trim();

  if (!normalizedPairingCode) {
    return {
      success: false,
      error: "Pairing code is required."
    };
  }

  if (!normalizedFoundryWorldId) {
    return {
      success: false,
      error: "Foundry world ID is required."
    };
  }

  const pairingData = await validatePairingCode(normalizedPairingCode);

  if (!pairingData) {
    return {
      success: false,
      error: "Invalid, expired, or already used pairing code."
    };
  }

  // Prevent accidentally pairing a world a second time,
  // unless this pairing code is specifically for an existing Katastro world.
  if (
      !pairingData.katastroWorldId &&
      await isWorldAlreadyPaired(normalizedFoundryWorldId)
  ) {
    return {
      success: false,
      error: "This Foundry world is already paired."
    };
  }

  const { raw: worldSecret, hash: worldSecretHash } =
      await (await import("../crypto")).generateWorldSecret();

  let world;

  if (pairingData.katastroWorldId) {
    world = await prisma.katastroWorld.update({
      where: {
        id: pairingData.katastroWorldId
      },
      data: {
        foundryWorldId: normalizedFoundryWorldId,
        dmUserId: pairingData.userId,
        worldSecretHash
      },
      select: {
        id: true,
        foundryWorldId: true
      }
    });
  } else {
    world = await prisma.katastroWorld.create({
      data: {
        worldSecretHash,
        foundryWorldId: normalizedFoundryWorldId,
        dmUserId: pairingData.userId
      },
      select: {
        id: true,
        foundryWorldId: true
      }
    });
  }

  // Consume the exact pairing record we validated.
  const consumed = await prisma.foundryPairingCode.updateMany({
    where: {
      id: pairingData.id,
      used: false,
      expiresAt: {
        gt: new Date()
      }
    },
    data: {
      used: true
    }
  });

  if (consumed.count !== 1) {
    return {
      success: false,
      error: "Pairing code is no longer valid."
    };
  }

  return {
    success: true,
    world,
    worldSecret
  };
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

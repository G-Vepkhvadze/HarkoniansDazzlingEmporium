import bcrypt from "bcryptjs";

// Default cost factor for bcrypt hashing
// 12 is a good balance between security and performance
const SALT_ROUNDS = 12;

/**
 * Hash a plaintext password using bcrypt.
 * @param plaintext - The plaintext password to hash
 * @returns Promise resolving to the hashed password
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

/**
 * Verify a plaintext password against a bcrypt hash.
 * @param plaintext - The plaintext password to verify
 * @param hash - The bcrypt hash to compare against
 * @returns Promise resolving to true if the password matches, false otherwise
 */
export async function verifyPassword(
  plaintext: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

/**
 * Check if a password needs to be rehashed (e.g., if the cost factor is outdated).
 * This is useful for password rotation.
 * @param hash - The stored bcrypt hash
 * @returns Promise resolving to true if the password should be rehashed
 */
export async function needsRehash(hash: string): Promise<boolean> {
  // Extract the cost factor from the hash
  // bcrypt hashes start with $2a$ or $2b$ followed by cost factor
  const costMatch = hash.match(/\$2[ab]\$(\d{2})/);
  if (!costMatch) {
    // If we can't parse the hash, it might be from an older algorithm
    return true;
  }

  const currentCost = parseInt(costMatch[1], 10);
  return currentCost < SALT_ROUNDS;
}

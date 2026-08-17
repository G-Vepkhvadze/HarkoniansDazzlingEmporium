/**
 * Cryptographic utilities for token generation and verification.
 * 
 * This module provides secure token generation and hashing for:
 * - World secrets
 * - Character API tokens
 * - Pairing codes
 * - Auth codes
 * - Impersonation tokens
 * 
 * All long-lived bearer secrets are stored as bcrypt hashes in the database.
 * Raw secrets are returned once at creation time and must be stored securely by clients.
 */

import * as bcrypt from 'bcryptjs';

// =============================================
// TOKEN GENERATION
// =============================================

/**
 * Generate a cryptographically secure random token.
 * Uses Node.js crypto.getRandomValues for entropy.
 * 
 * @param byteLength - Number of random bytes (default: 32 = 256 bits)
 * @returns Hex-encoded random string (64 chars for 32 bytes)
 */
export function generateSecureToken(byteLength: number = 32): string {
  const buffer = new Uint8Array(byteLength);
  
  // crypto.getRandomValues is available in Node.js 15+ and browsers
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buffer);
  } else {
    // Fallback for environments without crypto.getRandomValues
    // This should not happen in our deployment targets
    for (let i = 0; i < byteLength; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
  }
  
  // Convert to hex string
  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a human-readable pairing code.
 * Format: KAT-XXXX-XXXX (e.g., KAT-7X9-B2Y-4Q8)
 * 
 * @returns Human-readable code string
 */
export function generatePairingCode(): string {
  const buffer = new Uint8Array(8); // 64 bits = 8 bytes
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buffer);
  } else {
    for (let i = 0; i < 8; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
  }
  
  // Convert to base36 (0-9, A-Z) for human-readable format
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const segments: string[] = [];
  
  for (let i = 0; i < 8; i += 2) {
    const bytes = buffer.slice(i, i + 2);
    const value = bytes[0] + (bytes[1] << 8);
    const segment = [];
    for (let j = 0; j < 3; j++) {
      segment.push(chars[(value >> (8 - j * 6)) & 0x3F]);
    }
    segments.push(segment.join(''));
  }
  
  return `KAT-${segments.slice(0, 2).join('-')}-${segments.slice(2).join('-')}`;
}

// =============================================
// TOKEN HASHING (for storage)
// =============================================

/**
 * Bcrypt work factor for token hashing.
 * 10 is a reasonable default - balances security and performance.
 * Can be increased if needed (higher = more secure but slower).
 */
const BCRYPT_WORK_FACTOR = 10;

/**
 * Hash a token for secure storage using bcrypt.
 * 
 * @param token - The raw token to hash
 * @returns Promise resolving to the bcrypt hash
 */
export async function hashToken(token: string): Promise<string> {
  return await bcrypt.hash(token, BCRYPT_WORK_FACTOR);
}

/**
 * Verify a token against its stored hash using bcrypt.
 * 
 * @param input - The raw token to verify
 * @param storedHash - The stored bcrypt hash
 * @returns Promise resolving to true if valid, false otherwise
 */
export async function verifyToken(input: string, storedHash: string): Promise<boolean> {
  return await bcrypt.compare(input, storedHash);
}

// =============================================
// VALIDATION UTILITIES
// =============================================

/**
 * Validate that a string is a valid UUID v4.
 * 
 * @param id - The string to validate
 * @returns true if valid UUID v4
 */
export function isValidUuid(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Validate that a string is a valid hex-encoded token.
 * 
 * @param token - The token to validate
 * @param length - Expected length (default: 64 for 32-byte hex)
 * @returns true if valid hex string of correct length
 */
export function isValidHexToken(token: string, length: number = 64): boolean {
  if (token.length !== length) {
    return false;
  }
  const hexRegex = /^[0-9a-f]+$/i;
  return hexRegex.test(token);
}

/**
 * Validate that a string is a valid pairing code format.
 * Format: KAT-XXXX-XXXX-XXXX (variable length segments)
 * 
 * @param code - The pairing code to validate
 * @returns true if valid format
 */
export function isValidPairingCodeFormat(code: string): boolean {
  const pairingCodeRegex = /^KAT-[A-Z0-9]{3,4}(?:-[A-Z0-9]{3,4}){2,3}$/i;
  return pairingCodeRegex.test(code);
}

// =============================================
// WORLD SECRET UTILITIES
// =============================================

/**
 * Generate a new world secret for Katastro world pairing.
 * 
 * @returns {raw: string, hash: Promise<string>} - Raw secret and promise for hash
 */
export async function generateWorldSecret(): Promise<{ raw: string; hash: string }> {
  const raw = generateSecureToken(32);
  const hash = await hashToken(raw);
  return { raw, hash };
}

/**
 * Validate a world secret against the stored hash.
 * 
 * @param inputSecret - The secret provided by the client
 * @param storedHash - The hashed secret from the database
 * @returns Promise resolving to true if valid
 */
export async function validateWorldSecret(inputSecret: string, storedHash: string): Promise<boolean> {
  return verifyToken(inputSecret, storedHash);
}

// =============================================
// CONSTANTS
// =============================================

/**
 * Default token length in bytes (256 bits).
 */
export const DEFAULT_TOKEN_BYTE_LENGTH = 32;

/**
 * Default token length in hex characters (64 chars).
 */
export const DEFAULT_TOKEN_HEX_LENGTH = 64;

/**
 * Pairing code length in characters (e.g., "KAT-7X9-B2Y-4Q8" = 15 chars).
 */
export const PAIRING_CODE_LENGTH = 15;

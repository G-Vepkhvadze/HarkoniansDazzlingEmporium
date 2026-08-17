/**
 * Foundry integration utilities index.
 * 
 * Re-exports all utilities for convenient importing.
 */

// Crypto utilities (used by Foundry utilities)
export {
  generateSecureToken,
  generatePairingCode,
  hashToken,
  verifyToken,
  isValidUuid,
  isValidHexToken,
  isValidPairingCodeFormat,
  DEFAULT_TOKEN_BYTE_LENGTH,
  DEFAULT_TOKEN_HEX_LENGTH,
  PAIRING_CODE_LENGTH,
} from '../crypto';

// World secret utilities
export {
  generateWorldSecret,
  createKatastroWorld,
  validateWorldSecret,
  getWorldBySecret,
  getKatastroWorld,
  getKatastroWorldByFoundryId,
  isKatastroWorldPaired,
  removeKatastroWorld,
  removeKatastroWorldBySecret,
  rotateWorldSecret,
} from './worldSecret';

// Character token utilities
export {
  CHARACTER_TOKEN_EXPIRY_DAYS,
  CHARACTER_TOKEN_EXPIRY_MS,
  generateCharacterToken,
  createCharacterToken,
  validateCharacterToken,
  getCharacterIdFromToken,
  revokeCharacterToken,
  revokeAllCharacterTokens,
  revokeAllUserCharacterTokens,
  cleanupExpiredCharacterTokens,
  requireCharacterToken,
  extractTokenFromRequest,
  requireFoundryCharacterToken,
} from './characterToken';

// World secret middleware
export {
  extractWorldSecret,
  validateWorldSecretFromRequest,
  requireWorldSecret,
  requireDmWithWorldSecret,
  validateWorldSecretForWorld,
  requireWorldSecretForWorld,
  requireFullFoundryAuthorization,
  requireDmFoundryAuthorization,
} from './worldSecretMiddleware';

// Pairing utilities
export {
  PAIRING_CODE_EXPIRY_MS,
  MAX_PAIRING_CODES_PER_USER,
  generatePairingRequest,
  createPairingCode,
  validatePairingCode,
  markPairingCodeAsUsed,
  cleanupExpiredPairingCodes,
  completeWorldPairing,
  getPairingCodesForUser,
  revokePairingCode,
  isWorldAlreadyPaired,
  getPairingStatus,
} from './pairing';

// Linking utilities
export {
  LINK_REQUEST_EXPIRY_MS,
  AUTH_CODE_EXPIRY_MS,
  createLinkRequest,
  validateLinkRequest,
  markLinkRequestAsUsed,
  completeCharacterLinking,
  cleanupExpiredLinkRequests,
  createAuthCode,
  validateAuthCode,
  markAuthCodeAsUsed,
  exchangeAuthCodeForToken,
  getCharactersForUser,
} from './linking';

// Item publishing utilities
export {
  MAX_FOUNDRY_ITEM_DATA_SIZE,
  validatePublishRequest,
  sanitizeFoundryItemData,
  mapRarity,
  mapType,
  publishFoundryItem,
  updateFoundryItem,
  itemExists,
  getItemById,
} from './items';

export type {
  PublishFoundryItemRequest,
  PublishFoundryItemResult,
  FoundryItemResponse,
} from './items';

export type { FoundryAuthorization } from './worldSecretMiddleware';

// Note: extractWorldSecretFromRequest is re-exported from worldSecretMiddleware

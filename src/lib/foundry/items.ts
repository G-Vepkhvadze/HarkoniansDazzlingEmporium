/**
 * Foundry Item publishing utilities for Harkonians Store.
 * 
 * Handles publishing of Foundry D&D 5e Items to the Harkonians storefront
 * with complete preservation of Foundry item data in the foundryItemData field.
 */

import { prisma } from '../prisma';
import { ItemRarity, ItemType, Prisma } from '@prisma/client';

// Type for Prisma JSON input
type InputJsonValue = Prisma.InputJsonValue;

// Maximum size for foundryItemData JSON payload (5MB)
const MAX_FOUNDRY_ITEM_DATA_SIZE = 5 * 1024 * 1024;

// =============================================
// VALIDATION TYPES
// =============================================

/**
 * Request payload for publishing a Foundry item.
 * This matches the expected format from the Foundry module.
 */
export interface PublishFoundryItemRequest {
  // Foundry identification
  foundryWorldId: string;
  foundryItemId: string;
  foundryItemUuid: string;
  foundrySystemId: string;
  foundrySystemVersion?: string;

  // Store metadata (mapped to Item fields)
  name: string;
  description?: string;
  rarity?: ItemRarity | string;
  type: ItemType | string;
  image?: string;

  // Pricing and stock
  priceCp?: number;
  stock?: number;
  deal?: boolean;
  discountPercent?: number;

  // Complete Foundry item data
  foundryItemData: Record<string, unknown>;
}

/**
 * Validated result for publishing a Foundry item.
 */
export interface PublishFoundryItemResult {
  success: true;
  item: {
    id: string;
    name: string;
    type: string;
    rarity: string;
    price: number;
    stock: number;
    foundryWorldId: string;
    foundryItemId: string;
    foundryItemUuid: string;
    foundrySystemId: string;
    foundrySystemVersion?: string;
  };
}

/**
 * Response for foundry item operations.
 */
export interface FoundryItemResponse {
  success: boolean;
  item?: {
    id: string;
    name: string;
    type: string;
    rarity: string;
    price: number;
    stock: number;
  };
  error?: string;
}

// =============================================
// VALIDATION UTILITIES
// =============================================

/**
 * Validate the request payload for publishing a Foundry item.
 * 
 * @param payload - The raw request payload
 * @returns Validation result with parsed data or error
 */
export function validatePublishRequest(
  payload: unknown
): { valid: true; data: PublishFoundryItemRequest } | { valid: false; error: string } {
  // Check if payload is an object
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const body = payload as Record<string, unknown>;

  // Required fields
  const requiredFields = ['foundryWorldId', 'foundryItemId', 'foundryItemUuid', 'foundrySystemId', 'name', 'type', 'foundryItemData'];
  for (const field of requiredFields) {
    if (!(field in body) || body[field] === undefined || body[field] === null) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }

  // Type checking
  if (typeof body.foundryWorldId !== 'string' || body.foundryWorldId.trim() === '') {
    return { valid: false, error: 'foundryWorldId must be a non-empty string' };
  }

  if (typeof body.foundryItemId !== 'string' || body.foundryItemId.trim() === '') {
    return { valid: false, error: 'foundryItemId must be a non-empty string' };
  }

  if (typeof body.foundryItemUuid !== 'string' || body.foundryItemUuid.trim() === '') {
    return { valid: false, error: 'foundryItemUuid must be a non-empty string' };
  }

  if (typeof body.foundrySystemId !== 'string' || body.foundrySystemId.trim() === '') {
    return { valid: false, error: 'foundrySystemId must be a non-empty string' };
  }

  if (typeof body.name !== 'string' || body.name.trim() === '') {
    return { valid: false, error: 'name must be a non-empty string' };
  }

  if (typeof body.type !== 'string' || body.type.trim() === '') {
    return { valid: false, error: 'type must be a non-empty string' };
  }

  // Validate foundryItemData is an object
  if (!body.foundryItemData || typeof body.foundryItemData !== 'object' || Array.isArray(body.foundryItemData)) {
    return { valid: false, error: 'foundryItemData must be a JSON object' };
  }

  // Validate foundryItemData size
  try {
    const jsonString = JSON.stringify(body.foundryItemData);
    if (jsonString.length > MAX_FOUNDRY_ITEM_DATA_SIZE) {
      return { valid: false, error: `foundryItemData exceeds maximum size of ${MAX_FOUNDRY_ITEM_DATA_SIZE / (1024 * 1024)}MB` };
    }
  } catch {
    return { valid: false, error: 'foundryItemData could not be serialized to JSON' };
  }

  // Validate optional fields
  if ('description' in body && body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') {
      return { valid: false, error: 'description must be a string if provided' };
    }
  }

  if ('rarity' in body && body.rarity !== undefined && body.rarity !== null) {
    if (typeof body.rarity !== 'string') {
      return { valid: false, error: 'rarity must be a string if provided' };
    }
  }

  if ('image' in body && body.image !== undefined && body.image !== null) {
    if (typeof body.image !== 'string') {
      return { valid: false, error: 'image must be a string if provided' };
    }
  }

  if ('priceCp' in body && body.priceCp !== undefined && body.priceCp !== null) {
    if (typeof body.priceCp !== 'number' || !Number.isFinite(body.priceCp) || body.priceCp < 0) {
      return { valid: false, error: 'priceCp must be a non-negative number if provided' };
    }
  }

  if ('stock' in body && body.stock !== undefined && body.stock !== null) {
    if (typeof body.stock !== 'number' || !Number.isInteger(body.stock) || body.stock < 0) {
      return { valid: false, error: 'stock must be a non-negative integer if provided' };
    }
  }

  if ('deal' in body && body.deal !== undefined && body.deal !== null) {
    if (typeof body.deal !== 'boolean') {
      return { valid: false, error: 'deal must be a boolean if provided' };
    }
  }

  if ('discountPercent' in body && body.discountPercent !== undefined && body.discountPercent !== null) {
    if (typeof body.discountPercent !== 'number' || !Number.isFinite(body.discountPercent) || body.discountPercent < 0 || body.discountPercent > 100) {
      return { valid: false, error: 'discountPercent must be a number between 0 and 100 if provided' };
    }
  }

  if ('foundrySystemVersion' in body && body.foundrySystemVersion !== undefined && body.foundrySystemVersion !== null) {
    if (typeof body.foundrySystemVersion !== 'string') {
      return { valid: false, error: 'foundrySystemVersion must be a string if provided' };
    }
  }

  return {
    valid: true,
    data: {
      foundryWorldId: body.foundryWorldId.trim(),
      foundryItemId: body.foundryItemId.trim(),
      foundryItemUuid: body.foundryItemUuid.trim(),
      foundrySystemId: body.foundrySystemId.trim(),
      foundrySystemVersion: body.foundrySystemVersion ? (body.foundrySystemVersion as string).trim() : undefined,
      name: body.name.trim(),
      description: body.description ? (body.description as string).trim() : undefined,
      rarity: body.rarity ? (body.rarity as string).trim() : undefined,
      type: (body.type as string).trim(),
      image: body.image ? (body.image as string).trim() : undefined,
      priceCp: body.priceCp as number | undefined,
      stock: body.stock as number | undefined,
      deal: body.deal as boolean | undefined,
      discountPercent: body.discountPercent as number | undefined,
      foundryItemData: body.foundryItemData as Record<string, unknown>,
    },
  };
}

/**
 * Sanitize the foundryItemData to ensure it's safe to store.
 * This does NOT strip legitimate D&D 5e fields - it only ensures the data is valid JSON.
 * 
 * @param data - The foundry item data to sanitize
 * @returns Sanitized data
 */
export function sanitizeFoundryItemData(data: Record<string, unknown>): Record<string, unknown> {
  // We trust the JSON parser to have already validated the structure
  // The main concern is ensuring we can store it safely
  try {
    // Deep clone to prevent any prototype pollution
    return JSON.parse(JSON.stringify(data));
  } catch {
    // If we can't serialize/deserialize, return empty object
    return {};
  }
}

/**
 * Map string rarity to ItemRarity enum.
 * 
 * @param rarity - The rarity string (case insensitive)
 * @returns The ItemRarity enum value
 */
export function mapRarity(rarity?: string): ItemRarity {
  if (!rarity) return ItemRarity.COMMON;
  
  const normalized = rarity.toUpperCase();
  const rarityMap: Record<string, ItemRarity> = {
    COMMON: ItemRarity.COMMON,
    UNCOMMON: ItemRarity.UNCOMMON,
    RARE: ItemRarity.RARE,
    VERY_RARE: ItemRarity.VERY_RARE,
    LEGENDARY: ItemRarity.LEGENDARY,
  };
  
  return rarityMap[normalized] || ItemRarity.COMMON;
}

/**
 * Map string type to ItemType enum.
 * 
 * @param type - The type string (case insensitive)
 * @returns The ItemType enum value
 */
export function mapType(type: string): ItemType {
  if (!type) return ItemType.ACCESSORY;
  
  const normalized = type.toUpperCase();
  const typeMap: Record<string, ItemType> = {
    WEAPON: ItemType.WEAPON,
    ARMOR: ItemType.ARMOR,
    ACCESSORY: ItemType.ACCESSORY,
    SCROLL: ItemType.SCROLL,
    POTION: ItemType.POTION,
  };
  
  return typeMap[normalized] || ItemType.ACCESSORY;
}

// =============================================
// CORE PUBLISHING LOGIC
// =============================================

/**
 * Publish a Foundry item to the Harkonians store.
 * 
 * This creates a new Item record with:
 * - Store metadata (name, description, rarity, type, image, price, stock)
 * - Complete Foundry item data in foundryItemData field
 * - Source metadata for tracking
 * 
 * @param request - The validated publish request
 * @param worldId - The KatastroWorld ID (from world secret validation)
 * @param dmUserId - The DM user ID (from world secret validation)
 * @returns Promise resolving to the created item
 */
export async function publishFoundryItem(
  request: PublishFoundryItemRequest,
  worldId: string,
  dmUserId: string
): Promise<PublishFoundryItemResult> {
  // Sanitize the Foundry item data
  const sanitizedData = sanitizeFoundryItemData(request.foundryItemData);

  // Enrich the foundryItemData with source metadata for tracking
  const enrichedData = {
    ...sanitizedData,
    _harkoniansMetadata: {
      foundryWorldId: request.foundryWorldId,
      foundryItemId: request.foundryItemId,
      foundryItemUuid: request.foundryItemUuid,
      foundrySystemId: request.foundrySystemId,
      foundrySystemVersion: request.foundrySystemVersion,
      harkoniansWorldId: worldId,
      publishedBy: dmUserId,
      publishedAt: new Date().toISOString(),
    },
  };

  // Build the Item data
  const itemData = {
    name: request.name,
    description: request.description || '',
    rarity: mapRarity(request.rarity),
    type: mapType(request.type),
    image: request.image || '',
    price: request.priceCp || 0,
    deal: request.deal || false,
    discountPercent: request.discountPercent || 0,
    stock: request.stock || 0,
    foundryItemData: enrichedData as InputJsonValue,
  };

  // Create the item
  const item = await prisma.item.create({
    data: itemData,
    select: {
      id: true,
      name: true,
      type: true,
      rarity: true,
      price: true,
      stock: true,
      foundryItemData: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    success: true,
    item: {
      id: item.id,
      name: item.name,
      type: item.type,
      rarity: item.rarity,
      price: item.price,
      stock: item.stock,
      foundryWorldId: request.foundryWorldId,
      foundryItemId: request.foundryItemId,
      foundryItemUuid: request.foundryItemUuid,
      foundrySystemId: request.foundrySystemId,
      foundrySystemVersion: request.foundrySystemVersion,
    },
  };
}

/**
 * Update an existing Foundry item in the Harkonians store.
 * 
 * This updates the Item record while preserving:
 * - The existing foundryItemData._harkoniansMetadata for source tracking
 * - Purchase records (which are immutable)
 * 
 * @param itemId - The Item ID to update
 * @param request - The validated update request
 * @param worldId - The KatastroWorld ID (from world secret validation)
 * @param dmUserId - The DM user ID (from world secret validation)
 * @returns Promise resolving to the updated item
 */
export async function updateFoundryItem(
  itemId: string,
  request: PublishFoundryItemRequest,
  worldId: string,
  dmUserId: string
): Promise<PublishFoundryItemResult> {
  // First, get the existing item to preserve metadata
  const existingItem = await prisma.item.findUnique({
    where: { id: itemId },
    select: { foundryItemData: true },
  });

  if (!existingItem) {
    throw new Error(`Item with ID ${itemId} not found`);
  }

  // Sanitize the Foundry item data
  const sanitizedData = sanitizeFoundryItemData(request.foundryItemData);

  // Preserve existing Harkonians metadata and update with new data
  const existingMetadata = (existingItem.foundryItemData as Record<string, unknown>)?._harkoniansMetadata as Record<string, unknown> || {};
  const enrichedData = {
    ...sanitizedData,
    _harkoniansMetadata: {
      ...existingMetadata,
      foundryWorldId: request.foundryWorldId,
      foundryItemId: request.foundryItemId,
      foundryItemUuid: request.foundryItemUuid,
      foundrySystemId: request.foundrySystemId,
      foundrySystemVersion: request.foundrySystemVersion,
      harkoniansWorldId: worldId,
      updatedBy: dmUserId,
      updatedAt: new Date().toISOString(),
    },
  };

  // Build the Item data
  const itemData = {
    name: request.name,
    description: request.description || '',
    rarity: mapRarity(request.rarity),
    type: mapType(request.type),
    image: request.image || '',
    price: request.priceCp || 0,
    deal: request.deal || false,
    discountPercent: request.discountPercent || 0,
    stock: request.stock || 0,
    foundryItemData: enrichedData as InputJsonValue,
  };

  // Update the item
  const item = await prisma.item.update({
    where: { id: itemId },
    data: itemData,
    select: {
      id: true,
      name: true,
      type: true,
      rarity: true,
      price: true,
      stock: true,
      foundryItemData: true,
      updatedAt: true,
    },
  });

  return {
    success: true,
    item: {
      id: item.id,
      name: item.name,
      type: item.type,
      rarity: item.rarity,
      price: item.price,
      stock: item.stock,
      foundryWorldId: request.foundryWorldId,
      foundryItemId: request.foundryItemId,
      foundryItemUuid: request.foundryItemUuid,
      foundrySystemId: request.foundrySystemId,
      foundrySystemVersion: request.foundrySystemVersion,
    },
  };
}

/**
 * Check if an item ID exists and is accessible.
 * 
 * @param itemId - The Item ID to check
 * @returns Promise resolving to true if the item exists
 */
export async function itemExists(itemId: string): Promise<boolean> {
  const count = await prisma.item.count({
    where: { id: itemId },
  });
  return count > 0;
}

/**
 * Get an item by ID with full details.
 * 
 * @param itemId - The Item ID to get
 * @returns Promise resolving to the item or null
 */
export async function getItemById(itemId: string) {
  return prisma.item.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      image: true,
      name: true,
      description: true,
      rarity: true,
      type: true,
      price: true,
      deal: true,
      discountPercent: true,
      stock: true,
      foundryItemData: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// Maximum payload size constant
export { MAX_FOUNDRY_ITEM_DATA_SIZE };

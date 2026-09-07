/**
 * Shared label constants for item rarities and types.
 * Used across components to ensure consistency.
 */

import type { ItemRarity, ItemType } from "@prisma/client";

// Rarity labels for display
// Matches the ItemRarity enum from Prisma schema
export const rarityLabels: Record<ItemRarity, string> = {
  COMMON: "Common",
  UNCOMMON: "Uncommon",
  RARE: "Rare",
  VERY_RARE: "Very Rare",
  LEGENDARY: "Legendary",
  ARTIFACT: "Artifact",
  UNIQUE: "Unique",
} as const;

// Type labels for display
// Matches the ItemType enum from Prisma schema
export const typeLabels: Record<ItemType, string> = {
  WEAPON: "Weapon",
  EQUIPMENT: "Equipment",
  CONSUMABLE: "Consumable",
  TOOL: "Tool",
  LOOT: "Loot",
  CONTAINER: "Container",
  SPELL: "Spell",
  FEAT: "Feat",
} as const;

// Legacy type mappings for backward compatibility with existing data
export const legacyTypeLabels: Record<string, string> = {
  ARMOR: "Equipment",
  ACCESSORY: "Equipment",
  SCROLL: "Consumable",
  POTION: "Consumable",
} as const;

/**
 * Get display label for a rarity value.
 * Returns the label or the raw value if not found.
 */
export function getRarityLabel(rarity: string): string {
  return rarityLabels[rarity as ItemRarity] ?? rarity;
}

/**
 * Get display label for a type value.
 * Checks legacy mappings first, then standard types.
 */
export function getTypeLabel(type: string): string {
  return legacyTypeLabels[type] ?? typeLabels[type as ItemType] ?? type;
}

/**
 * Rarity options for filter dropdowns.
 * Includes all rarity values from the enum.
 */
export const rarityOptions: Array<{ label: string; value: ItemRarity }> = [
  { label: "Common", value: "COMMON" },
  { label: "Uncommon", value: "UNCOMMON" },
  { label: "Rare", value: "RARE" },
  { label: "Very Rare", value: "VERY_RARE" },
  { label: "Legendary", value: "LEGENDARY" },
  { label: "Artifact", value: "ARTIFACT" },
  { label: "Unique", value: "UNIQUE" },
] as const;

/**
 * Type options for filter dropdowns.
 * Includes all type values from the enum.
 */
export const typeOptions: Array<{ label: string; value: ItemType }> = [
  { label: "Weapon", value: "WEAPON" },
  { label: "Equipment", value: "EQUIPMENT" },
  { label: "Consumable", value: "CONSUMABLE" },
  { label: "Tool", value: "TOOL" },
  { label: "Loot", value: "LOOT" },
  { label: "Container", value: "CONTAINER" },
  { label: "Spell", value: "SPELL" },
  { label: "Feat", value: "FEAT" },
] as const;

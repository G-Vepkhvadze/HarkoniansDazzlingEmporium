export type ItemRarity =
    | "COMMON"
    | "UNCOMMON"
    | "RARE"
    | "VERY_RARE"
    | "LEGENDARY";

export type ItemType =
    | "WEAPON"
    | "EQUIPMENT"
    | "CONSUMABLE"
    | "TOOL"
    | "LOOT"
    | "CONTAINER"
    | "SPELL"
    | "FEAT";

export interface ShopItem {
    id: string;
    image: string;
    name: string;
    description: string;
    rarity: ItemRarity;
    type: ItemType;
    price: number;
    deal: boolean;
    discountPercent: number;
    stock: number;
    createdAt?: Date;
}

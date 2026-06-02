export type ItemRarity =
    | "COMMON"
    | "UNCOMMON"
    | "RARE"
    | "VERY_RARE"
    | "LEGENDARY";

export interface ShopItem {
    id: string;
    image: string;
    name: string;
    description: string;
    rarity: ItemRarity;
    stock: number;
}
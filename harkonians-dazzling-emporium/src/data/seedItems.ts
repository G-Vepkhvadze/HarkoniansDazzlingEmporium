import { ShopItem } from "@/types/items";

export const seedItems: ShopItem[] = [
    {
        id: crypto.randomUUID(),
        image: "/items/bag-of-holding.jpg",
        name: "Bag of Holding",
        description:
            "Fits far more than any reasonable bag should.",
        rarity: "RARE",
        stock: 3,
    },
    {
        id: crypto.randomUUID(),
        image: "/items/potion-healing.jpg",
        name: "Potion of Healing",
        description:
            "Recommended by 4 out of 5 surviving adventurers.",
        rarity: "COMMON",
        stock: 54,
    },
    {
        id: crypto.randomUUID(),
        image: "/items/cloak-billowing.jpg",
        name: "Cloak of Billowing",
        description:
            "For dramatic entrances.",
        rarity: "COMMON",
        stock: 14,
    },
    {
        id: crypto.randomUUID(),
        image: "/items/ring-invisibility.jpg",
        name: "Ring of Invisibility",
        description:
            "Now you see it, now you don't.",
        rarity: "LEGENDARY",
        stock: 1,
    },
];
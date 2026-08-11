import { prisma } from "./prisma";
import { ItemRarity, ItemType } from "@prisma/client";

export async function getItems() {
    return prisma.item.findMany({
        orderBy: { createdAt: "desc" },
    });
}

export async function getFeaturedItems() {
    return prisma.item.findMany({
        where: { deal: true },
        take: 8,
        orderBy: [
            { discountPercent: "desc" },
            { stock: "desc" },
        ],
    });
}

export async function createItem(data: {
    image: string;
    name: string;
    description: string;
    rarity: ItemRarity;
    type: ItemType;
    deal?: boolean;
    discountPercent?: number;
    stock: number;
}) {
    return prisma.item.create({ data });
}

export async function updateItem(id: string, data: Partial<{
    image: string;
    name: string;
    description: string;
    rarity: ItemRarity;
    type: ItemType;
    deal?: boolean;
    discountPercent?: number;
    stock: number;
}>) {
    return prisma.item.update({
        where: { id },
        data,
    });
}

export async function deleteItem(id: string) {
    return prisma.item.delete({
        where: { id },
    });
}

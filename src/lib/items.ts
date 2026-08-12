import { prisma } from "./prisma";
import { ItemRarity, ItemType } from "@prisma/client";

const itemSelect = {
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
} as const;

export async function getItems() {
    return prisma.item.findMany({
        select: itemSelect,
        orderBy: { createdAt: "desc" },
    });
}

export async function getFeaturedItems() {
    return prisma.item.findMany({
        select: itemSelect,
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
    price: number;
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
    price: number;
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
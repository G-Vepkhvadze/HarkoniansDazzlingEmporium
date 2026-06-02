import { prisma } from "./prisma";
import { ItemRarity } from "@prisma/client";

export async function getItems() {
    return prisma.item.findMany({
        orderBy: { createdAt: "desc" },
    });
}

export async function getFeaturedItems() {
    return prisma.item.findMany({
        take: 4,
        orderBy: { stock: "desc" },
    });
}

export async function createItem(data: {
    image: string;
    name: string;
    description: string;
    rarity: ItemRarity;
    stock: number;
}) {
    return prisma.item.create({ data });
}

export async function deleteItem(id: string) {
    return prisma.item.delete({
        where: { id },
    });
}
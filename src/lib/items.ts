import { prisma } from "./prisma";
import { getSupabase, ITEMS_BUCKET } from "./supabase";
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
    createdAt: true,
} as const;

function isStoragePath(image: string | null | undefined): image is string {
    if (!image) return false;
    return (
        !image.startsWith("http://") &&
        !image.startsWith("https://") &&
        !image.startsWith("/")
    );
}

async function removeStorageImage(image: string | null | undefined) {
    if (!isStoragePath(image)) return;
    const bucket = ITEMS_BUCKET;
    const objectPath = image.slice(bucket.length + 1);
    const supabase = getSupabase();
    await supabase.storage.from(bucket).remove([objectPath]);
}

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
    if (data.image !== undefined) {
        const existing = await prisma.item.findUnique({
            where: { id },
            select: { image: true },
        });
        if (existing && existing.image !== data.image) {
            await removeStorageImage(existing.image);
        }
    }

    return prisma.item.update({
        where: { id },
        data,
    });
}

export async function deleteItem(id: string) {
    const existing = await prisma.item.findUnique({
        where: { id },
        select: { image: true },
    });
    if (existing) {
        await removeStorageImage(existing.image);
    }

    return prisma.item.delete({
        where: { id },
    });
}
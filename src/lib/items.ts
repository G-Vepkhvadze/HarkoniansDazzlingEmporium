import { prisma } from "./prisma";
import { getSupabase, ITEMS_BUCKET } from "./supabase";
import { ItemRarity as PrismaItemRarity, ItemType as PrismaItemType } from "@prisma/client";
import { sanitizeFoundryDescription } from "./foundry/descriptions";
import type { ItemRarity, ItemType, ShopItem } from "@/types/items";

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

function mapPrismaRarityToLocal(rarity: PrismaItemRarity): ItemRarity {
    return rarity as ItemRarity;
}

function mapPrismaTypeToLocal(type: PrismaItemType): ItemType {
    return type as ItemType;
}

function mapPrismaItemToShopItem(item: any): ShopItem {
    return {
        ...item,
        rarity: mapPrismaRarityToLocal(item.rarity),
        type: mapPrismaTypeToLocal(item.type),
        createdAt: item.createdAt || undefined,
    };
}

export async function getItems() {
    const items = await prisma.item.findMany({
        select: itemSelect,
        orderBy: { createdAt: "desc" },
    });
    return items.map(mapPrismaItemToShopItem);
}

export async function getFeaturedItems() {
    const items = await prisma.item.findMany({
        select: itemSelect,
        where: { deal: true },
        take: 8,
        orderBy: [
            { discountPercent: "desc" },
            { stock: "desc" },
        ],
    });
    return items.map(mapPrismaItemToShopItem);
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
    // Sanitize Foundry description markup on creation
    const sanitizedDescription = sanitizeFoundryDescription(data.description);
    return prisma.item.create({ 
      data: { 
        ...data, 
        description: sanitizedDescription 
      } 
    });
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

    // Sanitize Foundry description markup on update if description is provided
    const sanitizedData = data.description !== undefined 
        ? { ...data, description: sanitizeFoundryDescription(data.description) }
        : data;

    return prisma.item.update({
        where: { id },
        data: sanitizedData,
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
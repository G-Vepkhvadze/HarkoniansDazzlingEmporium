import { prisma } from "./prisma";
import { getSupabase, VAULT_BUCKET } from "./supabase";

// Type definitions
interface VaultItemData {
  image: string;
  quote: string;
}

interface VaultItemWithLikes extends VaultItemData {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  likeCount: number;
  isLikedByUser?: boolean;
}

/**
 * Get the VaultItem select object for Prisma queries
 */
const vaultItemSelect = {
  id: true,
  image: true,
  quote: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Check if a path is a storage path (not a URL or absolute path)
 */
function isStoragePath(image: string | null | undefined): image is string {
  if (!image) return false;
  return (
    !image.startsWith("http://") &&
    !image.startsWith("https://") &&
    !image.startsWith("/")
  );
}

/**
 * Remove an image from Supabase storage if it's in the vault bucket
 */
async function removeStorageImage(image: string | null | undefined) {
  if (!isStoragePath(image)) return;
  const bucket = VAULT_BUCKET;
  const objectPath = image.slice(bucket.length + 1);
  const supabase = getSupabase();
  await supabase.storage.from(bucket).remove([objectPath]);
}

/**
 * Get all vault items with their like counts
 */
export async function getVaultItems(userId?: string): Promise<VaultItemWithLikes[]> {
  const items = await prisma.vaultItem.findMany({
    select: {
      ...vaultItemSelect,
      likes: {
        select: {
          userId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return items.map((item) => {
    const likeCount = item.likes.length;
    const isLikedByUser = userId ? item.likes.some((like) => like.userId === userId) : false;

    return {
      id: item.id,
      image: item.image,
      quote: item.quote,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      likeCount,
      isLikedByUser,
    };
  });
}

/**
 * Get a single vault item by ID with like information
 */
export async function getVaultItemById(id: string, userId?: string): Promise<VaultItemWithLikes | null> {
  const item = await prisma.vaultItem.findUnique({
    where: { id },
    select: {
      ...vaultItemSelect,
      likes: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!item) return null;

  const likeCount = item.likes.length;
  const isLikedByUser = userId ? item.likes.some((like) => like.userId === userId) : false;

  return {
    id: item.id,
    image: item.image,
    quote: item.quote,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    likeCount,
    isLikedByUser,
  };
}

/**
 * Create a new vault item
 */
export async function createVaultItem(data: VaultItemData): Promise<{ id: string; image: string; quote: string; createdAt: Date }> {
  return prisma.vaultItem.create({
    data: {
      image: data.image,
      quote: data.quote,
    },
    select: {
      id: true,
      image: true,
      quote: true,
      createdAt: true,
    },
  });
}

/**
 * Delete a vault item
 */
export async function deleteVaultItem(id: string): Promise<void> {
  // First, get the item to remove its image from storage
  const existing = await prisma.vaultItem.findUnique({
    where: { id },
    select: { image: true },
  });

  if (existing) {
    await removeStorageImage(existing.image);
  }

  await prisma.vaultItem.delete({
    where: { id },
  });
}

/**
 * Toggle like status for a vault item
 * Returns true if now liked, false if now unliked
 */
export async function toggleVaultItemLike(vaultItemId: string, userId: string): Promise<boolean> {
  // Check if like already exists
  const existingLike = await prisma.vaultLike.findFirst({
    where: {
      vaultItemId,
      userId,
    },
  });

  if (existingLike) {
    // Unlike the item
    await prisma.vaultLike.delete({
      where: { id: existingLike.id },
    });
    return false; // Now unliked
  } else {
    // Like the item
    await prisma.vaultLike.create({
      data: {
        vaultItemId,
        userId,
      },
    });
    return true; // Now liked
  }
}

/**
 * Check if a user has liked a specific vault item
 */
export async function getUserLikeStatus(vaultItemId: string, userId: string): Promise<boolean> {
  const like = await prisma.vaultLike.findFirst({
    where: {
      vaultItemId,
      userId,
    },
  });
  return !!like;
}

/**
 * Get like count for a specific vault item
 */
export async function getVaultItemLikeCount(vaultItemId: string): Promise<number> {
  const count = await prisma.vaultLike.count({
    where: { vaultItemId },
  });
  return count;
}
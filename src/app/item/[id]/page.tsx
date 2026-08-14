import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ItemDetailClient from "./ItemDetailClient";

interface Review {
  id: string;
  itemId: string;
  authorName: string;
  content: string;
  createdAt: Date;
}

interface ItemReviewData {
  id: string;
  itemId: string;
  authorName: string;
  content: string;
  createdAt: string | Date;
}

interface ItemData {
  id: string;
  image: string;
  name: string;
  description: string;
  rarity: string;
  type: string;
  price: number | string;
  deal: boolean | string;
  discountPercent: number | string;
  stock: number | string;
  reviews: ItemReviewData[];
}

interface FormattedItem {
  id: string;
  image: string;
  name: string;
  description: string;
  rarity: string;
  type: string;
  price: number;
  deal: boolean;
  discountPercent: number;
  stock: number;
  reviews: Review[];
}

export async function generateStaticParams() {
  const items = await prisma.item.findMany({
    select: { id: true },
  });

  return items.map((item) => ({
    id: item.id,
  }));
}

export default async function ItemDetailPage({
                                               params,
                                             }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const result = await prisma.$queryRaw<ItemData[]>`
    SELECT
      i.id,
      i.image,
      i.name,
      i.description,
      i.rarity,
      i.type,
      i.price,
      i.deal,
      i."discountPercent" AS "discountPercent",
      i.stock,
      COALESCE(
        json_agg(
          json_build_object(
            'id', r.id,
            'itemId', r."itemId",
            'authorName', r."authorName",
            'content', r."content",
            'createdAt', r."createdAt"
          )
        ) FILTER (WHERE r.id IS NOT NULL),
        '[]'::json
      ) AS reviews
    FROM "Item" i
    LEFT JOIN "Review" r
      ON i.id = r."itemId"
    WHERE i.id = ${id}
    GROUP BY
      i.id,
      i.image,
      i.name,
      i.description,
      i.rarity,
      i.type,
      i.price,
      i.deal,
      i."discountPercent",
      i.stock
  `;

  if (!result || result.length === 0) {
    return notFound();
  }

  const item = result[0];

  const rawReviews = item.reviews ?? [];

  const reviews: Review[] = rawReviews.map((review) => ({
    id: review.id,
    itemId: review.itemId,
    authorName: review.authorName,
    content: review.content,
    createdAt: new Date(review.createdAt),
  }));

  const formattedItem: FormattedItem = {
    id: item.id,
    image: item.image,
    name: item.name,
    description: item.description,
    rarity: item.rarity,
    type: item.type,
    price: Number(item.price),
    deal: Boolean(item.deal),
    discountPercent: Number(item.discountPercent),
    stock: Number(item.stock),
    reviews,
  };

  return <ItemDetailClient item={formattedItem} />;
}
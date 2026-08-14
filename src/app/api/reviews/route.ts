import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// @ts-ignore - Review model will be available after prisma generate
const getReviews = async (itemId: string) => {
  // @ts-ignore
  return await prisma.review.findMany({
    where: { itemId },
    orderBy: { createdAt: "desc" },
  });
};

// @ts-ignore - Review model will be available after prisma generate
const createReview = async (itemId: string, authorName: string, content: string) => {
  // @ts-ignore
  return await prisma.review.create({
    data: {
      itemId,
      authorName,
      content,
    },
  });
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");

  if (!itemId) {
    return NextResponse.json({ error: "itemId is required" }, { status: 400 });
  }

  const reviews = await getReviews(itemId);

  return NextResponse.json(reviews);
}

export async function POST(request: Request) {
  const { itemId, authorName, content } = await request.json();

  if (!itemId || !authorName || !content) {
    return NextResponse.json({ error: "itemId, authorName, and content are required" }, { status: 400 });
  }

  try {
    const review = await createReview(itemId, authorName, content);

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    // Check if it's a unique constraint violation
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "You have already reviewed this item" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create review" }, { status: 500 });
  }
}

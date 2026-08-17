import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionByToken } from "@/lib/auth/session";
import { SESSION_COOKIE_CONFIG } from "@/lib/auth/index";
import { UserRole } from "@prisma/client";

export const runtime = 'nodejs';

// Helper to get reviews with author information
const getReviews = async (itemId: string) => {
  return await prisma.review.findMany({
    where: { itemId },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          role: true,
        },
      },
    },
  });
};

// Helper to create a review
const createReview = async (itemId: string, userId: string, authorName: string, content: string) => {
  return await prisma.review.create({
    data: {
      itemId,
      userId,
      authorName,
      content,
    },
  });
};

// Helper to check if user is authenticated
const requireAuth = async (request: Request) => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_CONFIG.name)?.value;

  if (!sessionToken) {
    return null;
  }

  const session = await getSessionByToken(sessionToken);
  return session?.user || null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");

  if (!itemId) {
    return NextResponse.json({ error: "itemId is required" }, { status: 400 });
  }

  const reviews = await getReviews(itemId);

  // Sanitize reviews to remove sensitive data before sending to client
  const sanitizedReviews = reviews.map((review) => ({
    id: review.id,
    itemId: review.itemId,
    authorName: review.authorName,
    content: review.content,
    createdAt: review.createdAt,
    // Add user info for display
    userId: review.user?.id,
    userRole: review.user?.role,
    userUsername: review.user?.username,
  }));

  return NextResponse.json(sanitizedReviews);
}

export async function POST(request: Request) {
  try {
    // Check authentication
    const user = await requireAuth(request);

    if (!user) {
      return NextResponse.json({ error: "Authentication required to post a review" }, { status: 401 });
    }

    // Only PLAYER and DM roles can post reviews
    if (user.role !== UserRole.PLAYER && user.role !== UserRole.DM) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    let body: { itemId?: string; content?: string } = {};
    try {
      const bodyText = await request.text();
      if (bodyText) {
        body = JSON.parse(bodyText);
      }
    } catch {
      // Empty or invalid JSON body
    }
    const { itemId, content } = body;

    if (!itemId || !content) {
      return NextResponse.json({ error: "itemId and content are required" }, { status: 400 });
    }

    // Use the authenticated user's info
    const authorName = user.username;

    try {
      const review = await createReview(itemId, user.id, authorName, content);

      return NextResponse.json(
        {
          ...review,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
          },
        },
        { status: 201 }
      );
    } catch (error) {
      // Check if it's a unique constraint violation (user already reviewed this item)
      if (error instanceof Error && error.message.includes("Unique constraint")) {
        return NextResponse.json({ error: "You have already reviewed this item" }, { status: 400 });
      }
      throw error;
    }
  } catch (error) {
    console.error("Review creation error:", error);
    return NextResponse.json({ error: "Failed to create review" }, { status: 500 });
  }
}

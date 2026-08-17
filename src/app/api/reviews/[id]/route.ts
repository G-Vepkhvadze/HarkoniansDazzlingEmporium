import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionByToken } from "@/lib/auth/session";
import { SESSION_COOKIE_CONFIG } from "@/lib/auth/index";

export const runtime = 'nodejs';

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

// Helper to get review with user info
const getReviewWithUser = async (id: string) => {
  return await prisma.review.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          role: true,
        },
      },
    },
  });
};

const deleteReview = async (id: string) => {
  await prisma.review.delete({
    where: { id },
  });
};

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check authentication
    const authUser = await requireAuth(request);

    if (!authUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Get the review to check ownership
    const review = await getReviewWithUser(id);

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Check permissions:
    // - DM can delete any review
    // - PLAYER can only delete their own reviews
    const canDelete = authUser.role === "DM" || review.userId === authUser.id;

    if (!canDelete) {
      return NextResponse.json({ error: "You can only delete your own reviews" }, { status: 403 });
    }

    await deleteReview(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Review deletion error:", error);
    return NextResponse.json({ error: "Failed to delete review" }, { status: 500 });
  }
}

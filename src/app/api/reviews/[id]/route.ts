import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// @ts-ignore - Review model will be available after prisma generate
const deleteReview = async (id: string) => {
  // @ts-ignore
  await prisma.review.delete({
    where: { id },
  });
};

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    await deleteReview(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete review" }, { status: 500 });
  }
}

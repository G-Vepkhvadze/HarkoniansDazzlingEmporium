import { prisma } from "@/lib/prisma";

export async function getAppraisals() {
  return prisma.appraisal.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      itemName: true,
      itemDescription: true,
      createdAt: true,
    },
  });
}

export async function createAppraisal(itemName: string, itemDescription: string) {
  return prisma.appraisal.create({
    data: { itemName, itemDescription },
    select: {
      id: true,
      itemName: true,
      itemDescription: true,
      createdAt: true,
    },
  });
}

export async function deleteAppraisal(id: string): Promise<boolean> {
  const result = await prisma.appraisal.deleteMany({ where: { id } });
  return result.count > 0;
}

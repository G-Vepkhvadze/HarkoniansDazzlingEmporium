import { PrismaClient } from "@prisma/client";
import { seedItems } from "@/data/seedItems";

const prisma = new PrismaClient();

async function main() {
    for (const item of seedItems) {
        const existingItem = await prisma.item.findFirst({
            where: { name: item.name },
        });

        if (existingItem) {
            await prisma.item.update({
                where: { id: existingItem.id },
                data: {
                    image: item.image,
                    description: item.description,
                    rarity: item.rarity,
                    type: item.type,
                    deal: item.deal,
                    discountPercent: item.discountPercent,
                    stock: item.stock,
                },
            });
        } else {
            await prisma.item.create({
                data: item,
            });
        }
    }
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (error) => {
        console.error(error);
        await prisma.$disconnect();
    });

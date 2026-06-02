import { PrismaClient } from "@prisma/client";
import { seedItems } from "@/data/seedItems";

const prisma = new PrismaClient();

async function main() {
    for (const item of seedItems) {
        await prisma.item.create({
            data: item,
        });
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
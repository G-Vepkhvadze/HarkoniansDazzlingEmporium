import {sanitizeFoundryDescription} from "@/lib/foundry/descriptions";
import prisma from "@/lib/prisma";

async function main() {
    const items = await prisma.item.findMany({
        select: {
            id: true,
            name: true,
            description: true,
        },
    });

    console.log(`Found ${items.length} items.`);

    let updated = 0;

    for (const item of items) {
        const cleaned =
            sanitizeFoundryDescription(
                item.description
            );

        if (cleaned === item.description) {
            continue;
        }

        await prisma.item.update({
            where: {
                id: item.id,
            },
            data: {
                description: cleaned,
            },
        });

        updated++;

        console.log(
            `Updated: ${item.name}`
        );
    }

    console.log(
        `Finished. Updated ${updated} items.`
    );
}

main()
    .catch(error => {
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
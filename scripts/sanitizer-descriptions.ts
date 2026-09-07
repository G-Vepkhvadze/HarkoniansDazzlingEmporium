import { prisma } from "@/lib/prisma";
import { sanitizeFoundryDescription } from "@/lib/foundry/descriptions";

const BATCH_SIZE = 100;

async function main() {
    console.log(
        "Starting description sanitization..."
    );

    let processed = 0;
    let updated = 0;
    let cursor: string | undefined;

    while (true) {
        const items =
            await prisma.item.findMany({
                take: BATCH_SIZE,

                ...(cursor
                    ? {
                        skip: 1,
                        cursor: {
                            id: cursor
                        }
                    }
                    : {}),

                orderBy: {
                    id: "asc"
                },

                select: {
                    id: true,
                    name: true,
                    description: true
                }
            });

        if (items.length === 0) {
            break;
        }

        for (const item of items) {
            processed++;

            const cleaned =
                sanitizeFoundryDescription(
                    item.description
                );

            if (
                cleaned === item.description
            ) {
                continue;
            }

            await prisma.item.update({
                where: {
                    id: item.id
                },

                data: {
                    description: cleaned
                }
            });

            updated++;

            console.log(
                `Updated: ${item.name}`
            );
        }

        cursor =
            items[items.length - 1].id;

        console.log(
            `Processed ${processed} items...`
        );
    }

    console.log(
        `Finished. Processed ${processed} items. Updated ${updated} items.`
    );
}

main()
    .catch((error) => {
        console.error(
            "Sanitization failed:",
            error
        );

        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
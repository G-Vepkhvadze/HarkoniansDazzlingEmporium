import { prisma } from "@/lib/prisma";
import { sanitizeFoundryDescription } from "@/lib/foundry/descriptions";

/**
 * Batch sanitize all item descriptions.
 * This script should be run once to clean up existing data.
 * New items are automatically sanitized during creation/update in lib/items.ts
 */
async function main() {
    console.log("Starting description sanitization...");

    const items = await prisma.item.findMany({
        select: {
            id: true,
            name: true,
            description: true,
        },
        // Process in batches to avoid memory issues with large datasets
        take: 100,
    });

    console.log(`Found ${items.length} items to process.`);

    let updated = 0;

    for (const item of items) {
        const cleaned = sanitizeFoundryDescription(
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
        console.error("Sanitization failed:", error);
        process.exit(1);
    });
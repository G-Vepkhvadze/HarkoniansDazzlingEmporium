import { PrismaClient, UserRole } from "@prisma/client";
import { seedItems } from "@/data/seedItems";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  // Seed initial DM user
  // Uses environment variables for credentials - do not hardcode passwords
  const initialDMUsername = process.env.INITIAL_DM_USERNAME || "Lilliwicke7";
  const initialDMPassword = process.env.INITIAL_DM_PASSWORD || "7lovescats";

  if (!process.env.INITIAL_DM_PASSWORD) {
    console.warn(
      "WARNING: INITIAL_DM_PASSWORD not set. Using default password. " +
      "This is insecure for production. Set INITIAL_DM_USERNAME and INITIAL_DM_PASSWORD in .env"
    );
  }

  const passwordHash = await hashPassword(initialDMPassword);

  const existingDM = await prisma.user.findFirst({
    where: { username: initialDMUsername },
  });

  if (!existingDM) {
    await prisma.user.create({
      data: {
        username: initialDMUsername,
        passwordHash,
        role: UserRole.DM,
      },
    });
    console.log(`Created initial DM user: ${initialDMUsername}`);
  } else {
    console.log(`DM user ${initialDMUsername} already exists`);
  }

  // Seed items
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
                    price: item.price,
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

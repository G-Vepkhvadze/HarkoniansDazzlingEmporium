-- Add Character table for Foundry D&D 5e integration
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "foundryWorldId" TEXT,
    "foundryActorId" TEXT,
    "creditBalance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- Add composite unique constraint for Foundry Actor linking
-- This ensures a Foundry Actor ID is unique within a World
CREATE UNIQUE INDEX "Character_foundryWorldId_foundryActorId_key" ON "Character"("foundryWorldId", "foundryActorId") WHERE "foundryWorldId" IS NOT NULL AND "foundryActorId" IS NOT NULL;

-- Add index on userId for faster lookups
CREATE INDEX "Character_userId_idx" ON "Character"("userId");

-- Add foreign key from Character to User
ALTER TABLE "Character" ADD CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- Add Purchase table for transaction history
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "itemId" TEXT,
    "itemName" TEXT NOT NULL,
    "priceCp" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- Add indexes for Purchase table
CREATE INDEX "Purchase_characterId_idx" ON "Purchase"("characterId");
CREATE INDEX "Purchase_itemId_idx" ON "Purchase"("itemId");
CREATE INDEX "Purchase_createdAt_idx" ON "Purchase"("createdAt");

-- Add foreign key from Purchase to Character (cascade delete)
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE;

-- Add foreign key from Purchase to Item (set null on delete to preserve history)
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL;

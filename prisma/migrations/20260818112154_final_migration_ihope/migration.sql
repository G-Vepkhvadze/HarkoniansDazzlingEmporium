/*
  Warnings:

  - A unique constraint covering the columns `[foundryWorldId,foundryActorId]` on the table `Character` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[idempotencyKey]` on the table `Purchase` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[itemId,userId]` on the table `Review` will be added. If there are existing duplicate values, this will fail.
  - Made the column `userId` on table `Review` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "AuthCode" DROP CONSTRAINT "AuthCode_characterId_fkey";

-- DropForeignKey
ALTER TABLE "AuthCode" DROP CONSTRAINT "AuthCode_userId_fkey";

-- DropForeignKey
ALTER TABLE "Character" DROP CONSTRAINT "Character_userId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterApiToken" DROP CONSTRAINT "CharacterApiToken_characterId_fkey";

-- DropForeignKey
ALTER TABLE "DmImpersonationToken" DROP CONSTRAINT "DmImpersonationToken_characterId_fkey";

-- DropForeignKey
ALTER TABLE "DmImpersonationToken" DROP CONSTRAINT "DmImpersonationToken_dmUserId_fkey";

-- DropForeignKey
ALTER TABLE "FoundryLinkRequest" DROP CONSTRAINT "FoundryLinkRequest_katastroWorldId_fkey";

-- DropForeignKey
ALTER TABLE "FoundryPairingCode" DROP CONSTRAINT "FoundryPairingCode_katastroWorldId_fkey";

-- DropForeignKey
ALTER TABLE "FoundryPairingCode" DROP CONSTRAINT "FoundryPairingCode_userId_fkey";

-- DropForeignKey
ALTER TABLE "KatastroWorld" DROP CONSTRAINT "KatastroWorld_dmUserId_fkey";

-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_characterId_fkey";

-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_itemId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_itemId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_userId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- AlterTable
ALTER TABLE "Review" ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Character_foundryWorldId_foundryActorId_key" ON "Character"("foundryWorldId", "foundryActorId");

-- CreateIndex
CREATE INDEX "FoundryPairingCode_codeHash_idx" ON "FoundryPairingCode"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_idempotencyKey_key" ON "Purchase"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Review_itemId_userId_key" ON "Review"("itemId", "userId");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_katastroWorldId_fkey" FOREIGN KEY ("katastroWorldId") REFERENCES "KatastroWorld"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KatastroWorld" ADD CONSTRAINT "KatastroWorld_dmUserId_fkey" FOREIGN KEY ("dmUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoundryPairingCode" ADD CONSTRAINT "FoundryPairingCode_katastroWorldId_fkey" FOREIGN KEY ("katastroWorldId") REFERENCES "KatastroWorld"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoundryPairingCode" ADD CONSTRAINT "FoundryPairingCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoundryLinkRequest" ADD CONSTRAINT "FoundryLinkRequest_katastroWorldId_fkey" FOREIGN KEY ("katastroWorldId") REFERENCES "KatastroWorld"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterApiToken" ADD CONSTRAINT "CharacterApiToken_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthCode" ADD CONSTRAINT "AuthCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthCode" ADD CONSTRAINT "AuthCode_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmImpersonationToken" ADD CONSTRAINT "DmImpersonationToken_dmUserId_fkey" FOREIGN KEY ("dmUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmImpersonationToken" ADD CONSTRAINT "DmImpersonationToken_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

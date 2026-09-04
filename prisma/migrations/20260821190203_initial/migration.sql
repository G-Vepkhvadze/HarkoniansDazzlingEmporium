-- CreateEnum
CREATE TYPE "ItemRarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'VERY_RARE', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('WEAPON', 'EQUIPMENT', 'CONSUMABLE', 'TOOL', 'LOOT', 'CONTAINER', 'SPELL', 'FEAT');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLAYER', 'DM');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rarity" "ItemRarity" NOT NULL,
    "type" "ItemType" NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "deal" BOOLEAN NOT NULL DEFAULT false,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL,
    "foundryItemData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "foundryWorldId" TEXT,
    "foundryActorId" TEXT,
    "creditBalance" INTEGER NOT NULL DEFAULT 0,
    "katastroWorldId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "itemId" TEXT,
    "itemName" TEXT NOT NULL,
    "priceGp" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "foundryItemId" TEXT,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KatastroWorld" (
    "id" TEXT NOT NULL,
    "worldSecretHash" TEXT NOT NULL,
    "foundryWorldId" TEXT NOT NULL,
    "dmUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KatastroWorld_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoundryPairingCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "katastroWorldId" TEXT,
    "userId" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoundryPairingCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoundryLinkRequest" (
    "id" TEXT NOT NULL,
    "requestIdHash" TEXT NOT NULL,
    "foundryActorId" TEXT NOT NULL,
    "foundryWorldId" TEXT NOT NULL,
    "katastroWorldId" TEXT NOT NULL,
    "authorizedCharacterId" TEXT,
    "authorizedAt" TIMESTAMP(3),
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoundryLinkRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterApiToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterApiToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "characterId" TEXT,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmImpersonationToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "dmUserId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DmImpersonationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Review_userId_idx" ON "Review"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_itemId_userId_key" ON "Review"("itemId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Character_userId_idx" ON "Character"("userId");

-- CreateIndex
CREATE INDEX "Character_katastroWorldId_idx" ON "Character"("katastroWorldId");

-- CreateIndex
CREATE UNIQUE INDEX "Character_foundryWorldId_foundryActorId_key" ON "Character"("foundryWorldId", "foundryActorId");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_idempotencyKey_key" ON "Purchase"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Purchase_characterId_idx" ON "Purchase"("characterId");

-- CreateIndex
CREATE INDEX "Purchase_itemId_idx" ON "Purchase"("itemId");

-- CreateIndex
CREATE INDEX "Purchase_createdAt_idx" ON "Purchase"("createdAt");

-- CreateIndex
CREATE INDEX "Purchase_status_idx" ON "Purchase"("status");

-- CreateIndex
CREATE UNIQUE INDEX "KatastroWorld_worldSecretHash_key" ON "KatastroWorld"("worldSecretHash");

-- CreateIndex
CREATE UNIQUE INDEX "KatastroWorld_foundryWorldId_key" ON "KatastroWorld"("foundryWorldId");

-- CreateIndex
CREATE INDEX "KatastroWorld_dmUserId_idx" ON "KatastroWorld"("dmUserId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundryPairingCode_codeHash_key" ON "FoundryPairingCode"("codeHash");

-- CreateIndex
CREATE INDEX "FoundryPairingCode_codeHash_idx" ON "FoundryPairingCode"("codeHash");

-- CreateIndex
CREATE INDEX "FoundryPairingCode_userId_idx" ON "FoundryPairingCode"("userId");

-- CreateIndex
CREATE INDEX "FoundryPairingCode_katastroWorldId_idx" ON "FoundryPairingCode"("katastroWorldId");

-- CreateIndex
CREATE INDEX "FoundryPairingCode_expiresAt_idx" ON "FoundryPairingCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "FoundryLinkRequest_requestIdHash_key" ON "FoundryLinkRequest"("requestIdHash");

-- CreateIndex
CREATE INDEX "FoundryLinkRequest_foundryActorId_foundryWorldId_idx" ON "FoundryLinkRequest"("foundryActorId", "foundryWorldId");

-- CreateIndex
CREATE INDEX "FoundryLinkRequest_katastroWorldId_idx" ON "FoundryLinkRequest"("katastroWorldId");

-- CreateIndex
CREATE INDEX "FoundryLinkRequest_authorizedCharacterId_idx" ON "FoundryLinkRequest"("authorizedCharacterId");

-- CreateIndex
CREATE INDEX "FoundryLinkRequest_expiresAt_idx" ON "FoundryLinkRequest"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterApiToken_tokenHash_key" ON "CharacterApiToken"("tokenHash");

-- CreateIndex
CREATE INDEX "CharacterApiToken_characterId_idx" ON "CharacterApiToken"("characterId");

-- CreateIndex
CREATE INDEX "CharacterApiToken_expiresAt_idx" ON "CharacterApiToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthCode_codeHash_key" ON "AuthCode"("codeHash");

-- CreateIndex
CREATE INDEX "AuthCode_userId_idx" ON "AuthCode"("userId");

-- CreateIndex
CREATE INDEX "AuthCode_characterId_idx" ON "AuthCode"("characterId");

-- CreateIndex
CREATE INDEX "AuthCode_expiresAt_idx" ON "AuthCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DmImpersonationToken_tokenHash_key" ON "DmImpersonationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "DmImpersonationToken_dmUserId_idx" ON "DmImpersonationToken"("dmUserId");

-- CreateIndex
CREATE INDEX "DmImpersonationToken_characterId_idx" ON "DmImpersonationToken"("characterId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

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
ALTER TABLE "FoundryLinkRequest" ADD CONSTRAINT "FoundryLinkRequest_authorizedCharacterId_fkey" FOREIGN KEY ("authorizedCharacterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

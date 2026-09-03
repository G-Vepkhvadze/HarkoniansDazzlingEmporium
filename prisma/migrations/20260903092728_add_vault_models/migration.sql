-- CreateTable
CREATE TABLE "VaultItem" (
    "id" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultLike" (
    "id" TEXT NOT NULL,
    "vaultItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VaultItem_createdAt_idx" ON "VaultItem"("createdAt");

-- CreateIndex
CREATE INDEX "VaultLike_vaultItemId_idx" ON "VaultLike"("vaultItemId");

-- CreateIndex
CREATE INDEX "VaultLike_userId_idx" ON "VaultLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VaultLike_vaultItemId_userId_key" ON "VaultLike"("vaultItemId", "userId");

-- AddForeignKey
ALTER TABLE "VaultLike" ADD CONSTRAINT "VaultLike_vaultItemId_fkey" FOREIGN KEY ("vaultItemId") REFERENCES "VaultItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultLike" ADD CONSTRAINT "VaultLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

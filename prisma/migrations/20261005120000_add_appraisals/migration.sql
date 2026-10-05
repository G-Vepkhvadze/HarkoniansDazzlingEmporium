CREATE TABLE "Appraisal" (
    "id" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemDescription" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appraisal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Appraisal_createdAt_idx" ON "Appraisal"("createdAt");

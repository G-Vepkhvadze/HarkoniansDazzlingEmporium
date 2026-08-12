-- Ensure price column exists, backfill any NULL values, and enforce NOT NULL
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "price" INTEGER;
UPDATE "Item" SET "price" = COALESCE("price", 0);
ALTER TABLE "Item" ALTER COLUMN "price" SET NOT NULL;
ALTER TABLE "Item" ALTER COLUMN "price" SET DEFAULT 0;
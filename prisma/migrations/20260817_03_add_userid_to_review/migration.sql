-- Migration: add_userid_to_review
-- Created: 2026-08-17
-- Description: Adds userId field to Review model for authentication

-- Add userId column to Review table (nullable for existing data)
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- Add foreign key constraint from Review to User
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- Add index on userId for faster lookups
CREATE INDEX IF NOT EXISTS "Review_userId_idx" ON "Review"("userId");

-- Drop old unique constraint on (itemId, authorName)
DROP INDEX IF EXISTS "Review_itemId_authorName_key";

-- Add new unique constraint on (itemId, userId) - one review per user per item
-- Only applies to non-null userId values
CREATE UNIQUE INDEX IF NOT EXISTS "Review_itemId_userId_key" 
  ON "Review"("itemId", "userId") WHERE "userId" IS NOT NULL;

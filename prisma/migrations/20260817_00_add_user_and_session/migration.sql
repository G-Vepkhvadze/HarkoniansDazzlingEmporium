-- Add UserRole enum
CREATE TYPE "UserRole" AS ENUM ('PLAYER', 'DM');

-- Add User table
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint on username
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- Add Session table
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint on session token
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- Add foreign key from Session to User
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- Add index on Session.userId
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- Add index on Session.token
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- Add Review table (was missing from previous migrations)
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- Add foreign key from Review to Item
ALTER TABLE "Review" ADD CONSTRAINT "Review_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE;

-- Add unique constraint on Review (itemId, authorName)
CREATE UNIQUE INDEX "Review_itemId_authorName_key" ON "Review"("itemId", "authorName");

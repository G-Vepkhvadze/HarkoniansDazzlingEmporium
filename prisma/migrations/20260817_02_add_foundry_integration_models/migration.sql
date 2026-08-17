-- Migration: add_foundry_integration_models
-- Created: 2026-08-17
-- Description: Adds database models for Foundry VTT integration

-- =============================================
-- ADD FIELDS TO EXISTING TABLES
-- =============================================

-- Add foundryItemData to Item table (JSON/JSONB for Foundry D&D 5e item data)
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "foundryItemData" JSONB;

-- Add idempotencyKey to Purchase table (for duplicate request prevention)
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

-- Add unique constraint on idempotencyKey (only for non-null values)
-- In PostgreSQL, multiple NULL values are allowed in unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "Purchase_idempotencyKey_key" ON "Purchase"("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;

-- Add katastroWorldId to Character table (link to Katastro world)
ALTER TABLE "Character" ADD COLUMN IF NOT EXISTS "katastroWorldId" TEXT;

-- Add index on katastroWorldId for faster lookups
CREATE INDEX IF NOT EXISTS "Character_katastroWorldId_idx" ON "Character"("katastroWorldId");

-- =============================================
-- CREATE NEW TABLES
-- =============================================

-- KatastroWorld: Represents the paired Foundry world
CREATE TABLE IF NOT EXISTS "KatastroWorld" (
    "id" TEXT NOT NULL,
    "worldSecretHash" TEXT NOT NULL,
    "foundryWorldId" TEXT NOT NULL,
    "dmUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KatastroWorld_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on worldSecretHash
CREATE UNIQUE INDEX IF NOT EXISTS "KatastroWorld_worldSecretHash_key" ON "KatastroWorld"("worldSecretHash");

-- Index on foundryWorldId for lookups
CREATE INDEX IF NOT EXISTS "KatastroWorld_foundryWorldId_idx" ON "KatastroWorld"("foundryWorldId");

-- Index on dmUserId for lookups
CREATE INDEX IF NOT EXISTS "KatastroWorld_dmUserId_idx" ON "KatastroWorld"("dmUserId");

-- Foreign key from KatastroWorld to User
ALTER TABLE "KatastroWorld" ADD CONSTRAINT "KatastroWorld_dmUserId_fkey" 
    FOREIGN KEY ("dmUserId") REFERENCES "User"("id") ON DELETE CASCADE;

-- FoundryPairingCode: One-time codes for world pairing
CREATE TABLE IF NOT EXISTS "FoundryPairingCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "katastroWorldId" TEXT,
    "userId" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT FALSE,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoundryPairingCode_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on codeHash
CREATE UNIQUE INDEX IF NOT EXISTS "FoundryPairingCode_codeHash_key" ON "FoundryPairingCode"("codeHash");

-- Index on userId
CREATE INDEX IF NOT EXISTS "FoundryPairingCode_userId_idx" ON "FoundryPairingCode"("userId");

-- Index on katastroWorldId
CREATE INDEX IF NOT EXISTS "FoundryPairingCode_katastroWorldId_idx" ON "FoundryPairingCode"("katastroWorldId");

-- Index on expiresAt for cleanup
CREATE INDEX IF NOT EXISTS "FoundryPairingCode_expiresAt_idx" ON "FoundryPairingCode"("expiresAt");

-- Foreign key from FoundryPairingCode to User
ALTER TABLE "FoundryPairingCode" ADD CONSTRAINT "FoundryPairingCode_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- Foreign key from FoundryPairingCode to KatastroWorld (optional)
ALTER TABLE "FoundryPairingCode" ADD CONSTRAINT "FoundryPairingCode_katastroWorldId_fkey" 
    FOREIGN KEY ("katastroWorldId") REFERENCES "KatastroWorld"("id") ON DELETE SET NULL;

-- FoundryLinkRequest: Server-generated requests for character linking
CREATE TABLE IF NOT EXISTS "FoundryLinkRequest" (
    "id" TEXT NOT NULL,
    "requestIdHash" TEXT NOT NULL,
    "foundryActorId" TEXT NOT NULL,
    "foundryWorldId" TEXT NOT NULL,
    "katastroWorldId" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT FALSE,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoundryLinkRequest_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on requestIdHash
CREATE UNIQUE INDEX IF NOT EXISTS "FoundryLinkRequest_requestIdHash_key" ON "FoundryLinkRequest"("requestIdHash");

-- Index on Foundry context
CREATE INDEX IF NOT EXISTS "FoundryLinkRequest_foundryActorId_foundryWorldId_idx" 
    ON "FoundryLinkRequest"("foundryActorId", "foundryWorldId");

-- Index on katastroWorldId
CREATE INDEX IF NOT EXISTS "FoundryLinkRequest_katastroWorldId_idx" ON "FoundryLinkRequest"("katastroWorldId");

-- Index on expiresAt
CREATE INDEX IF NOT EXISTS "FoundryLinkRequest_expiresAt_idx" ON "FoundryLinkRequest"("expiresAt");

-- Foreign key from FoundryLinkRequest to KatastroWorld
ALTER TABLE "FoundryLinkRequest" ADD CONSTRAINT "FoundryLinkRequest_katastroWorldId_fkey" 
    FOREIGN KEY ("katastroWorldId") REFERENCES "KatastroWorld"("id") ON DELETE CASCADE;

-- CharacterApiToken: Character-scoped API tokens for Foundry module
CREATE TABLE IF NOT EXISTS "CharacterApiToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterApiToken_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on tokenHash
CREATE UNIQUE INDEX IF NOT EXISTS "CharacterApiToken_tokenHash_key" ON "CharacterApiToken"("tokenHash");

-- Index on characterId
CREATE INDEX IF NOT EXISTS "CharacterApiToken_characterId_idx" ON "CharacterApiToken"("characterId");

-- Index on expiresAt
CREATE INDEX IF NOT EXISTS "CharacterApiToken_expiresAt_idx" ON "CharacterApiToken"("expiresAt");

-- Foreign key from CharacterApiToken to Character
ALTER TABLE "CharacterApiToken" ADD CONSTRAINT "CharacterApiToken_characterId_fkey" 
    FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE;

-- AuthCode: Short-lived codes for browser-to-Foundry handoff
CREATE TABLE IF NOT EXISTS "AuthCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "characterId" TEXT,
    "used" BOOLEAN NOT NULL DEFAULT FALSE,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthCode_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on codeHash
CREATE UNIQUE INDEX IF NOT EXISTS "AuthCode_codeHash_key" ON "AuthCode"("codeHash");

-- Index on userId
CREATE INDEX IF NOT EXISTS "AuthCode_userId_idx" ON "AuthCode"("userId");

-- Index on characterId
CREATE INDEX IF NOT EXISTS "AuthCode_characterId_idx" ON "AuthCode"("characterId");

-- Index on expiresAt
CREATE INDEX IF NOT EXISTS "AuthCode_expiresAt_idx" ON "AuthCode"("expiresAt");

-- Foreign key from AuthCode to User
ALTER TABLE "AuthCode" ADD CONSTRAINT "AuthCode_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- Foreign key from AuthCode to Character (optional)
ALTER TABLE "AuthCode" ADD CONSTRAINT "AuthCode_characterId_fkey" 
    FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE SET NULL;

-- DmImpersonationToken: DM impersonation tokens for testing
CREATE TABLE IF NOT EXISTS "DmImpersonationToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "dmUserId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DmImpersonationToken_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on tokenHash
CREATE UNIQUE INDEX IF NOT EXISTS "DmImpersonationToken_tokenHash_key" ON "DmImpersonationToken"("tokenHash");

-- Index on dmUserId
CREATE INDEX IF NOT EXISTS "DmImpersonationToken_dmUserId_idx" ON "DmImpersonationToken"("dmUserId");

-- Index on characterId
CREATE INDEX IF NOT EXISTS "DmImpersonationToken_characterId_idx" ON "DmImpersonationToken"("characterId");

-- Index on expiresAt
CREATE INDEX IF NOT EXISTS "DmImpersonationToken_expiresAt_idx" ON "DmImpersonationToken"("expiresAt");

-- Foreign key from DmImpersonationToken to User (dmUser)
ALTER TABLE "DmImpersonationToken" ADD CONSTRAINT "DmImpersonationToken_dmUserId_fkey" 
    FOREIGN KEY ("dmUserId") REFERENCES "User"("id") ON DELETE CASCADE;

-- Foreign key from DmImpersonationToken to Character
ALTER TABLE "DmImpersonationToken" ADD CONSTRAINT "DmImpersonationToken_characterId_fkey" 
    FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE;

-- AuditLog: Audit logging for sensitive operations
CREATE TABLE IF NOT EXISTS "AuditLog" (
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

-- Index on userId
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");

-- Index on action
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");

-- Index on target (type + id)
CREATE INDEX IF NOT EXISTS "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- Index on createdAt
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- Foreign key from AuditLog to User (optional, as user might be deleted)
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;
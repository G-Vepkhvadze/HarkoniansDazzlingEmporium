/**
 * Audit logging utilities for security-sensitive operations.
 * 
 * Logs important actions for security review without exposing sensitive data.
 */

import { PrismaClient } from "@prisma/client";
import { prisma as prismaInstance } from "./prisma";

// Re-export prisma for debugging if needed
// export { prisma };

// Use a local prisma instance that's guaranteed to be initialized
const prisma: PrismaClient = prismaInstance;

/**
 * Action types for audit logging.
 */
export type AuditAction = 
  | "LOGIN"
  | "LOGOUT"
  | "REGISTER"
  | "PAIR_WORLD_INITIATED"
  | "PAIR_WORLD_COMPLETED"
  | "PAIR_WORLD_REJECTED"
  | "PAIR_WORLD_REVOKED"
  | "LINK_REQUEST_CREATED"
  | "CHARACTER_LINKED"
  | "CHARACTER_LINK_REJECTED"
  | "CHARACTER_TOKEN_CREATED"
  | "CHARACTER_TOKEN_REVOKED"
  | "DM_IMPERSONATION_START"
  | "DM_IMPERSONATION_END"
  | "PURCHASE"
  | "PURCHASE_COMPLETED"
  | "PURCHASE_FAILED"
  | "CREDIT_ADJUSTMENT"
  | "AUTH_CODE_CREATED"
  | "AUTH_CODE_USED"
  | "AUTH_CODE_EXPIRED"
  | "CHARACTER_ACCESS"
  | "CHARACTER_UPDATE"
  | "FOUNDRY_ITEM_PUBLISH"
  | "FOUNDRY_ITEM_UPDATE"
  | "FOUNDRY_ITEM_CREATE"
  | "FOUNDRY_USER_LINK"
  | "GOLD_SYNC"
  | "GOLD_UPDATE"
  | "ITEM_STOCK_UPDATE";

/**
 * Target types for audit logging.
 */
export type AuditTargetType = 
  | "User"
  | "Character"
  | "Purchase"
  | "Item"
  | "World"
  | "PairingCode"
  | "LinkRequest"
  | "CharacterApiToken"
  | "AuthCode"
  | "DmImpersonationToken"
  | null;

/**
 * Context for audit logging - includes request metadata but NOT sensitive data.
 * Metadata must be JSON-serializable and compatible with Prisma's Json type.
 */
export interface AuditContext {
  ipAddress?: string;
  userAgent?: string;
  additionalInfo?: Record<string, string | number | boolean | null>;
}

/**
 * Looser type for additional info that accepts any JSON-serializable value.
 */
export type AuditContextInput = {
  ipAddress?: string;
  userAgent?: string;
  additionalInfo?: Record<string, string | number | boolean | null | Date>;
};

/**
 * Create an audit log entry.
 * 
 * NEVER log:
 * - Raw passwords
 * - Raw session tokens
 * - Raw bearer secrets (worldSecret, character tokens, etc.)
 * - Password hashes
 * - Token hashes
 * - Any other credentials
 * 
 * @param userId - The user ID performing the action (for impersonation, use the DM's user ID)
 * @param action - The action being performed
 * @param targetType - The type of entity being affected
 * @param targetId - The ID of the entity being affected
 * @param context - Additional context including IP and user agent
 * @returns Promise resolving to the created audit log
 */
export async function createAuditLog(
  userId: string,
  action: AuditAction,
  targetType: AuditTargetType = null,
  targetId: string | null = null,
  context: AuditContextInput = {}
): Promise<void> {
  // Sanitize context - never store sensitive data
  const sanitizedContext = sanitizeAuditContext(context);

  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        targetType,
        targetId,
        metadata: sanitizedContext,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });
  } catch (error) {
    // Log the error but don't fail the operation - audit logging should be non-blocking
    console.error("Failed to create audit log entry:", error);
  }
}

/**
 * Sanitize audit context to remove potentially sensitive data.
 * This is a safety net - never pass sensitive data in the first place.
 */
function sanitizeAuditContext(context: AuditContextInput): Record<string, string | number | boolean | null> {
  const forbiddenKeys = [
    "password",
    "passwordhash",
    "token",
    "tokenhash",
    "secret",
    "secretHash",
    "worldSecret",
    "characterToken",
    "pairingCode",
    "authCode",
    "impersonationToken",
    "credential",
    "credentials",
    "hash",
    "privateKey",
    "apiKey",
    "session",
    "cookie",
  ];

  const sanitized: Record<string, string | number | boolean | null> = {};

  // Copy allowed fields
  if (context.ipAddress) {
    sanitized.ipAddress = context.ipAddress;
  }
  if (context.userAgent) {
    sanitized.userAgent = context.userAgent;
  }

  // Copy additional info but filter out forbidden keys
  if (context.additionalInfo) {
    const filteredInfo: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(context.additionalInfo)) {
      const lowerKey = key.toLowerCase();
      if (!forbiddenKeys.some(fk => lowerKey.includes(fk))) {
        // Only allow primitive JSON-serializable values
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
          filteredInfo[key] = value;
        } else {
          // Convert complex values to string
          filteredInfo[key] = String(value);
        }
      }
    }
    if (Object.keys(filteredInfo).length > 0) {
      Object.assign(sanitized, filteredInfo);
    }
  }

  return sanitized;
}

/**
 * Get audit logs for a specific user.
 * @param userId - The user ID to filter by
 * @param limit - Maximum number of logs to return
 * @returns Promise resolving to array of audit logs
 */
export async function getAuditLogsForUser(
  userId: string,
  limit: number = 100
): Promise<Array<{
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}>> {
  const logs = await prisma.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      metadata: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
    },
  });

  return logs as Array<{
    id: string;
    action: string;
    targetType: string | null;
    targetId: string | null;
    metadata: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
  }>;
}

/**
 * Get recent audit logs.
 * @param limit - Maximum number of logs to return
 * @returns Promise resolving to array of audit logs
 */
export async function getRecentAuditLogs(
  limit: number = 100
): Promise<Array<{
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  userId: string;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}>> {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      userId: true,
      metadata: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
    },
  });

  return logs as Array<{
    id: string;
    action: string;
    targetType: string | null;
    targetId: string | null;
    userId: string;
    metadata: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
  }>;
}

/**
 * Get audit logs filtered by action type.
 * @param action - The action type to filter by
 * @param limit - Maximum number of logs to return
 * @returns Promise resolving to array of audit logs
 */
export async function getAuditLogsByAction(
  action: AuditAction,
  limit: number = 100
): Promise<Array<{
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  userId: string;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}>> {
  const logs = await prisma.auditLog.findMany({
    where: { action },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      userId: true,
      metadata: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
    },
  });

  return logs as Array<{
    id: string;
    action: string;
    targetType: string | null;
    targetId: string | null;
    userId: string;
    metadata: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
  }>;
}

/**
 * Get audit logs for a specific target.
 * @param targetType - The target type to filter by
 * @param targetId - The target ID to filter by
 * @param limit - Maximum number of logs to return
 * @returns Promise resolving to array of audit logs
 */
export async function getAuditLogsForTarget(
  targetType: AuditTargetType,
  targetId: string,
  limit: number = 100
): Promise<Array<{
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  userId: string;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}>> {
  const logs = await prisma.auditLog.findMany({
    where: {
      targetType,
      targetId,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      userId: true,
      metadata: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
    },
  });

  return logs as Array<{
    id: string;
    action: string;
    targetType: string | null;
    targetId: string | null;
    userId: string;
    metadata: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
  }>;
}

/**
 * Extract client IP and user agent from a request.
 * Handles Next.js request objects and headers.
 */
export function extractRequestContext(request: Request): {
  ipAddress: string | undefined;
  userAgent: string | undefined;
} {
  // Try to get IP from various headers (order matters - leftmost is most trustworthy)
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const socketIp = request.headers.get("x-socket-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");

  let ipAddress: string | undefined;

  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one (client)
    ipAddress = forwardedFor.split(",")[0].trim();
  } else if (realIp) {
    ipAddress = realIp;
  } else if (socketIp) {
    ipAddress = socketIp;
  } else if (cfConnectingIp) {
    ipAddress = cfConnectingIp;
  }

  // Get user agent
  const userAgent = request.headers.get("user-agent");

  return {
    ipAddress: ipAddress || undefined,
    userAgent: userAgent || undefined,
  };
}

/**
 * Utility to create audit context from a request.
 */
export function createAuditContextFromRequest(
  request: Request,
  additionalInfo?: Record<string, string | number | boolean | null | Date>
): AuditContextInput {
  const { ipAddress, userAgent } = extractRequestContext(request);
  return {
    ipAddress,
    userAgent,
    additionalInfo,
  };
}

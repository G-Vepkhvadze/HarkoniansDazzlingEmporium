import { UserRole } from "@prisma/client";
import { prisma } from "../prisma";
import { hashPassword, verifyPassword } from "../password";

/**
 * Find a user by username.
 * @param username - The username to search for
 * @returns Promise resolving to the user (without passwordHash) or null
 */
export async function getUserByUsername(username: string) {
  return prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      passwordHash: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Find a user by ID.
 * @param id - The user ID
 * @returns Promise resolving to the user (without passwordHash) or null
 */
export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Create a new user.
 * @param username - The username
 * @param password - The plaintext password (will be hashed)
 * @param role - The user role (defaults to PLAYER)
 * @returns Promise resolving to the created user (without passwordHash)
 */
export async function createUser(
  username: string,
  password: string,
  role: UserRole = UserRole.PLAYER
) {
  const passwordHash = await hashPassword(password);

  return prisma.user.create({
    data: {
      username,
      passwordHash,
      role,
    },
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Verify user credentials.
 * @param username - The username
 * @param password - The plaintext password to verify
 * @returns Promise resolving to the user (without passwordHash) if valid, null otherwise
 */
export async function verifyCredentials(username: string, password: string) {
  const user = await getUserByUsername(username);

  if (!user) {
    return null;
  }

  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    return null;
  }

  // Return user without passwordHash
  const { passwordHash, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

/**
 * Check if a username is available.
 * @param username - The username to check
 * @returns Promise resolving to true if available, false if taken
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  return !existing;
}

/**
 * Get all users (for admin purposes).
 * @returns Promise resolving to array of all users (without passwordHashes)
 */
export async function getAllUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { username: "asc" },
  });
}

/**
 * Update a user's role.
 * @param userId - The user ID
 * @param role - The new role
 * @returns Promise resolving to the updated user
 */
export async function updateUserRole(userId: string, role: UserRole) {
  return prisma.user.update({
    where: { id: userId },
    data: { role },
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Delete a user.
 * This will cascade to delete all their sessions.
 * @param userId - The user ID to delete
 * @returns Promise resolving when the user is deleted
 */
export async function deleteUser(userId: string) {
  await prisma.user.delete({
    where: { id: userId },
  });
}

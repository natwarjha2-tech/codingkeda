import { prisma } from "@/app/lib/prisma";

/**
 * User Repository
 * 
 * Centralizes all User table database operations.
 * Benefits:
 * - Single source of truth for User queries
 * - Consistent select fields (no over-fetching)
 * - Easy to mock in tests (mock this module instead of Prisma)
 * - If DB changes (e.g., add caching), change here only
 */

// ─── Types ───

export interface UserPublic {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface UserWithPassword extends UserPublic {
  password: string;
  avatarUrl: string | null;
}

// ─── Queries ───

/** Find user by email (includes password for auth) */
export async function findByEmail(email: string): Promise<UserWithPassword | null> {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, password: true, avatarUrl: true },
  });
}

/** Find user by ID (public fields only) */
export async function findById(userId: string): Promise<UserPublic | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });
}

/** Find user by ID with password (for password change) */
export async function findByIdWithPassword(userId: string): Promise<UserWithPassword | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, password: true, avatarUrl: true },
  });
}

/** Check if email already exists */
export async function emailExists(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return !!user;
}

// ─── Mutations ───

/** Create a new user */
export async function create(data: {
  name: string;
  email: string;
  password: string;
  role?: string;
}): Promise<UserPublic> {
  return prisma.user.create({
    data: { name: data.name, email: data.email, password: data.password, role: data.role || "user" },
    select: { id: true, name: true, email: true, role: true },
  });
}

/** Update user password */
export async function updatePassword(userId: string, hashedPassword: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } });
}

/** Update user avatar URL */
export async function updateAvatar(userId: string, avatarUrl: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
}

/** Update user display name */
export async function updateName(userId: string, name: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { name } });
}

/** Find multiple users by IDs (for leaderboards, achievements) */
export async function findManyByIds(userIds: string[]): Promise<{ id: string; name: string }[]> {
  return prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
}

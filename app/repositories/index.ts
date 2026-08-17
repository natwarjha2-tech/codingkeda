/**
 * Repository Layer — Database Access Abstraction
 * 
 * Provides a clean interface over Prisma for the most-used models.
 * Routes and services import from here instead of calling prisma directly.
 * 
 * Benefits:
 * - Centralized query logic (DRY — no duplicated findUnique patterns)
 * - Consistent select fields (prevents over-fetching)
 * - Easy to mock in unit tests
 * - Single place to add caching/logging per query in the future
 * - If database changes, only repository changes (not 60 routes)
 * 
 * Usage:
 *   import * as UserRepo from "@/app/repositories/user.repository";
 *   import * as EnrollmentRepo from "@/app/repositories/enrollment.repository";
 *   
 *   const user = await UserRepo.findByEmail(email);
 *   const enrolled = await EnrollmentRepo.isEnrolled(userId, courseId);
 * 
 * Progressive adoption:
 *   Routes can adopt repositories one at a time.
 *   Existing direct prisma.xxx calls continue to work.
 */

export * as UserRepo from "./user.repository";
export * as EnrollmentRepo from "./enrollment.repository";

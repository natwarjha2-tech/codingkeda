import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import { signToken } from "@/app/lib/auth";
import { apiSuccess, apiError } from "@/app/lib/response";
import { getSignedFileUrlFromUrl, getS3KeyFromUrl } from "@/app/lib/s3";
import { createRateLimiter } from "@/app/lib/rate-limit";
import { logger } from "@/app/lib/logger";
import { parseBody, emailSchema } from "@/app/lib/validation";
import { z } from "zod";

// Rate limiters: per-IP (burst protection) + per-email (brute-force protection)
const ipLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 15 });
const emailLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 5 });

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP first (prevents credential stuffing across emails)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || "unknown";
    if (!ipLimiter.check(ip)) {
      return apiError(429, "Too many login attempts. Please try again after 15 minutes.");
    }

    const result = await parseBody(req, loginSchema);
    if (result.error) return result.error;
    const { email, password } = result.data;

    // Rate limit by email (prevents brute-force on specific account)
    if (!emailLimiter.check(email.toLowerCase())) {
      return apiError(429, "Too many login attempts for this account. Please try again after 15 minutes.");
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return apiError(401, "Invalid credentials.");

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return apiError(401, "Invalid credentials.");

    // Reset email limiter on successful login (reward correct credentials)
    emailLimiter.reset(email.toLowerCase());

    const token = signToken({ userId: user.id, email: user.email, role: user.role }, "365d");

    // Generate fresh presigned URL if avatar exists (private S3 bucket)
    let avatarUrl: string | null = null;
    if (user.avatarUrl) {
      try {
        const s3Key = getS3KeyFromUrl(user.avatarUrl);
        if (s3Key) avatarUrl = await getSignedFileUrlFromUrl(user.avatarUrl, 86400);
        else avatarUrl = user.avatarUrl;
      } catch { avatarUrl = null; }
    }

    return apiSuccess({
      message: `Logged in as ${user.role}.`,
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl },
    });
  } catch (err) {
    logger.error("auth-login", "unhandled_error", { error: err instanceof Error ? err.message : "Unknown" });
    return apiError(500, "Internal server error.");
  }
}

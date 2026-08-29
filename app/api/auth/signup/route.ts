import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import { signToken } from "@/app/lib/auth";
import { apiSuccess, apiError } from "@/app/lib/response";
import { createRateLimiter } from "@/app/lib/rate-limit";
import { logger } from "@/app/lib/logger";
import { validatePassword, parseBody, emailSchema } from "@/app/lib/validation";
import { z } from "zod";

// Rate limiter: 3 signups per hour per IP (prevents mass account creation)
const signupLimiter = createRateLimiter({ windowMs: 60 * 60_000, max: 3 });

const signupSchema = z.object({
  name: z.string().optional().default(""),
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || "unknown";
    if (!signupLimiter.check(ip)) {
      return apiError(429, "Too many signup attempts. Please try again after 1 hour.");
    }

    const result = await parseBody(req, signupSchema);
    if (result.error) return result.error;
    const { name, email, password } = result.data;

    // Password strength validation (beyond Zod's basic min length)
    const passwordError = validatePassword(password);
    if (passwordError) return apiError(400, passwordError);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return apiError(409, "Email already registered.");

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name: name?.trim() || "", email, password: hashedPassword, role: "user" },
    });

    const token = signToken({ userId: user.id, email: user.email, role: user.role }, "365d");

    return apiSuccess({
      message: "Account created successfully.",
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    }, 201);
  } catch (err) {
    logger.error("auth-signup", "unhandled_error", { error: err instanceof Error ? err.message : "Unknown" });
    return apiError(500, "Internal server error.");
  }
}

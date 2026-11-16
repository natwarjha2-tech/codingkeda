import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import { signToken } from "@/app/lib/auth";
import { apiSuccess, apiError } from "@/app/lib/response";
import { createRateLimiter } from "@/app/lib/rate-limit";
import { logger } from "@/app/lib/logger";
import { validatePassword, parseBody, emailSchema, isValidEmail } from "@/app/lib/validation";
import { notifyWelcome } from "@/app/lib/notification";
import { z } from "zod";
import { claimDevice, parseDevice } from "@/app/services/student-device.service";
import { cleanName, validateName } from "@/app/lib/name";
import { dobError, isMinorDob } from "@/app/lib/age";
import { normalizeWhatsAppNumber } from "@/app/lib/whatsapp";
import { getConsentState, requireConsentNow } from "@/app/services/parent-consent.service";

// Rate limiter: 3 signups per hour per IP (prevents mass account creation)
const signupLimiter = createRateLimiter({ windowMs: 60 * 60_000, max: 3 });

const signupSchema = z.object({
  name: z.string().optional().default(""),
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
  device: z.unknown().optional(),
  // Added with parental consent. Optional so older app versions keep working;
  // when `dob` is sent and the student is under 18, the parent details are required.
  dob: z.string().max(20).optional(),
  parentName: z.string().max(100).optional(),
  parentEmail: z.string().max(255).optional(),
  parentPhone: z.string().max(30).optional(),
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
    const { name, email, password, device, dob, parentName, parentEmail, parentPhone } = result.data;

    // Real name (no email addresses, digits or placeholders). Empty is still allowed for older apps.
    const cleanedName = cleanName(name);
    if (cleanedName) {
      const nameError = validateName(cleanedName);
      if (nameError) return apiError(400, nameError);
    }

    // Password strength validation (beyond Zod's basic min length)
    const passwordError = validatePassword(password, { email });
    if (passwordError) return apiError(400, passwordError);

    // Date of birth + parent details. Under 18: the parent's email and phone are required.
    const dobRaw = (dob ?? "").trim();
    const parentEmailClean = (parentEmail ?? "").trim().toLowerCase();
    const parentPhoneClean = (parentPhone ?? "").trim();
    let minor = false;
    if (dobRaw) {
      const dobProblem = dobError(dobRaw);
      if (dobProblem) return apiError(400, dobProblem);
      minor = isMinorDob(dobRaw) === true;
      if (minor) {
        if (!isValidEmail(parentEmailClean)) return apiError(400, "Enter your parent or guardian's email address.");
        if (parentEmailClean === email.trim().toLowerCase()) {
          return apiError(400, "The parent email must be different from your own email.");
        }
        if (!normalizeWhatsAppNumber(parentPhoneClean)) {
          return apiError(400, "Enter your parent or guardian's phone number.");
        }
      }
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return apiError(409, "Email already registered.");

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name: cleanedName, email, password: hashedPassword, role: "user" },
    });

    // Keep the date of birth and parent details, and start the parent check.
    // Under 18 = verify right away. A failure here must not undo the sign-up:
    // the student is then asked for these details on the first screen instead.
    let consent: Awaited<ReturnType<typeof getConsentState>> | undefined;
    if (dobRaw) {
      try {
        await prisma.student.create({
          data: {
            userId: user.id,
            name: user.name,
            email: user.email,
            enrolledCourses: 0,
            studentDob: dobRaw,
            parentName: cleanName(parentName) || null,
            parentEmail: parentEmailClean || null,
            parentContact: parentPhoneClean || null,
          },
        });
        if (minor) await requireConsentNow(user.id);
        consent = await getConsentState(user.id);
      } catch (err) {
        logger.error("auth-signup", "consent_setup_failed", { error: err instanceof Error ? err.message : "Unknown" });
      }
    }

    // New account: register this device as its first phone/computer.
    const claim = await claimDevice({ id: user.id, role: user.role }, parseDevice(device));
    const did = claim.ok ? claim.did : undefined;

    const token = signToken({ userId: user.id, email: user.email, role: user.role, ...(did ? { did } : {}) }, "365d");

    // Welcome notification (non-blocking — never fail signup)
    try {
      await notifyWelcome({ userId: user.id, name: user.name || undefined });
    } catch { /* notification failure must not block signup */ }

    return apiSuccess({
      message: "Account created successfully.",
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      ...(consent ? { consent } : {}),
    }, 201);
  } catch (err) {
    logger.error("auth-signup", "unhandled_error", { error: err instanceof Error ? err.message : "Unknown" });
    return apiError(500, "Internal server error.");
  }
}

/**
 * Startup Environment Validation
 * 
 * Validates that all critical environment variables are present.
 * Fails fast at startup (not at first request) — prevents silent misconfigurations.
 * 
 * Categories:
 * - CRITICAL: App cannot function without these (crash immediately)
 * - WARN: Features degraded without these (log warning, continue)
 * 
 * Usage:
 *   import { validateEnv } from "@/app/lib/env";
 *   validateEnv(); // Called once at startup via instrumentation.ts
 */

interface EnvVar {
  name: string;
  critical: boolean;
  description: string;
}

const REQUIRED_ENV_VARS: EnvVar[] = [
  // ─── Critical (app will crash without these) ───
  { name: "DATABASE_URL", critical: true, description: "PostgreSQL connection string" },
  { name: "JWT_SECRET", critical: true, description: "JWT signing secret (min 32 chars)" },

  // ─── Important (core features broken without these) ───
  { name: "AWS_S3_BUCKET_NAME", critical: true, description: "S3 bucket for file storage" },
  { name: "AWS_ACCESS_KEY_ID", critical: true, description: "AWS credentials for S3" },
  { name: "AWS_SECRET_ACCESS_KEY", critical: true, description: "AWS credentials for S3" },
  { name: "AWS_REGION", critical: true, description: "AWS region (e.g., ap-south-1)" },

  // ─── Payment (enrollment breaks without these) ───
  { name: "NEXT_PUBLIC_RAZORPAY_KEY_ID", critical: false, description: "Razorpay public key" },
  { name: "RAZORPAY_KEY_SECRET", critical: false, description: "Razorpay secret key" },
  { name: "RAZORPAY_WEBHOOK_SECRET", critical: false, description: "Razorpay webhook signature secret" },

  // ─── Email (password reset breaks without these) ───
  { name: "SMTP_HOST", critical: false, description: "Email SMTP host" },
  { name: "SMTP_USER", critical: false, description: "Email SMTP username" },
  { name: "SMTP_PASS", critical: false, description: "Email SMTP password" },

  // ─── AI (AI features degraded without this) ───
  { name: "GEMINI_API_KEY", critical: false, description: "Google Gemini AI API key" },
];

/**
 * Validate environment variables at startup.
 * Throws on missing critical vars (prevents app from starting with broken config).
 * Logs warnings for missing non-critical vars.
 */
export function validateEnv(): void {
  const missing: { name: string; description: string }[] = [];
  const warnings: { name: string; description: string }[] = [];

  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar.name];
    if (!value || value.trim().length === 0) {
      if (envVar.critical) {
        missing.push({ name: envVar.name, description: envVar.description });
      } else {
        warnings.push({ name: envVar.name, description: envVar.description });
      }
    }
  }

  // Log warnings for non-critical missing vars
  if (warnings.length > 0) {
    console.warn(
      `[ENV] ⚠️  ${warnings.length} optional env var(s) missing (features degraded):\n` +
      warnings.map((w) => `  - ${w.name}: ${w.description}`).join("\n")
    );
  }

  // Crash on critical missing vars
  if (missing.length > 0) {
    const message =
      `\n\n🚨 CRITICAL: ${missing.length} required environment variable(s) missing!\n` +
      `The application cannot start without these:\n\n` +
      missing.map((m) => `  ❌ ${m.name} — ${m.description}`).join("\n") +
      `\n\nSet these in your .env file or Vercel Dashboard → Settings → Environment Variables.\n`;

    console.error(message);
    throw new Error(`Missing critical environment variables: ${missing.map((m) => m.name).join(", ")}`);
  }

  console.log(`[ENV] ✅ All ${REQUIRED_ENV_VARS.filter((v) => v.critical).length} critical env vars validated.`);
}

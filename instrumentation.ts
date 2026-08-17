/**
 * Next.js Instrumentation Hook
 * 
 * Runs ONCE when the server starts (or when a serverless function cold-starts).
 * Used for: environment validation, telemetry setup, connection warming.
 * 
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on server (not during build or in edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("./app/lib/env");
    validateEnv();
  }
}

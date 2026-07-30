import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { createRateLimiter } from "@/app/lib/rate-limit";
import {
  executeCode,
  truncateOutput,
  isExecutionAvailable,
  VALID_LANGUAGE_IDS,
  MAX_SOURCE_CODE_SIZE,
  MAX_STDIN_SIZE,
  MAX_OUTPUT_SIZE,
} from "@/app/lib/code-runner";

/**
 * POST /api/code/run
 * 
 * Execute code with custom input (stdin) — for "Run" button.
 * Body: { source_code, language_id, stdin? }
 * Response: { success, stdout, stderr, status, time, memory }
 */

const runLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

export async function POST(req: NextRequest) {
  try {
    // 1. Auth
    const { error, user } = requireAuth(req);
    if (error) return error;

    // 2. Rate limit
    if (!runLimiter.check(user!.userId)) {
      return apiError(429, "Rate limit exceeded. Max 10 runs per minute.");
    }

    const { source_code, language_id, stdin } = await req.json();

    // 3. Validate
    if (!source_code?.trim()) return apiError(400, "source_code is required.");
    if (source_code.length > MAX_SOURCE_CODE_SIZE) return apiError(400, "Source code too large (max 50KB).");
    if (!language_id || !VALID_LANGUAGE_IDS.includes(Number(language_id))) return apiError(400, "Invalid language_id.");
    if (stdin && stdin.length > MAX_STDIN_SIZE) return apiError(400, "Input too large (max 10KB).");

    // 4. Check engine availability
    if (!isExecutionAvailable()) return apiError(503, "No code execution engine configured.");

    // 5. Execute
    const result = await executeCode({
      sourceCode: source_code,
      languageId: Number(language_id),
      stdin: stdin || "",
    });

    // 6. Return truncated output
    return apiSuccess({
      stdout: truncateOutput(result.stdout, MAX_OUTPUT_SIZE),
      stderr: truncateOutput(result.stderr, MAX_OUTPUT_SIZE),
      compile_output: truncateOutput(result.compile_output, MAX_OUTPUT_SIZE),
      status: result.status,
      status_description: result.status_description,
      time: result.time,
      memory: result.memory,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("jwt") || msg.includes("token") || msg.includes("invalid") || msg.includes("expired")) {
      return apiError(401, "Unauthorized.");
    }
    console.error("Code run error:", msg);
    return apiError(500, msg || "Internal server error.");
  }
}

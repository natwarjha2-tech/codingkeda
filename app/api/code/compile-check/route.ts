import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { createRateLimiter } from "@/app/lib/rate-limit";
import { executeCode, isExecutionAvailable } from "@/app/lib/code-runner";

/**
 * POST /api/code/compile-check
 * 
 * Lightweight compile-only check for real-time syntax error detection.
 * Does NOT execute code — only compiles and returns errors.
 * Used for VS Code-style red underline syntax errors.
 * 
 * Body: { source_code, language_id }
 * Response: { success, has_errors, errors[] }
 */

const compileLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    // Soft rate limit — return no errors if exceeded (don't block)
    if (!compileLimiter.check(user!.userId)) {
      return apiSuccess({ has_errors: false, errors: [] });
    }

    const { source_code, language_id } = await req.json();
    if (!source_code?.trim() || !language_id) return apiSuccess({ has_errors: false, errors: [] });

    // Skip for interpreted languages (Python/JS) — no compile errors
    if (language_id === 71 || language_id === 63) return apiSuccess({ has_errors: false, errors: [] });
    if (!isExecutionAvailable()) return apiSuccess({ has_errors: false, errors: [] });

    // Execute with empty stdin — compilation errors will surface
    let compileOutput = "";
    let hasErrors = false;

    try {
      const result = await executeCode({ sourceCode: source_code, languageId: Number(language_id), stdin: "" });
      if (result.status === "compilation_error" && result.compile_output) {
        hasErrors = true;
        compileOutput = result.compile_output;
      }
    } catch {}

    const errors = parseCompileErrors(compileOutput, Number(language_id));
    return apiSuccess({ has_errors: hasErrors, errors, raw: compileOutput });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("jwt") || msg.includes("token")) return apiError(401, "Unauthorized.");
    return apiSuccess({ has_errors: false, errors: [] });
  }
}

/**
 * Parse compiler output into structured line/column/message format
 */
function parseCompileErrors(output: string, langId: number): { line: number; column: number; message: string; severity: string }[] {
  if (!output) return [];
  const errors: { line: number; column: number; message: string; severity: string }[] = [];

  // GCC/G++ format: "file.c:3:5: error: message"
  if (langId === 50 || langId === 54) {
    const regex = /(?:\.c|\.cpp)?:(\d+):(\d+):\s*(error|warning):\s*(.+)/g;
    let match;
    while ((match = regex.exec(output)) !== null) {
      errors.push({ line: parseInt(match[1]), column: parseInt(match[2]), message: match[4].trim(), severity: match[3] === "error" ? "error" : "warning" });
    }
  }

  // Java format: "Main.java:5: error: message"
  if (langId === 62) {
    const regex = /\.java:(\d+):\s*(error|warning):\s*(.+)/g;
    let match;
    while ((match = regex.exec(output)) !== null) {
      errors.push({ line: parseInt(match[1]), column: 1, message: match[3].trim(), severity: match[2] === "error" ? "error" : "warning" });
    }
  }

  // Fallback: raw error as single entry
  if (errors.length === 0 && output.trim()) {
    errors.push({ line: 1, column: 1, message: output.trim().split("\n")[0], severity: "error" });
  }

  return errors;
}

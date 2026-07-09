import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/app/lib/auth";

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

const JUDGE0_API_URL = process.env.JUDGE0_API_URL || "";
const JUDGE0_AUTH_TOKEN = process.env.JUDGE0_AUTH_TOKEN || "";
const PISTON_API_URL = process.env.PISTON_API_URL || "";

// Rate limit: max 20 compile checks per minute per user
const compileLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkCompileLimit(userId: string): boolean {
  const now = Date.now();
  const entry = compileLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    compileLimitMap.set(userId, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

// Language ID to Piston mapping
const PISTON_LANGS: Record<number, { lang: string; version: string }> = {
  50: { lang: "c", version: "10.2.0" },
  62: { lang: "java", version: "15.0.2" },
  71: { lang: "python3", version: "3.10.0" },
  63: { lang: "javascript", version: "18.15.0" },
};

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);

    if (!checkCompileLimit(payload.userId)) {
      return NextResponse.json(
        { success: true, has_errors: false, errors: [] },
        { status: 200 }
      );
    }

    const { source_code, language_id } = await req.json();

    if (!source_code?.trim() || !language_id) {
      return NextResponse.json(
        { success: true, has_errors: false, errors: [] }
      );
    }

    // Skip check for interpreted languages (Python/JS) — they don't have compile errors
    if (language_id === 71 || language_id === 63) {
      return NextResponse.json(
        { success: true, has_errors: false, errors: [] }
      );
    }

    let compileOutput = "";
    let hasErrors = false;

    if (PISTON_API_URL) {
      // Piston: run with empty stdin — compilation errors will show
      const pLang = PISTON_LANGS[Number(language_id)];
      if (!pLang) {
        return NextResponse.json({ success: true, has_errors: false, errors: [] });
      }
      try {
        const res = await fetch(`${PISTON_API_URL}/api/v2/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language: pLang.lang,
            version: pLang.version,
            files: [{ content: source_code }],
            stdin: "",
            run_timeout: 3000,
            compile_timeout: 5000,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.compile && data.compile.code !== 0 && data.compile.stderr) {
            hasErrors = true;
            compileOutput = data.compile.stderr;
          }
        }
      } catch {}
    } else if (JUDGE0_API_URL) {
      // Judge0: compile only
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (JUDGE0_AUTH_TOKEN) headers["X-Auth-Token"] = JUDGE0_AUTH_TOKEN;

      const b64Source = Buffer.from(source_code).toString("base64");

      try {
        const res = await fetch(
          `${JUDGE0_API_URL}/submissions?base64_encoded=true&wait=true`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              source_code: b64Source,
              language_id: Number(language_id),
              stdin: "",
            }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          // Status 6 = Compilation Error
          if (data.status?.id === 6) {
            hasErrors = true;
            const decB64 = (s: string | null) => {
              if (!s) return "";
              try { return Buffer.from(s, "base64").toString("utf-8"); } catch { return s; }
            };
            compileOutput = decB64(data.compile_output) || "";
          }
        }
      } catch {}
    }

    // Parse compile errors into structured format
    const errors = parseCompileErrors(compileOutput, Number(language_id));

    return NextResponse.json({
      success: true,
      has_errors: hasErrors,
      errors: errors,
      raw: compileOutput,
    });
  } catch (err: any) {
    if (err?.message?.includes("jwt") || err?.message?.includes("token")) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ success: true, has_errors: false, errors: [] });
  }
}

/**
 * Parse compiler output into line/column/message format
 */
function parseCompileErrors(
  output: string,
  langId: number
): { line: number; column: number; message: string; severity: string }[] {
  if (!output) return [];
  const errors: { line: number; column: number; message: string; severity: string }[] = [];

  // GCC/G++ format: "file.c:3:5: error: message"
  if (langId === 50 || langId === 54) {
    const regex = /(?:\.c|\.cpp)?:(\d+):(\d+):\s*(error|warning):\s*(.+)/g;
    let match;
    while ((match = regex.exec(output)) !== null) {
      errors.push({
        line: parseInt(match[1]),
        column: parseInt(match[2]),
        message: match[4].trim(),
        severity: match[3] === "error" ? "error" : "warning",
      });
    }
  }

  // Java format: "Main.java:5: error: message"
  if (langId === 62) {
    const regex = /\.java:(\d+):\s*(error|warning):\s*(.+)/g;
    let match;
    while ((match = regex.exec(output)) !== null) {
      errors.push({
        line: parseInt(match[1]),
        column: 1,
        message: match[3].trim(),
        severity: match[2] === "error" ? "error" : "warning",
      });
    }
  }

  // If no structured errors parsed, return raw as single error
  if (errors.length === 0 && output.trim()) {
    errors.push({ line: 1, column: 1, message: output.trim().split("\n")[0], severity: "error" });
  }

  return errors;
}

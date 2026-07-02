import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/app/lib/auth";

/**
 * POST /api/code/run
 * 
 * Execute code with custom input (stdin) — for "Run" button.
 * Supports both Piston (development) and Judge0 (production).
 * Automatically picks the available engine based on environment variables.
 * 
 * Body: { source_code, language_id, stdin? }
 * Response: { success, stdout, stderr, status, time, memory }
 */

const JUDGE0_API_URL = process.env.JUDGE0_API_URL || "";
const JUDGE0_AUTH_TOKEN = process.env.JUDGE0_AUTH_TOKEN || "";
const PISTON_API_URL = process.env.PISTON_API_URL || "";

// Security constants
const MAX_SOURCE_CODE_SIZE = 50 * 1024;
const MAX_STDIN_SIZE = 10 * 1024;
const MAX_OUTPUT_SIZE = 10 * 1024;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;

// Language mappings
const LANGUAGES: Record<number, { name: string; version: string; pistonLang: string }> = {
  50: { name: "c", version: "10.2.0", pistonLang: "c" },
  62: { name: "java", version: "15.0.2", pistonLang: "java" },
  71: { name: "python", version: "3.10.0", pistonLang: "python3" },
  63: { name: "javascript", version: "18.15.0", pistonLang: "javascript" },
};

const VALID_LANGUAGE_IDS = Object.keys(LANGUAGES).map(Number);

// Rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) return false;
  entry.count++;
  return true;
}

function truncateOutput(str: string, maxLen: number): string {
  if (!str || str.length <= maxLen) return str;
  return str.substring(0, maxLen) + "\n\n... [output truncated]";
}

/**
 * Execute via Piston API (development — Windows Docker)
 */
async function executeWithPiston(sourceCode: string, langId: number, stdin: string) {
  const lang = LANGUAGES[langId];
  if (!lang) throw new Error("Unsupported language");

  const res = await fetch(`${PISTON_API_URL}/api/v2/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: lang.pistonLang,
      version: lang.version,
      files: [{ content: sourceCode }],
      stdin: stdin || "",
      run_timeout: 3000, // 3 seconds (Piston default limit)
      compile_timeout: 10000,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error("Piston error: " + res.status + " " + text);
  }

  const data = await res.json();

  // Map Piston response to our format
  const compileOutput = data.compile?.stderr || data.compile?.output || "";
  const runOutput = data.run?.stdout || "";
  const runStderr = data.run?.stderr || "";
  const exitCode = data.run?.code ?? -1;

  let status = "accepted";
  if (data.compile?.code !== undefined && data.compile.code !== 0) {
    status = "compilation_error";
  } else if (data.run?.signal === "SIGKILL" || data.run?.signal === "SIGXCPU") {
    status = "time_limit";
  } else if (exitCode !== 0 && runOutput === "") {
    status = "runtime_error";
  }

  return {
    stdout: runOutput,
    stderr: runStderr,
    compile_output: compileOutput,
    status: status,
    status_description: status.replace(/_/g, " "),
    time: null,
    memory: null,
  };
}

/**
 * Execute via Judge0 API (production — Linux VPS)
 * Uses base64 encoding for reliable stdin/source transfer
 */
async function executeWithJudge0(sourceCode: string, langId: number, stdin: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (JUDGE0_AUTH_TOKEN) headers["X-Auth-Token"] = JUDGE0_AUTH_TOKEN;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  // Base64 encode source_code and stdin for reliable transfer
  const b64Source = Buffer.from(sourceCode).toString("base64");
  const b64Stdin = Buffer.from(stdin || "").toString("base64");

  const res = await fetch(`${JUDGE0_API_URL}/submissions?base64_encoded=true&wait=true`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      source_code: b64Source,
      language_id: langId,
      stdin: b64Stdin,
    }),
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!res.ok) {
    const text = await res.text();
    throw new Error("Judge0 error: " + res.status + " " + text);
  }

  const result = await res.json();
  const statusId = result.status?.id;

  let status = "unknown";
  if (statusId === 3) status = "accepted";
  else if (statusId === 4) status = "wrong_answer";
  else if (statusId === 5) status = "time_limit";
  else if (statusId === 6) status = "compilation_error";
  else if (statusId >= 7 && statusId <= 12) status = "runtime_error";
  else if (statusId === 13) status = "internal_error";

  // Decode base64 response fields
  const decodeB64 = (s: string | null) => {
    if (!s) return "";
    try { return Buffer.from(s, "base64").toString("utf-8"); } catch { return s; }
  };

  return {
    stdout: decodeB64(result.stdout),
    stderr: decodeB64(result.stderr),
    compile_output: decodeB64(result.compile_output),
    status: status,
    status_description: result.status?.description || "Unknown",
    time: result.time || null,
    memory: result.memory || null,
  };
}

export async function POST(req: NextRequest) {
  try {
    // 1. Auth
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const payload = verifyToken(token);

    // 2. Rate limit
    if (!checkRateLimit(payload.userId)) {
      return NextResponse.json(
        { success: false, message: "Rate limit exceeded. Max 10 runs per minute." },
        { status: 429 }
      );
    }

    const { source_code, language_id, stdin } = await req.json();

    // 3. Validate
    if (!source_code?.trim()) {
      return NextResponse.json({ success: false, message: "source_code is required." }, { status: 400 });
    }
    if (source_code.length > MAX_SOURCE_CODE_SIZE) {
      return NextResponse.json({ success: false, message: "Source code too large (max 50KB)." }, { status: 400 });
    }
    if (!language_id || !VALID_LANGUAGE_IDS.includes(Number(language_id))) {
      return NextResponse.json({ success: false, message: "Invalid language_id." }, { status: 400 });
    }
    if (stdin && stdin.length > MAX_STDIN_SIZE) {
      return NextResponse.json({ success: false, message: "Input too large (max 10KB)." }, { status: 400 });
    }

    // 4. Execute — pick available engine
    let result;
    if (PISTON_API_URL) {
      result = await executeWithPiston(source_code, Number(language_id), stdin || "");
    } else if (JUDGE0_API_URL) {
      result = await executeWithJudge0(source_code, Number(language_id), stdin || "");
    } else {
      return NextResponse.json(
        { success: false, message: "No code execution engine configured." },
        { status: 503 }
      );
    }

    // 5. Return truncated output
    return NextResponse.json({
      success: true,
      stdout: truncateOutput(result.stdout, MAX_OUTPUT_SIZE),
      stderr: truncateOutput(result.stderr, MAX_OUTPUT_SIZE),
      compile_output: truncateOutput(result.compile_output, MAX_OUTPUT_SIZE),
      status: result.status,
      status_description: result.status_description,
      time: result.time,
      memory: result.memory,
    });
  } catch (err: any) {
    if (err?.message?.includes("jwt") || err?.message?.includes("token") || err?.message?.includes("invalid") || err?.message?.includes("expired")) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }
    console.error("Code run error:", err?.message || err);
    return NextResponse.json(
      { success: false, message: err?.message || "Internal server error." },
      { status: 500 }
    );
  }
}

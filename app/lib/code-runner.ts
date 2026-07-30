/**
 * Code Execution Service — Piston & Judge0 Abstraction
 * 
 * Provides unified interface for running code regardless of execution engine.
 * Automatically picks available engine based on environment variables.
 * 
 * Usage:
 *   import { executeCode, VALID_LANGUAGE_IDS, LANGUAGE_NAMES } from "@/app/lib/code-runner";
 *   const result = await executeCode({ sourceCode, languageId, stdin });
 */

const JUDGE0_API_URL = process.env.JUDGE0_API_URL || "";
const JUDGE0_AUTH_TOKEN = process.env.JUDGE0_AUTH_TOKEN || "";
const PISTON_API_URL = process.env.PISTON_API_URL || "";

// ═══════════════════════════════════════════════════════
// PUBLIC TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════

export const VALID_LANGUAGE_IDS = [50, 62, 71, 63];

export const LANGUAGE_NAMES: Record<number, string> = {
  50: "c",
  62: "java",
  71: "python",
  63: "javascript",
};

export const MAX_SOURCE_CODE_SIZE = 50 * 1024; // 50 KB
export const MAX_STDIN_SIZE = 10 * 1024; // 10 KB
export const MAX_OUTPUT_SIZE = 10 * 1024; // 10 KB

export interface ExecuteInput {
  sourceCode: string;
  languageId: number;
  stdin?: string;
}

export interface ExecuteResult {
  stdout: string;
  stderr: string;
  compile_output: string;
  status: string;
  status_description: string;
  time: string | null;
  memory: number | null;
}

// ═══════════════════════════════════════════════════════
// MAIN EXECUTE FUNCTION
// ═══════════════════════════════════════════════════════

/**
 * Execute code using available engine (Piston or Judge0).
 * Throws Error if no engine configured.
 */
export async function executeCode(input: ExecuteInput): Promise<ExecuteResult> {
  if (PISTON_API_URL) {
    return executeWithPiston(input);
  }
  if (JUDGE0_API_URL) {
    return executeWithJudge0(input);
  }
  throw new Error("No code execution engine configured.");
}

/**
 * Check if any execution engine is available
 */
export function isExecutionAvailable(): boolean {
  return !!(PISTON_API_URL || JUDGE0_API_URL);
}

/**
 * Truncate output to max length (prevents huge responses)
 */
export function truncateOutput(str: string, maxLen = MAX_OUTPUT_SIZE): string {
  if (!str || str.length <= maxLen) return str;
  return str.substring(0, maxLen) + "\n\n... [output truncated]";
}

// ═══════════════════════════════════════════════════════
// PISTON ENGINE (Development — Windows Docker)
// ═══════════════════════════════════════════════════════

const PISTON_LANGS: Record<number, { lang: string; version: string }> = {
  50: { lang: "c", version: "10.2.0" },
  62: { lang: "java", version: "15.0.2" },
  71: { lang: "python3", version: "3.10.0" },
  63: { lang: "javascript", version: "18.15.0" },
};

async function executeWithPiston(input: ExecuteInput): Promise<ExecuteResult> {
  const lang = PISTON_LANGS[input.languageId];
  if (!lang) throw new Error("Unsupported language");

  const res = await fetch(`${PISTON_API_URL}/api/v2/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: lang.lang,
      version: lang.version,
      files: [{ content: input.sourceCode }],
      stdin: input.stdin || "",
      run_timeout: 3000,
      compile_timeout: 10000,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error("Piston error: " + res.status + " " + text);
  }

  const data = await res.json();
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
    status,
    status_description: status.replace(/_/g, " "),
    time: null,
    memory: null,
  };
}

// ═══════════════════════════════════════════════════════
// JUDGE0 ENGINE (Production — Linux VPS)
// ═══════════════════════════════════════════════════════

async function executeWithJudge0(input: ExecuteInput): Promise<ExecuteResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (JUDGE0_AUTH_TOKEN) headers["X-Auth-Token"] = JUDGE0_AUTH_TOKEN;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  const b64Source = Buffer.from(input.sourceCode).toString("base64");
  const b64Stdin = Buffer.from(input.stdin || "").toString("base64");

  const res = await fetch(`${JUDGE0_API_URL}/submissions?base64_encoded=true&wait=true`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      source_code: b64Source,
      language_id: input.languageId,
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

  const decodeB64 = (s: string | null) => {
    if (!s) return "";
    try { return Buffer.from(s, "base64").toString("utf-8"); } catch { return s; }
  };

  return {
    stdout: decodeB64(result.stdout),
    stderr: decodeB64(result.stderr),
    compile_output: decodeB64(result.compile_output),
    status,
    status_description: result.status?.description || "Unknown",
    time: result.time || null,
    memory: result.memory || null,
  };
}

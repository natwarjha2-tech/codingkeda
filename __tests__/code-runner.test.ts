/**
 * Unit tests — code execution engine abstraction (app/lib/code-runner.ts)
 *   • executeCode  → Piston engine
 *   • executeCode  → Judge0 engine
 *   • Java public-class normalization ("public class Abc" → "public class Main")
 *   • isExecutionAvailable / truncateOutput / constants
 *
 * FULLY MOCKED — global.fetch is stubbed so NO real network / Docker / Judge0
 * is ever hit. Engine selection is driven by env vars, so each test block
 * re-imports the module with jest.isolateModules after setting the right env.
 * No DB, no payment gateway, no production side effects.
 */

type RunnerModule = typeof import("@/app/lib/code-runner");

/** Freshly import the runner with a controlled env (engine selection reads env at module load). */
function loadRunner(env: Record<string, string | undefined>): RunnerModule {
  let mod!: RunnerModule;
  jest.isolateModules(() => {
    const prev = { ...process.env };
    // Clear both engine URLs first so only the requested one is active.
    delete process.env.PISTON_API_URL;
    delete process.env.JUDGE0_API_URL;
    delete process.env.JUDGE0_AUTH_TOKEN;
    Object.assign(process.env, env);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("@/app/lib/code-runner");
    // restore after capturing the module (module already read env at require time)
    process.env = prev;
  });
  return mod;
}

const mockFetch = jest.fn();
beforeAll(() => {
  global.fetch = mockFetch as unknown as typeof fetch;
});
beforeEach(() => {
  mockFetch.mockReset();
});

// ─────────────────────────────────────────────────────────────
// Static helpers / constants (no engine needed)
// ─────────────────────────────────────────────────────────────
describe("code-runner: helpers & constants", () => {
  const runner = loadRunner({});

  it("exposes the expected language ids and names", () => {
    expect(runner.VALID_LANGUAGE_IDS).toEqual([50, 62, 71, 63]);
    expect(runner.LANGUAGE_NAMES[71]).toBe("python");
    expect(runner.LANGUAGE_NAMES[62]).toBe("java");
  });

  it("isExecutionAvailable is false when no engine configured", () => {
    expect(runner.isExecutionAvailable()).toBe(false);
  });

  it("isExecutionAvailable is true when Piston configured", () => {
    const r = loadRunner({ PISTON_API_URL: "http://piston.local" });
    expect(r.isExecutionAvailable()).toBe(true);
  });

  it("isExecutionAvailable is true when Judge0 configured", () => {
    const r = loadRunner({ JUDGE0_API_URL: "http://judge0.local" });
    expect(r.isExecutionAvailable()).toBe(true);
  });

  it("truncateOutput returns short strings unchanged", () => {
    expect(runner.truncateOutput("hello")).toBe("hello");
    expect(runner.truncateOutput("")).toBe("");
  });

  it("truncateOutput trims oversized strings and appends marker", () => {
    const big = "x".repeat(runner.MAX_OUTPUT_SIZE + 500);
    const out = runner.truncateOutput(big);
    expect(out.length).toBeLessThan(big.length);
    expect(out).toContain("[output truncated]");
  });

  it("executeCode throws when no engine is configured", async () => {
    await expect(
      runner.executeCode({ sourceCode: "print(1)", languageId: 71 })
    ).rejects.toThrow(/No code execution engine/);
  });
});

// ─────────────────────────────────────────────────────────────
// Piston engine
// ─────────────────────────────────────────────────────────────
describe("code-runner: Piston engine", () => {
  const PISTON_API_URL = "http://piston.local";

  function pistonOk(body: Record<string, unknown>) {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => body });
  }

  it("returns accepted on a clean run", async () => {
    const runner = loadRunner({ PISTON_API_URL });
    pistonOk({ run: { stdout: "42\n", stderr: "", code: 0 } });

    const res = await runner.executeCode({ sourceCode: "print(42)", languageId: 71, stdin: "" });

    expect(res.status).toBe("accepted");
    expect(res.stdout).toBe("42\n");
    expect(res.time).toBeNull();
    expect(res.memory).toBeNull();
    // verify the piston endpoint + payload shape
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe(`${PISTON_API_URL}/api/v2/execute`);
    const sent = JSON.parse((opts as { body: string }).body);
    expect(sent.language).toBe("python3");
    expect(sent.files[0].content).toBe("print(42)");
  });

  it("maps a non-zero compile code to compilation_error", async () => {
    const runner = loadRunner({ PISTON_API_URL });
    pistonOk({ compile: { code: 1, stderr: "syntax error" }, run: { stdout: "", stderr: "", code: 1 } });

    const res = await runner.executeCode({ sourceCode: "int x", languageId: 50 });
    expect(res.status).toBe("compilation_error");
    expect(res.compile_output).toBe("syntax error");
  });

  it("maps SIGKILL to time_limit", async () => {
    const runner = loadRunner({ PISTON_API_URL });
    pistonOk({ run: { stdout: "", stderr: "", code: null, signal: "SIGKILL" } });

    const res = await runner.executeCode({ sourceCode: "while True: pass", languageId: 71 });
    expect(res.status).toBe("time_limit");
  });

  it("maps a non-zero exit with empty stdout to runtime_error", async () => {
    const runner = loadRunner({ PISTON_API_URL });
    pistonOk({ run: { stdout: "", stderr: "boom", code: 1 } });

    const res = await runner.executeCode({ sourceCode: "raise Exception()", languageId: 71 });
    expect(res.status).toBe("runtime_error");
    expect(res.stderr).toBe("boom");
  });

  it("uses compile.output when compile.stderr is absent", async () => {
    const runner = loadRunner({ PISTON_API_URL });
    pistonOk({ compile: { code: 2, output: "fallback-compile-msg" }, run: { stdout: "", code: 0 } });

    const res = await runner.executeCode({ sourceCode: "bad", languageId: 50 });
    expect(res.compile_output).toBe("fallback-compile-msg");
    expect(res.status).toBe("compilation_error");
  });

  it("throws a descriptive error when Piston returns non-ok", async () => {
    const runner = loadRunner({ PISTON_API_URL });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => "server down" });

    await expect(runner.executeCode({ sourceCode: "x", languageId: 71 })).rejects.toThrow(/Piston error: 500/);
  });

  it("throws on an unsupported language id", async () => {
    const runner = loadRunner({ PISTON_API_URL });
    await expect(runner.executeCode({ sourceCode: "x", languageId: 999 })).rejects.toThrow(/Unsupported language/);
  });

  it("normalizes a Java public class name to Main before sending", async () => {
    const runner = loadRunner({ PISTON_API_URL });
    pistonOk({ run: { stdout: "ok\n", code: 0 } });

    await runner.executeCode({
      sourceCode: "public class Solution { public static void main(String[] a){ new Solution(); } }",
      languageId: 62,
    });

    const sent = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
    expect(sent.files[0].content).toContain("public class Main");
    expect(sent.files[0].content).toContain("new Main()");
    expect(sent.files[0].content).not.toContain("Solution");
  });

  it("leaves Java code untouched when the class is already Main", async () => {
    const runner = loadRunner({ PISTON_API_URL });
    pistonOk({ run: { stdout: "ok\n", code: 0 } });

    await runner.executeCode({
      sourceCode: "public class Main { public static void main(String[] a){} }",
      languageId: 62,
    });

    const sent = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
    expect(sent.files[0].content).toContain("public class Main");
  });
});

// ─────────────────────────────────────────────────────────────
// Judge0 engine
// ─────────────────────────────────────────────────────────────
describe("code-runner: Judge0 engine", () => {
  const JUDGE0_API_URL = "http://judge0.local";

  function judge0Ok(result: Record<string, unknown>) {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => result });
  }
  const b64 = (s: string) => Buffer.from(s).toString("base64");

  it("decodes base64 output and maps status 3 → accepted", async () => {
    const runner = loadRunner({ JUDGE0_API_URL });
    judge0Ok({
      status: { id: 3, description: "Accepted" },
      stdout: b64("hello\n"),
      stderr: null,
      compile_output: null,
      time: "0.01",
      memory: 2048,
    });

    const res = await runner.executeCode({ sourceCode: "print('hello')", languageId: 71, stdin: "data" });
    expect(res.status).toBe("accepted");
    expect(res.stdout).toBe("hello\n");
    expect(res.time).toBe("0.01");
    expect(res.memory).toBe(2048);

    // request shape: base64_encoded submission
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/submissions?base64_encoded=true&wait=true");
    const sent = JSON.parse((opts as { body: string }).body);
    expect(sent.language_id).toBe(71);
    expect(Buffer.from(sent.source_code, "base64").toString()).toBe("print('hello')");
    expect(Buffer.from(sent.stdin, "base64").toString()).toBe("data");
  });

  it("maps status 4 → wrong_answer", async () => {
    const runner = loadRunner({ JUDGE0_API_URL });
    judge0Ok({ status: { id: 4, description: "Wrong Answer" }, stdout: b64("x") });
    const res = await runner.executeCode({ sourceCode: "x", languageId: 71 });
    expect(res.status).toBe("wrong_answer");
  });

  it("maps status 5 → time_limit", async () => {
    const runner = loadRunner({ JUDGE0_API_URL });
    judge0Ok({ status: { id: 5, description: "TLE" } });
    const res = await runner.executeCode({ sourceCode: "x", languageId: 71 });
    expect(res.status).toBe("time_limit");
  });

  it("maps status 6 → compilation_error", async () => {
    const runner = loadRunner({ JUDGE0_API_URL });
    judge0Ok({ status: { id: 6, description: "Compilation Error" }, compile_output: b64("cannot find symbol") });
    const res = await runner.executeCode({ sourceCode: "x", languageId: 62 });
    expect(res.status).toBe("compilation_error");
    expect(res.compile_output).toBe("cannot find symbol");
  });

  it("maps runtime statuses (7-12) → runtime_error", async () => {
    const runner = loadRunner({ JUDGE0_API_URL });
    judge0Ok({ status: { id: 11, description: "Runtime Error (NZEC)" }, stderr: b64("segfault") });
    const res = await runner.executeCode({ sourceCode: "x", languageId: 50 });
    expect(res.status).toBe("runtime_error");
    expect(res.stderr).toBe("segfault");
  });

  it("maps status 13 → internal_error and unknown ids → unknown", async () => {
    const runner = loadRunner({ JUDGE0_API_URL });
    judge0Ok({ status: { id: 13, description: "Internal Error" } });
    expect((await runner.executeCode({ sourceCode: "x", languageId: 71 })).status).toBe("internal_error");

    judge0Ok({ status: { id: 99 } });
    const res = await runner.executeCode({ sourceCode: "x", languageId: 71 });
    expect(res.status).toBe("unknown");
    expect(res.status_description).toBe("Unknown");
  });

  it("sends the X-Auth-Token header when JUDGE0_AUTH_TOKEN is set", async () => {
    const runner = loadRunner({ JUDGE0_API_URL, JUDGE0_AUTH_TOKEN: "secret-token" });
    judge0Ok({ status: { id: 3 }, stdout: b64("ok") });

    await runner.executeCode({ sourceCode: "x", languageId: 71 });
    const headers = (mockFetch.mock.calls[0][1] as { headers: Record<string, string> }).headers;
    expect(headers["X-Auth-Token"]).toBe("secret-token");
  });

  it("throws a descriptive error when Judge0 returns non-ok", async () => {
    const runner = loadRunner({ JUDGE0_API_URL });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429, text: async () => "rate limited" });
    await expect(runner.executeCode({ sourceCode: "x", languageId: 71 })).rejects.toThrow(/Judge0 error: 429/);
  });

  it("gracefully handles undefined output fields (returns empty strings)", async () => {
    const runner = loadRunner({ JUDGE0_API_URL });
    judge0Ok({ status: { id: 3, description: "Accepted" } });
    const res = await runner.executeCode({ sourceCode: "x", languageId: 71 });
    expect(res.stdout).toBe("");
    expect(res.stderr).toBe("");
    expect(res.compile_output).toBe("");
    expect(res.time).toBeNull();
    expect(res.memory).toBeNull();
  });

  it("prefers Piston over Judge0 when both are configured", async () => {
    const runner = loadRunner({ PISTON_API_URL: "http://piston.local", JUDGE0_API_URL });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ run: { stdout: "p\n", code: 0 } }) });
    await runner.executeCode({ sourceCode: "x", languageId: 71 });
    expect(mockFetch.mock.calls[0][0]).toContain("piston.local");
  });
});

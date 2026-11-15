/**
 * Unit tests — app/lib/logger.ts
 *
 * Verifies the structured log format and that each level writes to the right
 * console method. console is spied (not real output), so nothing leaks. No DB.
 */

import { logger } from "@/app/lib/logger";

describe("logger", () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("info() logs an INFO line with fn + action", () => {
    logger.info("quiz", "saved", { userId: "u1" });
    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = logSpy.mock.calls[0][0] as string;
    expect(line).toContain("[INFO]");
    expect(line).toContain("[quiz]");
    expect(line).toContain("action=saved");
    expect(line).toContain("userId=u1");
  });

  it("success() logs a SUCCESS line via console.log", () => {
    logger.success("pay", "done");
    const line = logSpy.mock.calls[0][0] as string;
    expect(line).toContain("[SUCCESS]");
    expect(line).toContain("action=done");
  });

  it("warn() logs via console.warn", () => {
    logger.warn("live", "missed_pong");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("[WARN]");
  });

  it("error() logs via console.error", () => {
    logger.error("pay", "failed", { error: "boom" });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const line = errorSpy.mock.calls[0][0] as string;
    expect(line).toContain("[ERROR]");
    expect(line).toContain("error=boom");
  });

  it("serializes object details as JSON", () => {
    logger.info("fn", "act", { meta: { a: 1 } });
    const line = logSpy.mock.calls[0][0] as string;
    expect(line).toContain('meta={"a":1}');
  });

  it("works with no details (no trailing detail string)", () => {
    logger.info("fn", "act");
    const line = logSpy.mock.calls[0][0] as string;
    expect(line.trim().endsWith("action=act")).toBe(true);
  });

  it("includes an ISO timestamp", () => {
    logger.info("fn", "act");
    const line = logSpy.mock.calls[0][0] as string;
    expect(line).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  describe("debug()", () => {
    // NODE_ENV is typed read-only, so set it through a loosely-typed view.
    const env = process.env as Record<string, string | undefined>;
    const original = env.NODE_ENV;
    afterEach(() => { env.NODE_ENV = original; });

    it("logs when NODE_ENV is not production", () => {
      env.NODE_ENV = "test";
      logger.debug("fn", "act");
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0][0]).toContain("[DEBUG]");
    });

    it("is silent in production", () => {
      env.NODE_ENV = "production";
      logger.debug("fn", "act");
      expect(logSpy).not.toHaveBeenCalled();
    });
  });
});

/**
 * Unit tests — app/lib/validation.ts
 *
 * Pure validation helpers + Zod schemas + parseBody. No DB/network. parseBody
 * is driven with plain fake Request objects (just a json() method), so nothing
 * real is touched.
 */

import { z } from "zod";
import {
  validatePassword,
  parseBody,
  isValidEmail,
  emailSchema,
  passwordSchema,
  uuidSchema,
  requiredString,
} from "@/app/lib/validation";

// ─── validatePassword ─────────────────────────────────────────────────────────

describe("validatePassword()", () => {
  it("accepts a strong password", () => {
    expect(validatePassword("Secret123")).toBeNull();
  });

  it("rejects empty / too short", () => {
    expect(validatePassword("")).toMatch(/at least 8/);
    expect(validatePassword("Ab1")).toMatch(/at least 8/);
  });

  it("rejects too long (>128)", () => {
    expect(validatePassword("Aa1" + "x".repeat(130))).toMatch(/not exceed 128/);
  });

  it("requires an uppercase letter", () => {
    expect(validatePassword("secret123")).toMatch(/uppercase/);
  });

  it("requires a lowercase letter", () => {
    expect(validatePassword("SECRET123")).toMatch(/lowercase/);
  });

  it("requires a number", () => {
    expect(validatePassword("SecretPass")).toMatch(/number/);
  });

  it("accepts exactly 8 chars with all classes (boundary)", () => {
    expect(validatePassword("Abcdef12")).toBeNull();
  });
});

// ─── isValidEmail ─────────────────────────────────────────────────────────────

describe("isValidEmail()", () => {
  it("accepts a valid email and trims whitespace", () => {
    expect(isValidEmail("user@test.com")).toBe(true);
    expect(isValidEmail("  user@test.com  ")).toBe(true);
  });

  it("rejects invalid / empty / nullish", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail(undefined as unknown as string)).toBe(false);
  });
});

// ─── parseBody ────────────────────────────────────────────────────────────────

const fakeReq = (body: unknown, throwOnJson = false): Request =>
  ({ json: async () => { if (throwOnJson) throw new Error("bad json"); return body; } } as unknown as Request);

describe("parseBody()", () => {
  const schema = z.object({ name: z.string().min(1), age: z.number() });

  it("returns parsed data on a valid body", async () => {
    const result = await parseBody(fakeReq({ name: "Arjun", age: 20 }), schema);
    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ name: "Arjun", age: 20 });
  });

  it("returns a 400 error with field name on an invalid body", async () => {
    const result = await parseBody(fakeReq({ name: "", age: 20 }), schema);
    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error!.status).toBe(400);
    const body = await result.error!.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain("name");
  });

  it("returns a 400 error when json() throws (malformed body)", async () => {
    const result = await parseBody(fakeReq(null, true), schema);
    expect(result.error).toBeDefined();
    expect(result.error!.status).toBe(400);
    const body = await result.error!.json();
    expect(body.message).toMatch(/Invalid request body/);
  });

  it("handles a schema error with no path (message only)", async () => {
    const strict = z.string(); // top-level, no object path
    const result = await parseBody(fakeReq(123), strict);
    expect(result.error).toBeDefined();
    expect(result.error!.status).toBe(400);
  });
});

// ─── Zod schemas ──────────────────────────────────────────────────────────────

describe("exported Zod schemas", () => {
  it("emailSchema accepts valid, rejects invalid", () => {
    expect(emailSchema.safeParse("a@b.com").success).toBe(true);
    expect(emailSchema.safeParse("nope").success).toBe(false);
  });

  it("passwordSchema enforces 8..128 length", () => {
    expect(passwordSchema.safeParse("12345678").success).toBe(true);
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("x".repeat(129)).success).toBe(false);
  });

  it("uuidSchema validates UUID format", () => {
    expect(uuidSchema.safeParse("11111111-1111-1111-1111-111111111111").success).toBe(true);
    expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
  });

  it("requiredString rejects empty and trims the value", () => {
    expect(requiredString.safeParse("").success).toBe(false);
    const parsed = requiredString.safeParse("  hi  ");
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toBe("hi");
  });
});

/**
 * Unit tests — app/lib/response.ts
 *
 * Pure helpers over NextResponse.json — no mocks, no DB, no network.
 * Covers success/error shapes, default + custom status, and empty-data default.
 */

import { apiSuccess, apiError } from "@/app/lib/response";

describe("apiSuccess()", () => {
  it("wraps data with success:true and defaults to status 200", async () => {
    const res = apiSuccess({ foo: "bar" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, foo: "bar" });
  });

  it("uses the provided status code (e.g. 201)", async () => {
    const res = apiSuccess({ id: "x" }, 201);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ success: true, id: "x" });
  });

  it("defaults to an empty payload when no data is passed", async () => {
    const res = apiSuccess();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it("merges multiple keys of data", async () => {
    const res = apiSuccess({ a: 1, b: [1, 2], c: { d: true } });
    const body = await res.json();
    expect(body).toEqual({ success: true, a: 1, b: [1, 2], c: { d: true } });
  });
});

describe("apiError()", () => {
  it("returns success:false with the message and given status", async () => {
    const res = apiError(400, "Bad input.");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ success: false, message: "Bad input." });
  });

  it.each([401, 403, 404, 429, 500, 503])("preserves status %s", async (status) => {
    const res = apiError(status, "msg");
    expect(res.status).toBe(status);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

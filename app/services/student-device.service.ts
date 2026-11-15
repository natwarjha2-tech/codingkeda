/**
 * Device limit for students.
 *  - DEVICE_LIMIT_MODE=single (default): ONE device in total — a phone OR a
 *    computer, never both at the same time.
 *  - DEVICE_LIMIT_MODE=per-kind: 1 phone/tablet + 1 computer.
 *
 * How it works (modelled on the usual "registered devices" pattern of learning
 * and streaming apps — a fixed number of device slots, replace a device
 * yourself, a limited number of replacements, and support can reset):
 *  - The first sign-in takes the slot.
 *  - Signing in on ANOTHER device asks "use this device instead?". Confirming
 *    signs the old device out. At most DEVICE_SWITCH_LIMIT replacements
 *    (default 2) per DEVICE_SWITCH_WINDOW_DAYS (default 30); after that the
 *    student has to contact support.
 *  - A super-admin can unlink one device or reset all (which also resets the
 *    replacement count).
 *  - Each sign-in token carries the device id ("did"); key routes reject a token
 *    whose device was replaced or unlinked.
 *  - Admin / super-admin accounts are never limited.
 *  - Requests from app versions that don't send a device yet are allowed, unless
 *    DEVICE_LIMIT_BLOCK_OLD_APPS=true (then they are asked to update).
 *  - DEVICE_LIMIT_ENABLED=false switches the whole feature off.
 */
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { logger } from "@/app/lib/logger";
import { sendEmail } from "@/app/lib/mail";
import type { JwtPayload } from "@/app/lib/auth";
import { isDeletionPending } from "@/app/services/account-deletion.service";

export type DeviceKind = "mobile" | "desktop";

export interface DeviceInfo {
  id: string;
  kind: DeviceKind;
  name: string;
  platform: string;
  appVersion: string;
}

export interface DeviceSettings {
  enabled: boolean;
  blockOldApps: boolean;
  switchLimit: number;
  windowDays: number;
  /** "single" = ONE device in total (phone OR computer). "per-kind" = 1 phone + 1 computer. */
  mode: "single" | "per-kind";
}

export function deviceSettings(): DeviceSettings {
  const n = (v: string | undefined, d: number, min: number, max: number) => {
    const x = Number(v);
    return Number.isFinite(x) ? Math.min(max, Math.max(min, Math.floor(x))) : d;
  };
  return {
    enabled: process.env.DEVICE_LIMIT_ENABLED !== "false",
    blockOldApps: process.env.DEVICE_LIMIT_BLOCK_OLD_APPS === "true",
    switchLimit: n(process.env.DEVICE_SWITCH_LIMIT, 2, 0, 50),
    windowDays: n(process.env.DEVICE_SWITCH_WINDOW_DAYS, 30, 1, 365),
    mode: process.env.DEVICE_LIMIT_MODE === "per-kind" ? "per-kind" : "single",
  };
}

const ID_RE = /^[A-Za-z0-9._:-]{8,100}$/;
const clip = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);

/** Read and validate the `device` object sent by the apps. Null when absent/invalid. */
export function parseDevice(raw: unknown): DeviceInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id ?? "");
  const kind = r.kind === "mobile" || r.kind === "desktop" ? r.kind : null;
  if (!ID_RE.test(id) || !kind) return null;
  return {
    id,
    kind,
    name: clip(r.name, 80),
    platform: clip(r.platform, 20).toLowerCase(),
    appVersion: clip(r.appVersion, 20),
  };
}

export const isStudentRole = (role: string | undefined) => role !== "admin" && role !== "super-admin";

export type ClaimResult =
  | { ok: true; did?: string }
  | {
      ok: false;
      status: number;
      code: "DEVICE_LIMIT" | "DEVICE_SWITCH_LIMIT" | "APP_UPDATE_REQUIRED";
      message: string;
      current?: { name: string; platform: string; lastSeenAt: string };
      switchesLeft?: number;
    };

/** JSON error for a failed claim (the apps read `code`). */
export function claimErrorResponse(r: Extract<ClaimResult, { ok: false }>): NextResponse {
  return NextResponse.json(
    { success: false, code: r.code, message: r.message, current: r.current, switchesLeft: r.switchesLeft },
    { status: r.status },
  );
}

const kindLabel = (k: DeviceKind) => (k === "mobile" ? "phone or tablet" : "computer");
const kindShort = (k: string) => (k === "mobile" ? "phone" : "computer");

type Db = Prisma.TransactionClient | typeof prisma;

/** Replacements used in the current window (counting restarts after an admin reset). */
async function switchesUsed(db: Db, userId: string, kind: DeviceKind | null, s: DeviceSettings): Promise<number> {
  const windowStart = new Date(Date.now() - s.windowDays * 24 * 60 * 60 * 1000);
  const lastReset = await db.studentDeviceEvent.findFirst({
    where: { userId, action: "admin_reset" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const since = lastReset && lastReset.createdAt > windowStart ? lastReset.createdAt : windowStart;
  return db.studentDeviceEvent.count({
    where: { userId, action: "switch", createdAt: { gt: since }, ...(kind ? { kind } : {}) },
  });
}

/** Security alert to the account email when the account moves to a new device. */
async function sendSwitchAlert(userId: string, from: string, to: string): Promise<void> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
  if (!u?.email) return;
  const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
  const when = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#0f172a">
      <h2 style="color:#6c47ff;margin:0 0 12px">Your CodingKida account moved to a new device</h2>
      <p>Hi ${esc(u.name || "there")},</p>
      <p>On ${esc(when)} (IST) your account was signed in on <b>${esc(to || "a new device")}</b>.
         The previous device${from ? ` (<b>${esc(from)}</b>)` : ""} was signed out, because a CodingKida account can be used on one device at a time.</p>
      <p>If this was you, you don't need to do anything.</p>
      <p>If this wasn't you, please change your password and contact CodingKida support.</p>
    </div>`;
  await sendEmail(u.email, "Your CodingKida account was signed in on a new device", html);
}

/**
 * Called on sign-in. Registers the device, or reports a conflict, or (with
 * `replace`) moves the slot to this device and signs the old one out.
 * Runs in a transaction holding a per-student lock, so two sign-ins at the same
 * moment on two devices can't both take the slot.
 */
export async function claimDevice(
  user: { id: string; role: string },
  device: DeviceInfo | null,
  opts: { replace?: boolean } = {},
): Promise<ClaimResult> {
  const s = deviceSettings();
  if (!isStudentRole(user.role)) return { ok: true };
  if (!device) {
    if (s.enabled && s.blockOldApps) {
      return { ok: false, status: 426, code: "APP_UPDATE_REQUIRED", message: "Please update the CodingKida app to the latest version to sign in." };
    }
    return { ok: true };
  }
  if (!s.enabled) return { ok: true, did: device.id };

  let switched: { from: string; to: string } | null = null;
  let result: ClaimResult;
  try {
  result = await prisma.$transaction(async (tx): Promise<ClaimResult> => {
    // One sign-in decision per student at a time (released when the transaction ends).
    // ($executeRaw, not $queryRaw: the lock function returns `void`, which Prisma can't read back.)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`student-device:${user.id}`}))`;

    const now = new Date();
    const meta = { name: device.name, platform: device.platform, appVersion: device.appVersion, lastSeenAt: now };
    const existing = await tx.studentDevice.findUnique({
      where: { userId_deviceId: { userId: user.id, deviceId: device.id } },
    });
    if (existing && !existing.revokedAt) {
      await tx.studentDevice.update({ where: { id: existing.id }, data: meta });
      return { ok: true, did: device.id };
    }

    // "single" mode: any other active device (phone OR computer) takes the one slot.
    const single = s.mode === "single";
    const active = await tx.studentDevice.findFirst({
      where: { userId: user.id, ...(single ? {} : { kind: device.kind }), revokedAt: null, NOT: { deviceId: device.id } },
      orderBy: { lastSeenAt: "desc" },
    });

    const activate = () =>
      tx.studentDevice.upsert({
        where: { userId_deviceId: { userId: user.id, deviceId: device.id } },
        create: { userId: user.id, kind: device.kind, deviceId: device.id, ...meta },
        update: { kind: device.kind, ...meta, revokedAt: null, revokedBy: null },
      });

    if (!active) {
      await activate();
      await tx.studentDeviceEvent.create({
        data: { userId: user.id, kind: device.kind, deviceId: device.id, action: "register", actor: "student", detail: device.name },
      });
      return { ok: true, did: device.id };
    }

    const used = await switchesUsed(tx, user.id, single ? null : device.kind, s);
    const switchesLeft = Math.max(0, s.switchLimit - used);
    const otherLabel = single ? `device (${kindShort(active.kind)}: ${active.name || "unknown"})` : `${kindLabel(device.kind)} (${active.name || "unknown"})`;
    const current = { name: active.name || `Another ${kindShort(active.kind)}`, platform: active.platform, lastSeenAt: active.lastSeenAt.toISOString() };
    const here = single ? "device" : kindLabel(device.kind);

    if (switchesLeft <= 0) {
      return {
        ok: false, status: 403, code: "DEVICE_SWITCH_LIMIT", current, switchesLeft: 0,
        message: `This account is already used on another ${otherLabel}, and the device can't be changed again right now. Please contact CodingKida support.`,
      };
    }
    if (!opts.replace) {
      return {
        ok: false, status: 409, code: "DEVICE_LIMIT", current, switchesLeft,
        message: `This account is already used on another ${otherLabel}. Use this ${here} instead? The other one will be signed out.`,
      };
    }

    // Sign out EVERY other active device in the slot (also repairs any leftover duplicates).
    await tx.studentDevice.updateMany({
      where: { userId: user.id, ...(single ? {} : { kind: device.kind }), revokedAt: null, NOT: { deviceId: device.id } },
      data: { revokedAt: now, revokedBy: "switch" },
    });
    await activate();
    await tx.studentDeviceEvent.create({
      data: { userId: user.id, kind: single ? "any" : device.kind, deviceId: device.id, action: "switch", actor: "student", detail: `${active.name} -> ${device.name}` },
    });
    switched = { from: active.name, to: device.name };
    return { ok: true, did: device.id };
  }, { timeout: 15000 });
  } catch (err) {
    // Never block sign-in because of a database problem (e.g. the device tables
    // are not there yet): let the student in without a device tie, and log it.
    logger.error("student-device", "claim_failed", { userId: user.id, error: err instanceof Error ? err.message : "unknown" });
    return { ok: true };
  }

  if (switched) {
    const sw = switched as { from: string; to: string };
    forgetUser(user.id);
    logger.info("student-device", "switched", { userId: user.id, kind: device.kind });
    sendSwitchAlert(user.id, sw.from, sw.to).catch(() => {});
  }
  return result;
}

// ── Per-request check (cached so key routes don't hit the DB every time) ────
const CACHE_MS = 60 * 1000;
const SEEN_WRITE_MS = 15 * 60 * 1000;
const cache = new Map<string, { ok: boolean; at: number; seenAt: number }>();

export function forgetUser(userId: string): void {
  for (const k of cache.keys()) if (k.startsWith(`${userId}|`)) cache.delete(k);
}

/** Error to return when this token's device may no longer be used; null when fine. */
export async function checkStudentDevice(user: JwtPayload | null | undefined): Promise<NextResponse | null> {
  if (!user || !isStudentRole(user.role)) return null;
  // An account waiting for deletion (or deleted) can't be used until it signs in again.
  if (await isDeletionPending(user.userId)) {
    return NextResponse.json(
      {
        success: false,
        code: "ACCOUNT_DELETED",
        message: "This account is scheduled for deletion. Sign in again to restore it.",
      },
      { status: 401 },
    );
  }
  const s = deviceSettings();
  if (!s.enabled) return null;
  if (!user.did) {
    if (s.blockOldApps) {
      return NextResponse.json(
        { success: false, code: "APP_UPDATE_REQUIRED", message: "Please update the CodingKida app and sign in again." },
        { status: 401 },
      );
    }
    return null;
  }
  const key = `${user.userId}|${user.did}`;
  const now = Date.now();
  let entry = cache.get(key);
  if (!entry || now - entry.at > CACHE_MS) {
    try {
      const row = await prisma.studentDevice.findUnique({
        where: { userId_deviceId: { userId: user.userId, deviceId: user.did } },
        select: { revokedAt: true, lastSeenAt: true },
      });
      entry = { ok: !!row && !row.revokedAt, at: now, seenAt: row?.lastSeenAt.getTime() ?? 0 };
      cache.set(key, entry);
    } catch {
      return null; // never lock students out because of a DB hiccup
    }
  }
  if (!entry.ok) {
    return NextResponse.json(
      {
        success: false,
        code: "DEVICE_REVOKED",
        message: "You were signed out because this account is now used on another device. Sign in again to use it here.",
      },
      { status: 401 },
    );
  }
  if (now - entry.seenAt > SEEN_WRITE_MS) {
    entry.seenAt = now;
    prisma.studentDevice
      .update({ where: { userId_deviceId: { userId: user.userId, deviceId: user.did } }, data: { lastSeenAt: new Date(now) } })
      .catch(() => {});
  }
  return null;
}

// ── Admin ────────────────────────────────────────────────────────────────────
export async function listStudentDevices(userId: string) {
  const s = deviceSettings();
  const [devices, events, usedMobile, usedDesktop, usedAll] = await Promise.all([
    prisma.studentDevice.findMany({ where: { userId }, orderBy: [{ revokedAt: "asc" }, { lastSeenAt: "desc" }] }),
    prisma.studentDeviceEvent.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
    switchesUsed(prisma, userId, "mobile", s),
    switchesUsed(prisma, userId, "desktop", s),
    switchesUsed(prisma, userId, null, s),
  ]);
  return {
    devices: devices.map((d) => ({
      deviceId: d.deviceId, kind: d.kind, name: d.name, platform: d.platform, appVersion: d.appVersion,
      createdAt: d.createdAt.toISOString(), lastSeenAt: d.lastSeenAt.toISOString(),
      active: !d.revokedAt, revokedAt: d.revokedAt?.toISOString() ?? null, revokedBy: d.revokedBy,
    })),
    events: events.map((e) => ({ action: e.action, kind: e.kind, actor: e.actor, detail: e.detail, createdAt: e.createdAt.toISOString() })),
    switchesLeft: {
      mobile: Math.max(0, s.switchLimit - usedMobile),
      desktop: Math.max(0, s.switchLimit - usedDesktop),
      any: Math.max(0, s.switchLimit - usedAll),
    },
    settings: s,
  };
}

/** Unlink one device (deviceId) or all devices (deviceId = null; also resets the switch count). */
export async function adminUnlink(userId: string, deviceId: string | null, adminId: string): Promise<number> {
  const now = new Date();
  const where = deviceId ? { userId, deviceId, revokedAt: null } : { userId, revokedAt: null };
  const res = await prisma.studentDevice.updateMany({ where, data: { revokedAt: now, revokedBy: `admin:${adminId}` } });
  await prisma.studentDeviceEvent.create({
    data: {
      userId, kind: deviceId ? "one" : "all", deviceId: deviceId ?? "",
      action: deviceId ? "admin_unlink" : "admin_reset", actor: adminId,
    },
  });
  forgetUser(userId);
  logger.info("student-device", deviceId ? "admin_unlink" : "admin_reset", { userId, adminId, count: res.count });
  return res.count;
}

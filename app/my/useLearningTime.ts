"use client";
import { useEffect, useRef } from "react";
import { getToken } from "@/services/auth";

/**
 * Learning-time tracking — the website port of the desktop attendance.js, so
 * My Report shows the same numbers on every device (the server's DailyActivity
 * is the single source of truth; POST /api/attendance adds minutes atomically).
 *
 * Counts time only while really learning: a video is playing, OR the student is
 * on a learning page (lesson, code editor, live room, AI) with the tab visible
 * and focused and used mouse/keyboard in the last 5 minutes. Whole minutes are
 * sent every 5 minutes, when the tab is hidden and when it closes. Failed sends
 * are queued in localStorage and retried.
 */
const TICK = 60_000, FLUSH = 5 * 60_000, MAX_GAP = 3 * 60_000, IDLE = 5 * 60_000;
const LEARNING = [/^\/my\/lesson\//, /^\/my\/code/, /^\/my\/live\/.+/, /^\/my\/ai/, /^\/my\/final-test\//];

const day = (ms = Date.now()) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
type Item = { date: string; minutes: number; sessions: number };

export function useLearningTime(userId: string, pathname: string) {
  const path = useRef(pathname);
  path.current = pathname;

  useEffect(() => {
    if (!userId) return;
    const qKey = `ck_attendance_queue_${userId}`;
    const st = { lastTick: Date.now(), lastInput: Date.now(), pendingMs: 0, pendingDay: "" as string, sessionSent: false, sending: false };

    const readQ = (): Item[] => { try { return JSON.parse(localStorage.getItem(qKey) || "[]") || []; } catch { return []; } };
    const writeQ = (q: Item[]) => { try { localStorage.setItem(qKey, JSON.stringify(q.slice(-200))); } catch { /* ignore */ } };
    const post = (it: Item) => {
      const token = getToken();
      return fetch("/api/attendance", {
        method: "POST", keepalive: true,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(it),
      });
    };

    const flush = (all: boolean, closing = false) => {
      let mins = Math.floor(st.pendingMs / 60_000);
      if (all && st.pendingMs - mins * 60_000 >= 30_000) mins += 1;
      const d = st.pendingDay || day();
      st.pendingMs = all ? 0 : Math.max(0, st.pendingMs - mins * 60_000);
      if (all) st.pendingDay = "";
      if (!getToken()) return;
      const q = readQ();
      if (mins > 0) { q.push({ date: d, minutes: mins, sessions: st.sessionSent ? 0 : 1 }); st.sessionSent = true; writeQ(q); }
      if (!q.length || st.sending) return;
      if (closing) { writeQ([]); q.forEach((it) => post(it).catch(() => {})); return; }
      st.sending = true;
      const next = async (): Promise<void> => {
        const cur = readQ();
        if (!cur.length) return;
        const r = await post(cur[0]);
        if (!r.ok) throw new Error("not saved");
        writeQ(readQ().slice(1));
        return next();
      };
      next().catch(() => {}).finally(() => { st.sending = false; });
    };

    const playing = () => Array.from(document.getElementsByTagName("video")).some((v) => !v.paused && !v.ended && v.readyState > 2);
    const active = (now: number) => {
      if (playing()) return true;
      if (!LEARNING.some((r) => r.test(path.current))) return false;
      if (document.visibilityState === "hidden" || !document.hasFocus()) return false;
      return now - st.lastInput < IDLE;
    };
    const tick = () => {
      const now = Date.now();
      const gap = now - st.lastTick;
      st.lastTick = now;
      if (gap > 0 && gap <= MAX_GAP && active(now)) {
        const d = day(now);
        if (st.pendingDay && st.pendingDay !== d) flush(true); // midnight: close yesterday
        st.pendingDay = d;
        st.pendingMs += gap;
      }
      if (st.pendingMs >= FLUSH) flush(false);
    };

    const onInput = () => { st.lastInput = Date.now(); };
    const onVis = () => {
      if (document.visibilityState === "hidden") { tick(); flush(false); }
      else { st.lastTick = Date.now(); st.lastInput = Date.now(); st.sessionSent = false; }
    };
    const onHide = () => { tick(); flush(true, true); };

    const evs = ["mousemove", "mousedown", "keydown", "wheel", "touchstart"] as const;
    evs.forEach((e) => window.addEventListener(e, onInput, { passive: true }));
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    const t = setInterval(tick, TICK);
    flush(false); // retry anything queued from last time

    return () => {
      clearInterval(t);
      evs.forEach((e) => window.removeEventListener(e, onInput));
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
      tick(); flush(true, true);
    };
  }, [userId]);
}

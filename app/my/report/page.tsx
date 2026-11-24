"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { api, apiCached, apiOnce } from "../api";
import { useMy } from "../MyContext";
import { Loading, PageHeader, btn, fmtDate } from "@/components/my/ui";

/**
 * My Report — same as the mobile app (CodingKidaApps/app/my-report.tsx):
 * KPIs · one-month "Your Coding Journey" calendar with ‹ › (back to the join month,
 * max 12 months) · day popup with what was done that day · motivation ·
 * weekly report for parents (WhatsApp) · achievements · coins · expandable course progress.
 */

type Course = { id: string; title: string; progressPercent: number; completedLessons: number; totalLessons: number };
type Ach = { id: string; title: string; badgeType: string; courseTitle?: string; moduleTitle?: string; lessonTitle?: string; score?: number; rank?: number; earnedAt?: string; createdAt?: string };
type Tx = { id: string; type: string; coins: number; reason?: string; createdAt: string; courseTitle?: string; moduleTitle?: string; lessonTitle?: string };
type DayRec = { date: string; minutes: number; sessions: number };
type DayActivity = {
  date: string; minutes: number; sessions: number;
  lessons: { title: string; module: string; course: string; at: string }[];
  quizzes: { lesson: string; module: string; course: string; correct: number; total: number; at: string }[];
  exercises: { title: string; lesson: string; module: string; course: string; language: string; passed: boolean; attempts: number; at: string }[];
  coins: { type: string; coins: number; reason: string; lesson: string; module: string; course: string; at: string }[];
  badges: { title: string; lesson: string; module: string; course: string; at: string }[];
};
type CourseDetail = { modules: { id: string; title: string; lessons: { id: string; title: string }[] }[]; completedLessons: string[] };

const DAY_GOAL_MINS = 20;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtMins = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.floor(m / 60)}h`);
const fmtKpi = (m: number) => (!m ? "—" : fmtMins(m));
const fmtClock = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }); };
const fmtTxDate = (iso: string) => { const d = new Date(iso); return `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`; };

// ── Weekly report helpers (same as mobile weeklyReport.util.ts) ──
function normalizeWhatsAppNumber(raw?: string | null): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10) return "91" + d;
  if (d.length === 11 && d.startsWith("0")) return "91" + d.slice(1);
  if (d.length >= 11 && d.length <= 15) return d;
  return null;
}
const maskNumber = (n: string) => (n.length < 7 ? n : `+${n.slice(0, n.length - 10)} ${n.slice(-10, -8)}••• •••${n.slice(-3)}`);
function currentWeekLabel(now = new Date()) {
  const monday = new Date(now); monday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const f = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${f(monday)} – ${f(sunday)}`;
}

const BADGE: Record<string, { emoji: string; label: string; color: string }> = {
  "super-master": { emoji: "🥇", label: "Quiz Gold", color: "#fbbf24" },
  master: { emoji: "🥈", label: "Quiz Silver", color: "#cbd5e1" },
  pro: { emoji: "🥉", label: "Quiz Bronze", color: "#fb923c" },
};

function buildDayDetail(key: string, mins: number, opens: number, mode: "past" | "future") {
  const [y, mo, d] = key.split("-").map(Number);
  const title = new Date(y, mo - 1, d).toLocaleDateString("en-IN", { weekday: "long", month: "short", day: "numeric" });
  if (mode === "future") return { emoji: "📅", accent: "#a78bfa", title, badge: "Plan a coding session!", message: `This day is coming up. Set a goal to code for at least ${DAY_GOAL_MINS} minutes and keep your streak strong! 🚀`, showStats: false, mins, opens, pct: 0 };
  if (mins <= 0) return { emoji: "😴", accent: "#64748b", title, badge: "No coding this day", message: "Every day counts! Jump back in and earn coins, badges and keep your streak alive. 💪", showStats: false, mins, opens, pct: 0 };
  const t = mins < 15
    ? { emoji: "🌱", badge: "Nice start!", accent: "#c4b5fd", message: "You showed up and learned — that's what matters. Keep it up!" }
    : mins < 30
      ? { emoji: "🔥", badge: "Great focus!", accent: "#a855f7", message: "Awesome focus today. You're building a strong coding habit!" }
      : { emoji: "🚀", badge: "Coding superstar!", accent: "#ec4899", message: "Incredible effort! You're a true CodingKida superstar today!" };
  return { ...t, title, showStats: true, mins, opens, pct: Math.min(100, Math.round((mins / DAY_GOAL_MINS) * 100)) };
}

export default function ReportPage() {
  const { user } = useMy();
  const [dash, setDash] = useState<{ enrolledCount: number; enrolledCourses: Course[] } | null>(null);
  const [coins, setCoins] = useState<{ totalCoins: number; transactions: Tx[] }>({ totalCoins: 0, transactions: [] });
  const [ach, setAch] = useState<Ach[]>([]);
  const [hist, setHist] = useState<{ joinedAt: string | null; days: DayRec[] }>({ joinedAt: null, days: [] });
  const [streak, setStreak] = useState(0);
  const [profile, setProfile] = useState<{ name: string; parentName: string; parentContact: string }>({ name: "", parentName: "", parentContact: "" });
  const [viewAbs, setViewAbs] = useState<number | null>(null);
  const [badgeSel, setBadgeSel] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [day, setDay] = useState<ReturnType<typeof buildDayDetail> | null>(null);
  const [dayAct, setDayAct] = useState<DayActivity | null>(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [openCourse, setOpenCourse] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, CourseDetail>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);

  // Opening the page: cached copy first, then a background refresh (desktop).
  // Refresh button (force): straight from the server.
  const load = useCallback(async (force = false) => {
    setRefreshing(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const get = (p: string, fn: (d: any) => void | Promise<void>) => (force ? api(p).then(fn) : apiCached(p, fn));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const one = (p: string): Promise<any> => (force ? api(p) : apiOnce(p));
    await Promise.allSettled([
      get("/api/student/dashboard", async (d) => {
        setDash(d);
        const counts = await Promise.all((d.enrolledCourses || []).map((c: Course) =>
          one(`/api/weekly-streak?courseId=${encodeURIComponent(c.id)}`).then((r) => r.completedCount || 0).catch(() => 0)));
        setStreak(counts.reduce((a: number, b: number) => a + b, 0));
      }).catch(() => setDash({ enrolledCount: 0, enrolledCourses: [] })),
      get("/api/coins", (d) => setCoins({ totalCoins: d.totalCoins || 0, transactions: d.transactions || [] })),
      get("/api/achievements", (d) => setAch(d.achievements || [])),
      // Attendance is not cached (desktop doesn't cache it either) — the calendar is always live.
      api("/api/attendance").then((d) => setHist({ joinedAt: d.joinedAt || null, days: d.days || [] })),
      get("/api/student", (d) => {
        const s = d.student || {};
        setProfile({ name: (s.studentName || s.name || "").trim(), parentName: (s.parentName || "").trim(), parentContact: s.parentContact || "" });
      }),
    ]);
    setRefreshing(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  // ── Calendar data (mobile calData) ──
  const cal = useMemo(() => {
    const today = new Date();
    const curAbs = today.getFullYear() * 12 + today.getMonth();
    const todayKey = dayKey(today);
    const byDate: Record<string, DayRec> = {};
    hist.days.forEach((d) => { byDate[d.date] = d; });
    let minAbs = curAbs - 11; // at most 12 months back…
    const joinSrc = hist.joinedAt || Object.keys(byDate).sort()[0] || null;
    if (joinSrc) {
      const jd = new Date(joinSrc);
      if (!isNaN(jd.getTime())) { const ja = jd.getFullYear() * 12 + jd.getMonth(); if (ja > minAbs && ja <= curAbs) minAbs = ja; } // …but not before joining
    }
    return { byDate, curAbs, minAbs, todayKey };
  }, [hist]);

  const vAbs = Math.min(cal.curAbs, Math.max(cal.minAbs, viewAbs ?? cal.curAbs));
  const month = useMemo(() => {
    const y = Math.floor(vAbs / 12), m = vAbs - y * 12;
    const daysIn = new Date(y, m + 1, 0).getDate();
    const fd = new Date(y, m, 1).getDay();
    const pad = fd === 0 ? 6 : fd - 1;
    let active = 0;
    const cells: ({ key: string; d: number; mins: number; today: boolean; future: boolean } | null)[] = Array(pad).fill(null);
    for (let d = 1; d <= daysIn; d++) {
      const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const mins = cal.byDate[key]?.minutes || 0;
      const future = key > cal.todayKey;
      if (mins > 0 && !future) active++;
      cells.push({ key, d, mins, today: key === cal.todayKey, future });
    }
    return { label: `${MONTHS[m]} ${y}`, active, cells };
  }, [vAbs, cal]);

  // Today + This Week (Monday → today) from the same per-day minutes.
  const { todayMins, weekMins, weekDays } = useMemo(() => {
    const now = new Date();
    const back = now.getDay() === 0 ? 6 : now.getDay() - 1;
    let mins = 0, days = 0;
    for (let i = back; i >= 0; i--) {
      const m = cal.byDate[dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i))]?.minutes || 0;
      mins += m; if (m > 0) days++;
    }
    return { todayMins: cal.byDate[cal.todayKey]?.minutes || 0, weekMins: mins, weekDays: days };
  }, [cal]);

  // Mon→Sun bars for the current week (same per-day minutes as the calendar).
  const { week, weekMax } = useMemo(() => {
    const now = new Date();
    const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const w = labels.map((label, i) => {
      const key = dayKey(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i));
      return { key, label, mins: cal.byDate[key]?.minutes || 0, today: key === cal.todayKey, future: key > cal.todayKey };
    });
    return { week: w, weekMax: Math.max(30, ...w.map((x) => x.mins)) };
  }, [cal]);

  // Motivation (mobile): this week vs last week vs best week in the last 30 days.
  const motivation = useMemo(() => {
    const now = new Date();
    const off = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const last30 = Array.from({ length: 30 }, (_, i) => (cal.byDate[dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (29 - i)))]?.minutes || 0) > 0);
    const thisW = last30.slice(-(off + 1)).filter(Boolean).length;
    const lastW = last30.slice(-(off + 8), -(off + 1)).filter(Boolean).length;
    let best = 0; for (let i = 0; i < 30; i += 7) best = Math.max(best, last30.slice(i, i + 7).filter(Boolean).length);
    let icon = "🌱", title = "Ready for this week’s mission?", text = "Start a coding session and keep your journey moving!";
    if (thisW > 0 && thisW <= 2) { icon = "🚀"; title = "You’re getting started!"; text = `You've coded ${thisW} day${thisW > 1 ? "s" : ""} this week. Keep the momentum going!`; }
    else if (thisW >= 3 && thisW <= 4) { icon = "🔥"; title = "You’re on a roll!"; text = `${thisW} coding days this week! You're crushing it!`; }
    else if (thisW >= 5) { icon = "🏆"; title = "Coding superstar!"; text = `${thisW} days of coding this week — incredible consistency!`; }
    if (thisW > 0 && thisW > lastW && thisW >= best) { icon = "🎉"; title = "NEW RECORD!"; text = `You just had your strongest learning week! ${thisW} days of pure coding! 🚀`; }
    return { icon, title, text, thisW };
  }, [cal]);

  const openDay = async (key: string) => {
    if (key > cal.todayKey) { setDayAct(null); setDay(buildDayDetail(key, 0, 0, "future")); return; }
    const rec = cal.byDate[key];
    setDay(buildDayDetail(key, rec?.minutes || 0, rec?.sessions || 0, "past"));
    setDayAct(null); setDayLoading(true);
    try {
      const r = await api(`/api/student/activity?from=${key}&to=${key}`);
      const a: DayActivity | null = r.days?.[0] ?? null;
      setDayAct(a);
      if (a) setDay(buildDayDetail(key, a.minutes, a.sessions, "past"));
    } catch { /* keep the time summary */ } finally { setDayLoading(false); }
  };
  const closeDay = () => { setDay(null); setDayAct(null); setDayLoading(false); };
  useEffect(() => {
    if (!day) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && closeDay();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [day]);

  const toggleCourse = async (id: string) => {
    if (openCourse === id) { setOpenCourse(null); return; }
    setOpenCourse(id);
    if (details[id]) return;
    setDetailLoading(id);
    try {
      const d = await api(`/api/courses/${encodeURIComponent(id)}`);
      if (d.course) setDetails((p) => ({ ...p, [id]: { modules: d.course.modules || [], completedLessons: d.course.completedLessons || [] } }));
    } catch { /* show friendly message */ } finally { setDetailLoading(null); }
  };

  if (!dash) return <div className="w-full pt-2"><PageHeader icon="📊" title="My Report" sub="Your learning journey at a glance 🚀" back="/my/dashboard" /><Loading text="Loading your report..." /></div>;

  const courses = dash.enrolledCourses || [];
  const totalLessons = courses.reduce((s, c) => s + (c.completedLessons || 0), 0);
  const counts = { "super-master": 0, master: 0, pro: 0 } as Record<string, number>;
  ach.forEach((a) => { if (counts[a.badgeType] !== undefined) counts[a.badgeType]++; });
  const filtered = badgeSel ? ach.filter((a) => a.badgeType === badgeSel) : [];
  const atOldest = vAbs <= cal.minAbs, atNewest = vAbs >= cal.curAbs;

  // ── Weekly report for parents (same message as the mobile app) ──
  const studentName = profile.name || user?.name || "Student";
  const parentNum = normalizeWhatsAppNumber(profile.parentContact);
  const reportText = (() => {
    const hello = profile.parentName ? `Hello ${profile.parentName} 🙏` : "Hello 🙏";
    const lines = [
      "📊 *Weekly Learning Report*",
      `👤 *${studentName}* · ${currentWeekLabel()}`,
      "",
      `${hello}, here is how ${studentName} did on CodingKida this week:`,
      "",
      `⏱ Learning time: *${fmtKpi(weekMins)}*`,
      `📅 Active days: *${weekDays} / 7*`,
      `🔥 Weekly streak: *${streak}*`,
      `✅ Lessons completed: *${totalLessons}*`,
      `🪙 Coins: *${coins.totalCoins}*`,
      `🏆 Achievements: *${ach.length}*`,
    ];
    if (courses.length) {
      lines.push("", "📚 *Course progress*");
      courses.slice(0, 6).forEach((c) => lines.push(`• ${c.title}: *${Math.round(c.progressPercent || 0)}%* (${c.completedLessons || 0}/${c.totalLessons || 0} lessons)`));
    }
    lines.push("", `💬 ${motivation.title} ${motivation.text}`, "", `Please encourage ${studentName} to code a little every day — small steps add up! 🚀`, "— Team CodingKida · www.codingkida.com");
    return lines.join("\n");
  })();
  const waUrl = `https://wa.me/${parentNum || ""}?text=${encodeURIComponent(reportText)}`;

  return (
    <div className="w-full space-y-4 pt-2">
      <PageHeader icon="📊" back="/my/dashboard" title={<><span>My </span><span className="bg-gradient-to-r from-violet-400 to-pink-500 bg-clip-text text-transparent">Report</span></>} sub="Your learning journey at a glance 🚀"
        right={<button onClick={() => load(true)} disabled={refreshing} className={`${btn} border border-violet-400/25 bg-violet-500/5 text-violet-300 disabled:opacity-60`}>{refreshing ? "⏳" : "🔄"} Refresh</button>} />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard href="/my/enrolled" emoji="📚" color="#8B5CF6" value={dash.enrolledCount ?? courses.length} label="Courses Enrolled" sub="view all →" />
        <KpiCard href="/my/completed" emoji="✅" color="#22C55E" value={totalLessons} label="Lessons Completed" sub="view all →" />
        <KpiCard emoji="⏱" color="#F59E0B" value={fmtKpi(todayMins)} label="Today" sub={todayMins > 0 ? "learning time" : "no activity yet"} />
        <KpiCard emoji="📅" color="#EC4899" value={fmtKpi(weekMins)} label="This Week" sub={`${weekDays} active days / 7`} />
      </div>

      {/* Row 2: compact calendar · this week · parent report — three equal cards, like a pro dashboard */}
      <div className="grid items-stretch gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {/* Your Coding Journey — one month, ‹ › */}
        <section className="rounded-2xl border border-white/10 bg-[#161626]/75 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-extrabold">🗓 Your Coding Journey</h2>
            <div className="flex items-center gap-1">
              <button onClick={() => setViewAbs(vAbs - 1)} disabled={atOldest} aria-label="Previous month"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition hover:bg-violet-500/20 disabled:opacity-30"><ChevronLeft size={15} /></button>
              <div className="min-w-[118px] text-center leading-tight">
                <div className="text-sm font-extrabold">{month.label}</div>
                <div className="text-[10px] font-semibold text-violet-300">{month.active} active day{month.active === 1 ? "" : "s"}</div>
              </div>
              <button onClick={() => setViewAbs(vAbs + 1)} disabled={atNewest} aria-label="Next month"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition hover:bg-violet-500/20 disabled:opacity-30"><ChevronRight size={15} /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-500">{["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i}>{d}</div>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {month.cells.map((c, i) => {
              if (!c) return <div key={`p${i}`} />;
              let cls = "border-white/10 bg-white/[0.04] text-slate-400";
              if (c.mins > 0 && c.mins < 15) cls = "border-[rgba(124,58,237,0.35)] bg-[rgba(124,58,237,0.20)] text-[#C4B5FD]";
              else if (c.mins >= 15 && c.mins < 30) cls = "border-[rgba(168,85,247,0.5)] bg-[#7C3AED] text-white";
              else if (c.mins >= 30) cls = "border-[rgba(236,72,153,0.5)] bg-[#A855F7] text-white";
              if (c.future) cls = "border-dashed border-violet-400/15 bg-white/[0.02] text-slate-500";
              return (
                <button key={c.key} onClick={() => openDay(c.key)} title={c.mins ? `${c.key}: ${fmtMins(c.mins)}` : c.key}
                  className={`flex h-9 items-center justify-center rounded-lg border text-xs transition hover:scale-110 hover:shadow-lg ${cls} ${c.today ? "!border-2 !border-[#A78BFA] font-extrabold !text-[#A78BFA]" : c.mins ? "font-bold" : ""}`}>
                  {c.d}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
            <span className="flex flex-wrap gap-2.5">
              <Legend cls="border border-white/10 bg-white/[0.04]" label="Inactive" />
              <Legend cls="bg-[rgba(124,58,237,0.35)]" label="Started" />
              <Legend cls="bg-[#7C3AED]" label="Focused" />
              <Legend cls="bg-[#A855F7]" label="On Fire" />
            </span>
            <span className="text-slate-500">Tap a day 👆</span>
          </div>
        </section>

        {/* This week — Mon→Sun bar chart + motivation */}
        <section className="flex flex-col rounded-2xl border border-violet-400/25 bg-gradient-to-br from-violet-600/15 via-[#161626]/80 to-fuchsia-600/10 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-extrabold">📈 This Week</h2>
            <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-bold text-violet-200">{fmtKpi(weekMins)} · {weekDays}/7 days</span>
          </div>
          <div className="flex h-32 items-end justify-between gap-2 rounded-xl bg-black/20 px-3 pb-2 pt-3">
            {week.map((w) => {
              const h = w.mins ? Math.max(10, Math.round((w.mins / weekMax) * 100)) : 4;
              const col = w.future ? "bg-white/[0.06]" : w.mins >= 30 ? "bg-gradient-to-t from-fuchsia-500 to-violet-400" : w.mins >= 15 ? "bg-violet-500" : w.mins > 0 ? "bg-violet-500/50" : "bg-white/10";
              return (
                <button key={w.key} onClick={() => openDay(w.key)} title={`${w.label}: ${w.mins ? fmtMins(w.mins) : "no coding"}`} className="group flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[9px] font-bold text-slate-400 opacity-0 transition group-hover:opacity-100">{w.mins ? fmtMins(w.mins) : ""}</span>
                  <span className={`w-full max-w-[26px] rounded-md transition group-hover:brightness-125 ${col}`} style={{ height: `${h}%` }} />
                  <span className={`text-[10px] font-bold ${w.today ? "text-violet-300" : "text-slate-500"}`}>{w.label}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-white/[0.04] p-3">
            <span className="text-2xl leading-none">{motivation.icon}</span>
            <div className="min-w-0"><div className="text-sm font-extrabold">{motivation.title}</div><div className="text-xs text-slate-300">{motivation.text}</div></div>
          </div>
        </section>

        <div className="lg:col-span-2 2xl:col-span-1">
          {/* Weekly report for parents → WhatsApp (mobile ParentReportCard) */}
          <section className="flex h-full flex-col rounded-2xl border border-[rgba(37,211,102,0.3)] bg-[rgba(37,211,102,0.07)] p-4">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgba(37,211,102,0.18)] text-2xl">👪</span>
              <div className="min-w-0">
                <div className="font-extrabold">Weekly report for parents</div>
                <div className="text-xs text-slate-400">{parentNum ? `Goes to ${profile.parentName || "your parent"} · ${maskNumber(parentNum)}` : "Add your parent’s WhatsApp number to send it in one tap"}</div>
              </div>
            </div>
            <a href={waUrl} target="_blank" rel="noopener noreferrer"
              className="block rounded-xl bg-[#25D366] py-3 text-center text-sm font-black text-white transition hover:brightness-105">💬 Send this week’s report on WhatsApp</a>
            {!parentNum && <Link href="/my/profile" className="mt-2 block text-center text-sm font-extrabold text-[#25D366] hover:underline">＋ Add parent’s number</Link>}
            <details className="mt-3 text-xs text-slate-400">
              <summary className="cursor-pointer font-semibold text-slate-300">👀 Preview the message</summary>
              <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-xl bg-black/30 p-3 font-sans text-[12px] leading-relaxed text-slate-200">{reportText}</pre>
            </details>
          </section>
        </div>
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        {/* Achievements */}
        <section className="rounded-2xl border border-white/10 bg-[#161626]/75 p-4">
          <h2 className="mb-3 text-base font-extrabold">🏆 Recent Achievement</h2>
          {ach.length === 0 ? (
            <div className="py-6 text-center"><div className="text-4xl">🏆</div><div className="mt-1 font-bold">No achievements yet</div><div className="text-sm text-slate-400">Complete quizzes to earn badges!</div></div>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-3 gap-3">
                {(["super-master", "master", "pro"] as const).map((t) => (
                  <button key={t} onClick={() => setBadgeSel(badgeSel === t ? null : t)}
                    className={`rounded-xl border p-3 text-center transition hover:-translate-y-0.5 ${badgeSel === t ? "border-violet-400 bg-violet-500/20" : "border-white/10 bg-white/[0.03]"}`}>
                    <div className="text-3xl">{BADGE[t].emoji}</div>
                    <div className="text-xl font-extrabold" style={{ color: BADGE[t].color }}>{counts[t]}</div>
                    <div className="text-[11px] text-slate-400">{BADGE[t].label}</div>
                  </button>
                ))}
              </div>
              {badgeSel ? (
                <>
                  <div className="mb-2 text-sm font-bold">{BADGE[badgeSel].emoji} {BADGE[badgeSel].label} Badges ({filtered.length})</div>
                  {filtered.length === 0 ? <div className="text-sm text-slate-400">No {BADGE[badgeSel].label} badges earned yet.</div> : <div className="space-y-2">{filtered.slice(0, 3).map((a) => <AchCard key={a.id} a={a} />)}</div>}
                </>
              ) : <AchCard a={ach[0]} />}
            </>
          )}
        </section>

        {/* Coins */}
        <section className="rounded-2xl border border-white/10 bg-[#161626]/75 p-4">
          <h2 className="mb-3 text-base font-extrabold">🪙 My Coins</h2>
          <div className="mb-3 flex items-center gap-4 rounded-xl border border-amber-400/25 bg-gradient-to-br from-amber-400/15 to-orange-500/5 px-4 py-3">
            <span className="text-4xl">🪙</span>
            <div>
              <div className="text-3xl font-black leading-none text-amber-300">{coins.totalCoins}</div>
              <div className="text-xs font-semibold text-slate-300">Total Coins Earned</div>
            </div>
            <div className="ml-auto max-w-[140px] text-right text-[11px] text-amber-200/80">100+ coins = ₹ discount on next course</div>
          </div>
          <div className="mb-2 text-sm font-bold">Recent Rewards</div>
          {coins.transactions.length === 0 ? <div className="text-sm text-slate-400">No coins yet. Take a quiz to earn your first coins!</div> : (
            <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {coins.transactions.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{t.reason || (t.type === "EARNED" ? "Coins earned" : "Coins spent")}</div>
                    <div className="truncate text-[11px] text-slate-500">{[t.courseTitle, t.moduleTitle, t.lessonTitle].filter(Boolean).join(" · ") || fmtTxDate(t.createdAt)}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-extrabold ${t.type === "EARNED" ? "text-emerald-400" : "text-red-400"}`}>{t.type === "EARNED" ? "+" : "-"}{Math.abs(t.coins)}</div>
                    <div className="text-[10px] text-slate-500">{fmtTxDate(t.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Course progress — expandable (modules → lessons) */}
      <section className="rounded-2xl border border-white/10 bg-[#161626]/75 p-4">
        <h2 className="mb-3 text-base font-extrabold">📖 Course Progress</h2>
        {courses.length === 0 ? <div className="text-sm text-slate-400">No courses enrolled yet.</div> : (
          <div className="grid gap-3 lg:grid-cols-2">
            {courses.map((c) => {
              const pct = Math.round(c.progressPercent || 0);
              const bar = pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-violet-500";
              const open = openCourse === c.id;
              const det = details[c.id];
              const done = new Set(det?.completedLessons || []);
              return (
                <div key={c.id} className={`self-start overflow-hidden rounded-xl border ${open ? "border-violet-400/30 bg-violet-500/[0.05]" : "border-white/[0.07] bg-white/[0.02]"}`}>
                  <button onClick={() => toggleCourse(c.id)} className="w-full p-3.5 text-left">
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-sm"><b className="truncate">{c.title}</b><span className="flex items-center gap-1.5 font-bold text-violet-300">{pct}% <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} /></span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} /></div>
                    <div className="mt-1 text-[11px] text-slate-500">{c.completedLessons || 0} / {c.totalLessons || 0} lessons completed</div>
                  </button>
                  {open && (
                    <div className="border-t border-white/[0.06] px-3.5 pb-3.5 pt-2">
                      {detailLoading === c.id ? <div className="py-3 text-center text-sm text-slate-400">⏳ Loading lessons…</div>
                        : !det ? <div className="py-3 text-center text-sm text-slate-400">Couldn&apos;t load lessons. Tap again to retry.</div>
                          : det.modules.map((m) => (
                            <div key={m.id} className="mt-2">
                              <div className="mb-1 flex justify-between text-[11px] font-bold uppercase tracking-wide text-violet-300"><span className="truncate">{m.title}</span><span className="text-slate-500">{m.lessons.filter((l) => done.has(l.id)).length}/{m.lessons.length}</span></div>
                              {m.lessons.map((l) => (
                                <Link key={l.id} href={`/my/courses/${c.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/[0.05]">
                                  <span>{done.has(l.id) ? "✅" : "⬜"}</span>
                                  <span className={`min-w-0 flex-1 truncate ${done.has(l.id) ? "text-slate-300" : "text-slate-400"}`}>{l.title}</span>
                                  {done.has(l.id) && <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">Completed</span>}
                                </Link>
                              ))}
                            </div>
                          ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Day detail popup */}
      {day && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={closeDay}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-[#16162a] p-5 shadow-2xl" style={{ borderColor: `${day.accent}55` }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5"><span className="text-3xl">{day.emoji}</span><h3 className="text-lg font-extrabold">{day.title}</h3></div>
              <button onClick={closeDay} className="rounded-full bg-white/10 p-1.5 hover:bg-white/20" aria-label="Close"><X size={15} /></button>
            </div>
            <div className="mt-2 font-extrabold" style={{ color: day.accent }}>{day.badge}</div>
            {day.showStats && (
              <>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/[0.05] p-3 text-center"><div className="text-xl font-extrabold">{fmtMins(day.mins)}</div><div className="text-[11px] text-slate-400">🕒 Learning time</div></div>
                  <div className="rounded-xl bg-white/[0.05] p-3 text-center"><div className="text-xl font-extrabold">{day.opens}</div><div className="text-[11px] text-slate-400">📲 Time{day.opens === 1 ? "" : "s"} opened</div></div>
                </div>
                <div className="mt-3 flex justify-between text-xs"><span className="text-slate-400">Daily goal ({DAY_GOAL_MINS} min)</span><b style={{ color: day.accent }}>{day.pct}%</b></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${day.pct}%`, background: day.accent }} /></div>
              </>
            )}
            <p className="mt-3 text-sm text-slate-300">{day.message}</p>
            {dayLoading && <div className="mt-3 text-center text-sm text-slate-400">⏳ Loading what you did…</div>}
            {dayAct && (
              <div className="mt-4 space-y-3">
                <DaySection title="📚 Lessons completed" empty="No lessons completed" n={dayAct.lessons.length}>
                  {dayAct.lessons.map((l, i) => <DayRow key={i} main={l.title} sub={[l.course, l.module].filter(Boolean).join(" · ")} right={fmtClock(l.at)} />)}
                </DaySection>
                <DaySection title="📝 Quizzes" empty="No quizzes taken" n={dayAct.quizzes.length}>
                  {dayAct.quizzes.map((q, i) => <DayRow key={i} main={q.lesson} sub={[q.course, q.module].filter(Boolean).join(" · ")} extra={`Score ${q.correct}/${q.total} · ${fmtClock(q.at)}`} right={`${q.total ? Math.round((q.correct / q.total) * 100) : 0}%`} />)}
                </DaySection>
                <DaySection title="💻 Coding exercises" empty="No exercises attempted" n={dayAct.exercises.length}>
                  {dayAct.exercises.map((e, i) => <DayRow key={i} main={e.title} sub={[e.course, e.module].filter(Boolean).join(" · ")} extra={[e.lesson, e.language, `${e.attempts} attempt${e.attempts === 1 ? "" : "s"}`, fmtClock(e.at)].filter(Boolean).join(" · ")} right={e.passed ? "✅ Passed" : "⏳ Not yet"} />)}
                </DaySection>
                <DaySection title="🪙 Coins and badges" empty="No coins or badges" n={dayAct.coins.length + dayAct.badges.length}>
                  {dayAct.coins.map((c, i) => <DayRow key={`c${i}`} main={c.reason} sub={[c.course, c.module].filter(Boolean).join(" · ")} extra={[c.lesson, fmtClock(c.at)].filter(Boolean).join(" · ")} right={`${c.type === "EARNED" ? "+" : "-"}${c.coins}`} />)}
                  {dayAct.badges.map((b, i) => <DayRow key={`b${i}`} main={`🏅 ${b.title}`} sub={[b.course, b.module].filter(Boolean).join(" · ")} extra={[b.lesson, fmtClock(b.at)].filter(Boolean).join(" · ")} />)}
                </DaySection>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ href, emoji, color, value, label, sub }: { href?: string; emoji: string; color: string; value: React.ReactNode; label: string; sub: string }) {
  const inner = (
    <>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl" style={{ background: `${color}1f` }}>{emoji}</span>
      <span className="min-w-0">
        <span className="block text-xl font-extrabold leading-tight">{value}</span>
        <span className="block truncate text-xs font-semibold text-slate-300">{label}</span>
        <span className="block truncate text-[11px] text-slate-500" style={{ color: href ? color : undefined }}>{sub}</span>
      </span>
    </>
  );
  const cls = "flex items-center gap-3 rounded-2xl border bg-[#161626]/75 px-4 py-3 transition";
  return href
    ? <Link href={href} className={`${cls} hover:-translate-y-0.5`} style={{ borderColor: `${color}40` }}>{inner}</Link>
    : <div className={cls} style={{ borderColor: `${color}40` }}>{inner}</div>;
}
function Legend({ cls, label }: { cls: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className={`h-3.5 w-3.5 rounded ${cls}`} />{label}</span>;
}
function AchCard({ a }: { a: Ach }) {
  const b = BADGE[a.badgeType] || BADGE.pro;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <span className="text-3xl">{b.emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="font-bold">{a.title}</div>
        {a.courseTitle && <div className="text-xs text-slate-400">{[a.courseTitle, a.moduleTitle, a.lessonTitle].filter(Boolean).join(" · ")}</div>}
        <div className="mt-1.5 flex flex-wrap gap-2">
          {a.score != null && <span className="rounded-md bg-violet-500/15 px-2 py-0.5 text-[11px] font-bold text-violet-200">Score: {a.score}</span>}
          {a.rank != null && <span className="rounded-md bg-amber-400/15 px-2 py-0.5 text-[11px] font-bold text-amber-300">Rank #{a.rank}</span>}
        </div>
        {(a.earnedAt || a.createdAt) && <div className="mt-1 text-[11px] text-slate-500">{fmtDate((a.earnedAt || a.createdAt)!)}</div>}
      </div>
    </div>
  );
}
function DaySection({ title, empty, n, children }: { title: string; empty: string; n: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-sm font-extrabold">{title}{n > 0 ? ` (${n})` : ""}</div>
      {n === 0 ? <div className="text-xs text-slate-500">{empty}</div> : <div className="space-y-1.5">{children}</div>}
    </div>
  );
}
function DayRow({ main, sub, extra, right }: { main: string; sub?: string; extra?: string; right?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-white/[0.04] px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{main}</div>
        {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
        {extra && <div className="text-[11px] text-slate-500">{extra}</div>}
      </div>
      {right && <div className="shrink-0 text-xs font-bold text-slate-200">{right}</div>}
    </div>
  );
}

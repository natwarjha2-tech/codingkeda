"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { apiCached, apiOnce } from "../api";
import { useMy } from "../MyContext";
import { subjectTheme } from "../ui";
import VerifyBanner from "@/components/my/VerifyBanner";

/**
 * Student dashboard — a pixel-for-pixel port of the desktop app's dashboard
 * (index.html #page-dashboard): welcome hero with the student illustration and
 * rocket, four stat cards, Continue Learning + Weekly Challenge, and
 * "Recommended for You" course cards — all from the same APIs.
 */
type Enrolled = { id: string; title: string; totalLessons: number; completedLessons: number; progressPercent: number; remainingDurationSeconds: number };
type LastWatched = { courseId: string; courseTitle: string; moduleTitle: string; lessonId: string; lessonTitle: string } | null;
type Course = { id: string; title: string; subtitle?: string | null; rating?: number; students?: number | string; lessonCount?: number; totalDurationSeconds?: number };

const fmtLeft = (s: number) => { if (!s || s <= 0) return "—"; const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? `${h}h ${m}m remaining` : `${Math.max(1, m)}m remaining`; };
const fmtDur = (s?: number) => {
  if (!s || s <= 0) return "0 Mins";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return h ? `${h} Hours ${m} Mins` : `${m} Mins ${sec} Sec`;
};
const progressLabel = (p: number) => (p <= 0 ? "🚀 Ready to start!" : p < 25 ? `⚡ Just started · ${p}%` : p < 50 ? `🔥 Making progress · ${p}%` : p < 75 ? `💪 Halfway there · ${p}%` : p < 100 ? `🌟 Almost done · ${p}%` : "🏆 Completed · 100%");
const level = (p: number) => (p >= 70 ? { t: "Advanced", c: "#fdba74", b: "rgba(249,115,22,0.12)", d: "🟠" } : p >= 30 ? { t: "Intermediate", c: "#fde047", b: "rgba(234,179,8,0.12)", d: "🟡" } : { t: "Beginner", c: "#6ee7b7", b: "rgba(16,185,129,0.1)", d: "🟢" });

export default function MyDashboard() {
  const { user } = useMy();
  const [enrolled, setEnrolled] = useState<Enrolled[] | null>(null);
  const [completedVideos, setCompletedVideos] = useState(0);
  const [lastWatched, setLastWatched] = useState<LastWatched>(null);
  const [achCount, setAchCount] = useState(0);
  const [xp, setXp] = useState<{ level: number; title: string } | null>(null);
  const [streak, setStreak] = useState({ done: 0, total: 0 });
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [local, setLocal] = useState<{ courseId?: string; lessonId?: string } | null>(null);

  useEffect(() => {
    try { setLocal(JSON.parse(localStorage.getItem("ck_last_lesson") || "null")); } catch { /* ignore */ }
    apiCached("/api/student/dashboard", async (d) => {
      const list: Enrolled[] = d.enrolledCourses || [];
      setEnrolled(list); setCompletedVideos(d.completedVideos || 0); setLastWatched(d.lastWatched || null);
      const s = await Promise.all(list.map((c) => apiOnce(`/api/weekly-streak?courseId=${encodeURIComponent(c.id)}`).catch(() => ({}))));
      setStreak({ done: s.reduce((a, x) => a + (x.completedCount || 0), 0), total: s.reduce((a, x) => a + (x.totalStreaks || 0), 0) });
    }).catch(() => setEnrolled([]));
    apiCached("/api/achievements", (d) => setAchCount(d.totalCount ?? (d.achievements || []).length)).catch(() => {});
    apiCached("/api/xp", (d) => { if (d?.xp) setXp(d.xp); }).catch(() => {});
    apiCached("/api/courses", (d) => setCourses(d.courses || [])).catch(() => setCourses([]));
  }, []);

  // Continue Learning target: last opened lesson (this browser) → last completed lesson (server) → first course.
  const cont = useMemo(() => {
    if (!enrolled?.length) return null;
    const byId = (id?: string) => enrolled.find((c) => c.id === id);
    const course = byId(local?.courseId) || byId(lastWatched?.courseId) || enrolled[0];
    const lessonId = local?.courseId === course.id ? local?.lessonId : lastWatched?.courseId === course.id ? lastWatched?.lessonId : undefined;
    const sub = lastWatched?.courseId === course.id ? `${lastWatched.moduleTitle} · ${lastWatched.lessonTitle}` : `${course.completedLessons} of ${course.totalLessons} lessons completed`;
    return { course, href: lessonId ? `/my/lesson/${lessonId}?course=${course.id}` : `/my/courses/${course.id}`, sub };
  }, [enrolled, local, lastWatched]);

  const recommended = useMemo(() => {
    const list = courses || [];
    const pick: Course[] = [];
    const isC = (t: string) => t === "c" || t.includes("c programming") || t.startsWith("c ");
    [(t: string) => t.includes("python"), (t: string) => t.includes("java") && !t.includes("javascript"), isC].forEach((fn) => {
      const m = list.find((c) => fn((c.title || "").toLowerCase().trim()));
      if (m && !pick.includes(m)) pick.push(m);
    });
    list.forEach((c) => { if (pick.length < 3 && !pick.includes(c)) pick.push(c); });
    return pick.slice(0, 3);
  }, [courses]);

  const first = (user?.name || "Learner").split(" ")[0];
  const enrolledIds = new Set((enrolled || []).map((c) => c.id));
  const resumeHref = cont?.href || "/my/courses";

  return (
    <div className="ckd mx-auto w-full max-w-[1400px] space-y-6 pt-2">
      <style>{CSS}</style>
      <VerifyBanner />

      {/* ── Welcome hero ── */}
      <section className="relative min-h-[230px] overflow-hidden rounded-3xl border border-violet-500/15 p-7 md:p-9"
        style={{ background: "radial-gradient(circle at 65% 50%, rgba(124,47,255,0.25) 0%, rgba(91,32,180,0.12) 25%, transparent 50%), radial-gradient(circle at 75% 35%, rgba(220,40,255,0.08) 0%, transparent 30%), linear-gradient(90deg, #03011B 0%, #080620 30%, #0F082B 55%, #080620 75%, #03011B 100%)", boxShadow: "0 16px 32px -8px rgba(0,0,0,0.4), 0 0 30px rgba(124,58,237,0.06)" }}>
        <div className="pointer-events-none absolute -left-[5%] top-[30%] h-[300px] w-[250px] blur-[30px]" style={{ background: "radial-gradient(ellipse,rgba(251,191,36,0.12),transparent 70%)" }} />
        <div className="pointer-events-none absolute bottom-[-15%] right-0 h-[250px] w-[300px] blur-[28px]" style={{ background: "radial-gradient(ellipse,rgba(249,115,22,0.14),rgba(251,191,36,0.08),transparent 65%)" }} />
        {[["12%", "55%", "#fff"], ["25%", "70%", "#fbbf24"], ["8%", "80%", "#f472b6"], ["70%", "60%", "#fff"], ["50%", "48%", "#f472b6"]].map(([t, l, c], i) => (
          <span key={i} className="ckd-spark pointer-events-none absolute h-[3px] w-[3px] rounded-full" style={{ top: t, left: l, background: c, boxShadow: `0 0 4px ${c}`, animationDelay: `${i * 0.6}s` }} />
        ))}

        <div className="relative z-[2] max-w-full md:max-w-[55%]">
          <div className="mb-3 flex items-center gap-1.5">
            <span className="text-xs text-amber-400">★</span>
            <span className="rounded-xl border border-white/10 bg-white/[0.06] px-2.5 py-0.5 text-[0.78rem] font-bold text-white/85">Level {xp?.level ?? 1} · {xp?.title ?? "Beginner"}</span>
          </div>
          <h2 className="text-[clamp(1.7rem,3vw,2.3rem)] font-extrabold leading-tight tracking-tight">
            Hey <span className="bg-gradient-to-r from-violet-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">{first}!</span> <span className="ckd-wave inline-block">👋</span>
          </h2>
          <p className="mb-5 mt-1 text-[0.98rem] text-white/75">Ready for today&apos;s coding adventure?</p>
          <Link href={resumeHref} className="inline-flex items-center gap-2.5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 px-7 py-3 text-[0.92rem] font-bold shadow-[0_6px_20px_rgba(168,85,247,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(168,85,247,0.5)]">
            Continue Learning <span>→</span>
          </Link>
          <p className="ckd-float mt-3.5 text-sm font-medium italic text-[#C084FC]">↗ Keep your streak alive!</p>
        </div>

        {/* Illustration */}
        <div className="pointer-events-none absolute right-0 top-0 hidden h-full w-[45%] md:block">
          <img src="/desk/rocket.png" alt="" className="absolute right-[3%] top-[7%] w-[38%] max-w-[190px] -rotate-[25deg]" style={{ mixBlendMode: "screen", filter: "drop-shadow(0 0 8px rgba(216,180,254,0.5)) drop-shadow(0 0 16px rgba(124,47,255,0.25))" }} />
          <div className="ckd-f3 absolute right-[2px] top-[42%] z-[3] flex h-[38px] w-[42px] items-center justify-center rounded-[10px] border border-pink-500/25 bg-[rgba(12,12,28,0.75)] backdrop-blur"><span className="font-mono text-xs font-extrabold text-fuchsia-300">JS</span></div>
          <div className="ckd-f2 absolute bottom-[12%] right-[8%] z-[3] flex h-[38px] w-[42px] items-center justify-center rounded-[10px] border border-indigo-500/25 bg-[rgba(12,12,28,0.75)] backdrop-blur"><span className="font-mono text-xs font-extrabold text-indigo-300">Py</span></div>
          <div className="ckd-f1 absolute left-[8%] top-[28%] z-[3] flex h-[46px] w-[46px] items-center justify-center rounded-xl border border-violet-400/25 bg-[rgba(12,12,28,0.7)] text-2xl backdrop-blur">📈</div>
          <img src="/desk/student.png" alt="Student" className="absolute bottom-[-30px] right-[100px] z-[2] h-[300px] w-auto object-contain lg:h-[350px]" style={{ filter: "drop-shadow(0 12px 28px rgba(0,0,0,0.45)) drop-shadow(0 0 20px rgba(124,47,255,0.12))" }} />
        </div>
      </section>

      {/* ── Stat cards ── */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard kind="enrolled" icon="/desk/icon-books.png" value={enrolled?.length ?? 0} label="Enrolled Courses"
          sub={enrolled?.length ? `${enrolled.length} course${enrolled.length > 1 ? "s" : ""} enrolled` : "No courses yet"} cta="Start learning" href="/my/enrolled" />
        <StatCard kind="videos" icon="/desk/icon-check.png" value={completedVideos} label="Videos Completed" sub="Lessons completed" cta="Continue watching" href="/my/completed" />
        <StatCard kind="achievements" icon="/desk/icon-trophy.png" value={achCount} label="Achievements" sub="Badges & Certificates" cta="See achievements" href="/my/achievements" />
        <StatCard kind="streak" icon="/desk/icon-flame.png" value={streak.done} label="Weekly Streak" cta="Keep it alive" href="/my/streak"
          sub={streak.done ? `${streak.done} challenge${streak.done > 1 ? "s" : ""} passed 🔥` : "Let's begin! 🔥"} pips={streak.done} />
      </section>

      {/* ── Continue Learning + Weekly Challenge ── */}
      <section className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-3.5 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[1.15rem] font-bold text-slate-50">Continue Learning <span className="text-sm">⚡</span></h3>
            <span className="flex items-center gap-1 rounded-lg border border-amber-400/20 bg-amber-400/10 px-2.5 py-0.5 text-[0.72rem] font-bold text-amber-400">⭐ Earn +20 XP</span>
          </div>
          {cont ? (() => {
            const c = cont.course, lv = level(c.progressPercent);
            return (
              <div className="ckd-cont group relative flex flex-1 gap-5 overflow-hidden rounded-[22px] border border-violet-500/15 bg-[rgba(22,22,38,0.75)] p-6 backdrop-blur-xl transition hover:-translate-y-1 hover:border-violet-400/40">
                <div className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 select-none font-mono text-[4.5rem] font-black tracking-tighter text-violet-500/[0.05]">&lt;/&gt;</div>
                <div className="pointer-events-none absolute left-[2%] top-[10%] h-[120px] w-[120px]" style={{ background: "radial-gradient(circle,rgba(168,85,247,0.15),transparent 70%)" }} />
                <Link href={cont.href} className="flex h-[62px] w-[62px] shrink-0 items-center justify-center self-start rounded-[18px] bg-gradient-to-br from-purple-500 to-indigo-500 shadow-[0_6px_18px_rgba(168,85,247,0.4)] transition group-hover:-rotate-3 group-hover:scale-110">
                  <Play size={24} fill="#fff" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="truncate text-[1.15rem] font-extrabold">{c.title}</h4>
                    <span className="flex items-center gap-1 rounded-[10px] border px-2 py-0.5 text-[0.62rem] font-bold" style={{ color: lv.c, background: lv.b, borderColor: `${lv.c}40` }}>{lv.d} {lv.t}</span>
                  </div>
                  <div className="truncate text-[0.84rem] font-medium text-slate-400">{cont.sub}</div>
                  <div className="h-[7px] overflow-hidden rounded-full bg-white/[0.06]"><div className="ckd-rainbow h-full rounded-full" style={{ width: `${c.progressPercent}%` }} /></div>
                  <div className="flex items-center justify-between">
                    <span className="text-[0.74rem] font-semibold text-violet-400">{progressLabel(c.progressPercent)}</span>
                    <span className="text-[0.7rem] font-medium text-slate-500">⏱ {fmtLeft(c.remainingDurationSeconds)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[0.72rem] font-medium text-slate-500">{c.completedLessons} of {c.totalLessons} lessons completed</span>
                      <span className="text-[0.68rem] font-medium text-amber-400/80">🏅 Finish to unlock badge</span>
                    </div>
                    <Link href={cont.href} className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-white/20 px-5 py-2.5 text-[0.84rem] font-bold transition hover:scale-105"
                      style={{ background: "linear-gradient(135deg,#ff007f,#7c3aed)", boxShadow: "0 4px 18px rgba(255,0,127,0.4)" }}>
                      Resume Lesson <Play size={11} fill="#fff" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })() : (
            <div className="relative flex flex-1 flex-col items-center justify-center gap-3 overflow-hidden rounded-[22px] border border-violet-500/15 bg-[rgba(22,22,38,0.75)] p-8 text-center">
              <div className="text-5xl">🚀</div>
              <div className="text-lg font-extrabold">{enrolled === null ? "Loading your progress…" : "Start your coding journey!"}</div>
              {enrolled !== null && <p className="max-w-sm text-sm text-slate-400">Watch the free lessons first, then unlock a full course when you are ready.</p>}
              {enrolled !== null && <Link href="/my/courses" className="rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-5 py-2.5 text-sm font-bold">Explore courses →</Link>}
            </div>
          )}
        </div>

        <div className="flex w-full flex-col lg:w-[300px] lg:min-w-[300px]">
          <h3 className="mb-3.5 flex items-center gap-2 text-[1.15rem] font-bold text-slate-50">Weekly Challenge <span className="text-sm">🎯</span></h3>
          <div className="relative flex flex-1 flex-col justify-between overflow-hidden rounded-[22px] border border-pink-500/15 bg-[rgba(22,22,38,0.75)] p-5 backdrop-blur-xl transition hover:-translate-y-1 hover:border-pink-500/40">
            <div className="pointer-events-none absolute -right-[20%] -top-[40%] h-40 w-40" style={{ background: "radial-gradient(circle,rgba(236,72,153,0.12),transparent 70%)" }} />
            <div className="relative">
              <span className="mb-2.5 inline-block rounded-md border border-pink-500/25 bg-pink-500/10 px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-pink-400">Code Sprint ⚡</span>
              <p className="mb-3.5 text-[0.84rem] leading-relaxed text-slate-400">
                {streak.total === 0 ? "Enroll in a course to unlock coding challenges!" : streak.done >= streak.total ? "All challenges completed! You're a champ! 🎉" : `Complete ${streak.total} coding challenges and earn 50 coins!`}
              </p>
              <div className="mb-2 flex items-center gap-1.5"><span className="text-xs text-amber-400">⭐</span><b className="text-[0.82rem]">{streak.done} / {streak.total}</b><span className="text-[0.74rem] text-slate-500">Completed</span></div>
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-gradient-to-r from-pink-400 to-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.5)]" style={{ width: `${streak.total ? Math.round((streak.done / streak.total) * 100) : 0}%` }} /></div>
              <div className="text-[0.74rem] font-semibold text-amber-400">🪙 {streak.total > 0 && streak.done >= streak.total ? "✅ 50 Coins earned!" : "+50 Coins on completion"}</div>
            </div>
            <Link href={streak.total ? "/my/streak" : "/my/courses"} className="relative mt-4 flex w-fit items-center gap-1.5 rounded-xl border border-white/15 bg-gradient-to-br from-pink-500 to-rose-500 px-4 py-2.5 text-[0.82rem] font-bold shadow-[0_4px_12px_rgba(236,72,153,0.3)] transition hover:scale-105">
              Take Challenge <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Recommended for You ── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[1.25rem] font-extrabold" style={{ textShadow: "0 0 20px rgba(139,92,246,0.15)" }}>Recommended for You</h3>
          <Link href="/my/courses" className="text-[0.84rem] font-semibold text-white/50 hover:text-violet-300">View all →</Link>
        </div>
        {courses === null ? (
          <div className="py-10 text-center text-sm text-slate-500">⏳ Loading courses…</div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.map((c) => <CourseCard key={c.id} c={c} enrolled={enrolledIds.has(c.id)} />)}
          </div>
        )}
      </section>
    </div>
  );
}

const STAT: Record<string, { c: string; cta: string; ctaText: string }> = {
  enrolled: { c: "139,92,246", cta: "rgba(139,92,246,0.12)", ctaText: "#c4b5fd" },
  videos: { c: "16,185,129", cta: "rgba(16,185,129,0.12)", ctaText: "#6ee7b7" },
  achievements: { c: "245,158,11", cta: "rgba(245,158,11,0.12)", ctaText: "#fde047" },
  streak: { c: "244,63,94", cta: "rgba(244,63,94,0.12)", ctaText: "#fca5a5" },
};

function StatCard({ kind, icon, value, label, sub, cta, href, pips }: { kind: keyof typeof STAT; icon: string; value: number; label: string; sub: string; cta: string; href: string; pips?: number }) {
  const s = STAT[kind];
  const zero = !value;
  const delay = { enrolled: "0s", videos: "0.4s", achievements: "0.8s", streak: "1.2s" }[kind];
  return (
    <Link href={href} className={`group relative flex h-[178px] flex-col justify-between overflow-hidden rounded-[20px] bg-[rgba(22,22,38,0.75)] px-5 py-[18px] shadow-[0_8px_24px_rgba(0,0,0,0.3)] backdrop-blur-xl transition hover:-translate-y-0.5 ${zero ? "items-center text-center" : ""}`}
      style={{ border: `1px solid rgba(${s.c},0.15)` }}>
      <span className="pointer-events-none absolute -right-[30px] -top-[30px] h-[100px] w-[100px] rounded-full opacity-30 blur-[35px] transition group-hover:opacity-60" style={{ background: `rgb(${s.c})` }} />
      <div className={`flex w-full items-center ${zero ? "justify-center" : "justify-between"}`}>
        <div className="ckd-statfloat flex h-12 w-12 items-center justify-center rounded-[14px]" style={{ animationDelay: delay, background: `linear-gradient(135deg,rgba(${s.c},0.25),rgba(${s.c},0.08))`, border: `1px solid rgba(${s.c},0.35)`, boxShadow: `inset 0 1px 3px rgba(255,255,255,0.15),0 4px 12px rgba(0,0,0,0.25),0 0 12px rgba(${s.c},0.15)` }}>
          <img src={icon} alt="" className="h-8 w-8 object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.4)] transition group-hover:rotate-6 group-hover:scale-110" />
        </div>
        {!zero && <div className="text-[2.3rem] font-extrabold tracking-tight" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>{value}</div>}
      </div>
      <div className={zero ? "w-full" : ""}>
        <div className="text-[0.84rem] font-bold text-slate-200">{label}</div>
        {pips !== undefined && (
          <div className={`mt-1 flex gap-[5px] ${zero ? "justify-center" : ""}`}>
            {Array.from({ length: 7 }, (_, i) => {
              const on = i < Math.min(pips, 7), next = i === Math.min(pips, 7) && pips < 7;
              return <span key={i} className={`h-2 w-2 rounded-full ${next ? "ckd-pip" : ""}`} style={on ? { background: "#f43f5e", boxShadow: "0 0 8px rgba(244,63,94,0.8)" } : next ? { background: "rgba(244,63,94,0.4)", border: "1px solid rgba(244,63,94,0.8)" } : { background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }} />;
            })}
          </div>
        )}
        <div className="mt-0.5 text-[0.74rem] font-medium text-slate-400">{sub}</div>
      </div>
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-[5px] text-[0.74rem] font-semibold transition group-hover:brightness-125 ${zero ? "self-center" : "self-start"}`}
        style={{ background: s.cta, color: s.ctaText, border: `1px solid rgba(${s.c},0.25)` }}>
        {cta} <ArrowRight size={10} />
      </span>
    </Link>
  );
}

function CourseCard({ c, enrolled }: { c: Course; enrolled: boolean }) {
  const th = subjectTheme(c.title);
  const rating = Number(c.rating) || 0;
  return (
    <div className="overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#161B22] shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(0,0,0,0.45)]">
      <Link href={`/my/courses/${c.id}`} className="relative flex aspect-video items-center justify-center overflow-hidden" style={{ background: th.gradient }}>
        {th.banner ? <img src={th.banner} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 hover:scale-105" draggable={false} /> : <span className="text-6xl">📘</span>}
        <span className="absolute inset-0 bg-gradient-to-b from-transparent from-40% to-black/40" />
        {enrolled && <span className="absolute right-3 top-3 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-extrabold">Enrolled</span>}
      </Link>
      <div className="p-[18px]">
        <h3 className="mb-1.5 text-[1.05rem] font-extrabold uppercase leading-snug">{c.title}</h3>
        <p className="mb-3 min-h-[36px] text-[0.82rem] leading-relaxed text-slate-400">{c.subtitle || `Learn ${c.title} programming from basics to advanced concepts`}</p>
        <div className="mb-2.5 flex items-center gap-2">
          <span className="flex items-center gap-1 text-[0.84rem] font-bold text-amber-500">★ {rating ? rating.toFixed(1).replace(/\.0$/, "") : "New"}</span>
          <span className="text-[0.8rem] tracking-wider text-amber-500">{[1, 2, 3, 4, 5].map((i) => (i <= Math.round(rating) ? "★" : "☆")).join("")}</span>
        </div>
        <div className="mb-3.5 flex flex-wrap gap-1.5">
          {[`📖 ${c.lessonCount ?? 0} Lessons`, `🕐 ${fmtDur(c.totalDurationSeconds)}`, `🎓 ${c.students ?? 0} Students`].map((t) => (
            <span key={t} className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[0.72rem] font-semibold text-white/65">{t}</span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/my/courses/${c.id}`} className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-[11px] text-[0.84rem] font-bold transition hover:-translate-y-0.5"
            style={{ background: `linear-gradient(135deg,${th.accent},${th.accent}cc)`, boxShadow: `0 4px 16px ${th.accent}44` }}>
            {enrolled ? "Continue" : "Start Learning"} <ArrowRight size={13} />
          </Link>
          <span className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[0.74rem] font-bold text-white/70">👑 Pro</span>
        </div>
      </div>
    </div>
  );
}

const CSS = `
@keyframes ckdFloat1{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-10px) rotate(3deg)}}
@keyframes ckdFloat2{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-7px) rotate(-3deg)}}
@keyframes ckdFloat3{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-5px) scale(1.03)}}
@keyframes ckdStat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes ckdPip{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:1;transform:scale(1.2)}}
@keyframes ckdSpark{0%,100%{opacity:.2;transform:scale(.8)}50%{opacity:.85;transform:scale(1.15)}}
@keyframes ckdStreak{0%,100%{transform:translateY(0);opacity:.85}50%{transform:translateY(-2px);opacity:1}}
@keyframes ckdWave{0%,60%,100%{transform:rotate(0)}10%,30%{transform:rotate(14deg)}20%{transform:rotate(-8deg)}40%{transform:rotate(-4deg)}50%{transform:rotate(10deg)}}
@keyframes ckdRainbow{0%{background-position:0% 0}100%{background-position:200% 0}}
.ckd .ckd-f1{animation:ckdFloat1 5s ease-in-out infinite}
.ckd .ckd-f2{animation:ckdFloat2 4.5s ease-in-out infinite;animation-delay:1.2s}
.ckd .ckd-f3{animation:ckdFloat3 6s ease-in-out infinite}
.ckd .ckd-statfloat{animation:ckdStat 3s ease-in-out infinite}
.ckd .ckd-pip{animation:ckdPip 2s infinite}
.ckd .ckd-spark{animation:ckdSpark 3.5s ease-in-out infinite}
.ckd .ckd-float{animation:ckdStreak 3.5s ease-in-out infinite;text-shadow:0 0 6px rgba(192,132,252,.3)}
.ckd .ckd-wave{animation:ckdWave 2.5s ease-in-out infinite;transform-origin:70% 70%}
.ckd .ckd-rainbow{background:linear-gradient(90deg,#ec4899,#8b5cf6,#3b82f6,#ec4899);background-size:200% 100%;animation:ckdRainbow 3s linear infinite;box-shadow:0 0 10px rgba(139,92,246,.5)}
.ckd .ckd-cont{box-shadow:0 10px 30px rgba(0,0,0,.35),0 0 20px rgba(139,92,246,.06)}
@media (prefers-reduced-motion: reduce){.ckd *{animation:none!important}}
`;

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getToken } from "@/services/auth";

type Enrolled = { courseId: string; title: string; icon: string; color: string; enrolledAt: string; accessEndsAt: string | null; plan: string | null };
type Sub = { plan: string; status: string; coursesEnrolled: number; enrolledCourses: Enrolled[] };
type Prog = { id: string; title: string; progressPercent: number; completedLessons: number; totalLessons: number };
type LiveC = { id: string; title: string; scheduledAt: string | null; status: string; courseTitle?: string };

const DAY = 24 * 60 * 60 * 1000;
const daysLeft = (iso: string | null) => (iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / DAY) : null);
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * Student dashboard hub (blueprint page 09): access + expiry, progress,
 * live classes, app download, next step, support. Reads existing APIs only.
 */
export default function StudentHub() {
  const [sub, setSub] = useState<Sub | null>(null);
  const [progress, setProgress] = useState<Prog[]>([]);
  const [lastWatched, setLastWatched] = useState<{ courseTitle: string; lessonTitle: string } | null>(null);
  const [classes, setClasses] = useState<LiveC[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const h = { Authorization: `Bearer ${token}` };
    const json = (r: Response) => (r.ok ? r.json() : null);
    Promise.all([
      fetch("/api/student/subscription", { headers: h }).then(json).catch(() => null),
      fetch("/api/student/dashboard", { headers: h }).then(json).catch(() => null),
      fetch("/api/live/classes/enrolled", { headers: h }).then(json).catch(() => null),
    ]).then(([s, d, l]) => {
      if (s?.subscription) setSub(s.subscription);
      if (d?.enrolledCourses) setProgress(d.enrolledCourses);
      if (d?.lastWatched) setLastWatched({ courseTitle: d.lastWatched.courseTitle, lessonTitle: d.lastWatched.lessonTitle });
      setClasses(l?.classes ?? null);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="mb-10 h-48 rounded-3xl bg-white/5 animate-pulse" />;

  const active = (sub?.enrolledCourses ?? []).filter((e) => !e.accessEndsAt || new Date(e.accessEndsAt) > new Date());
  const expired = (sub?.enrolledCourses ?? []).filter((e) => e.accessEndsAt && new Date(e.accessEndsAt) <= new Date());
  const soon = active.filter((e) => { const d = daysLeft(e.accessEndsAt); return d !== null && d <= 14; });
  const upcoming = (classes ?? []).filter((c) => c.status === "live" || c.status === "scheduled").slice(0, 3);

  const card = "rounded-2xl p-5 border border-white/10 bg-white/[0.04]";

  return (
    <div className="mb-12 space-y-5">
      {/* Access status */}
      <div className={`${card} ${active.length ? "border-green-500/30" : "border-amber-500/30"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">My access</p>
            <h2 className="text-xl font-extrabold text-white mt-1">
              {active.length ? `✅ Active · ${active.length} course${active.length === 1 ? "" : "s"}` : expired.length ? "⏰ Your plan has ended" : "No plan yet"}
            </h2>
          </div>
          <div className="flex gap-2">
            <Link href="/account/subscription" className="text-sm font-bold text-purple-300 hover:text-white">Subscription</Link>
            <span className="text-slate-600">·</span>
            <Link href="/account/billing" className="text-sm font-bold text-purple-300 hover:text-white">Billing</Link>
          </div>
        </div>
        {active.length > 0 && (
          <ul className="mt-4 grid sm:grid-cols-2 gap-2">
            {active.map((e) => {
              const d = daysLeft(e.accessEndsAt);
              return (
                <li key={e.courseId} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3">
                  <span className="text-sm font-semibold text-white truncate">{e.title}</span>
                  <span className={`text-xs font-bold whitespace-nowrap ${d !== null && d <= 14 ? "text-amber-300" : "text-slate-400"}`}>
                    {e.accessEndsAt ? `${d} day${d === 1 ? "" : "s"} left · ends ${fmtDate(e.accessEndsAt)}` : "No end date"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {(soon.length > 0 || (!active.length && expired.length > 0)) && (
          <Link href="/pricing" className="mt-4 inline-block rounded-xl bg-amber-400 px-4 py-2 text-sm font-extrabold text-[#3B2A00]">
            {active.length ? "Renew before it ends →" : "Renew my plan →"}
          </Link>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Progress */}
        <div className={card}>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">My progress</p>
          {lastWatched && (
            <p className="mt-2 text-sm text-slate-300">▶ Last watched: <b className="text-white">{lastWatched.lessonTitle}</b> <span className="text-slate-500">({lastWatched.courseTitle})</span></p>
          )}
          {progress.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">Start a course to see your progress here.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {progress.slice(0, 4).map((p) => (
                <li key={p.id}>
                  <div className="flex justify-between text-sm"><span className="text-white font-semibold truncate">{p.title}</span><span className="text-slate-400">{p.completedLessons}/{p.totalLessons}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${Math.max(2, p.progressPercent)}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Live classes */}
        <div className={card}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Live classes</p>
            <Link href="/live-classes" className="text-xs font-bold text-purple-300 hover:text-white">All classes →</Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">{classes === null ? "Live classes are shown in the app." : "No classes scheduled for your courses yet."}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {upcoming.map((c) => (
                <li key={c.id}>
                  <Link href={`/live-classes/${c.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3 hover:bg-white/10">
                    <span className="text-sm font-semibold text-white truncate">{c.status === "live" ? "🔴 " : "🗓 "}{c.title || "Live class"}</span>
                    <span className="text-xs text-slate-400 whitespace-nowrap">{c.status === "live" ? "Live now" : c.scheduledAt ? new Date(c.scheduledAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "TBA"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        <Link href="/download" className={`${card} hover:bg-white/[0.07]`}>
          <div className="text-3xl">📱💻</div>
          <p className="mt-2 font-extrabold text-white">Get the app</p>
          <p className="text-sm text-slate-400">Full lessons, quizzes, exercises and live classes. Log in with this same account.</p>
        </Link>
        <Link href={active.length ? "/download" : "/free-learning"} className={`${card} hover:bg-white/[0.07]`}>
          <div className="text-3xl">🎯</div>
          <p className="mt-2 font-extrabold text-white">Next step</p>
          <p className="text-sm text-slate-400">{active.length ? "Open the app and continue your next lesson." : "Try a free lesson, then pick a plan."}</p>
        </Link>
        <Link href="/support" className={`${card} hover:bg-white/[0.07]`}>
          <div className="text-3xl">💬</div>
          <p className="mt-2 font-extrabold text-white">Need help?</p>
          <p className="text-sm text-slate-400">FAQ, contact and Help &amp; Support in the app.</p>
        </Link>
      </div>
    </div>
  );
}

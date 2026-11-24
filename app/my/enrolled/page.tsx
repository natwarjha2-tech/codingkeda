"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../api";
import { Bar, EmptyState, Loading, PageHeader } from "@/components/my/ui";

type C = {
  id: string; title: string; progressPercent: number; completedLessons: number; totalLessons: number;
  remainingDurationSeconds?: number; totalDurationSeconds?: number; completedDurationSeconds?: number;
};
type Last = { courseId?: string; lessonId?: string; lessonTitle?: string };

/** Same wording as the desktop's _fmtRemainingTime. */
function remainingLabel(c: C) {
  let secs: number | null = null;
  if (typeof c.remainingDurationSeconds === "number") secs = c.remainingDurationSeconds;
  else if (typeof c.totalDurationSeconds === "number" && typeof c.completedDurationSeconds === "number") secs = Math.max(0, c.totalDurationSeconds - c.completedDurationSeconds);
  if (secs === null) return "Keep learning →";
  if (secs <= 0) return "Almost done!";
  const mins = Math.round(secs / 60);
  if (mins < 1) return "<1 min remaining";
  if (mins < 60) return `${mins} min remaining`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${h}h${m ? ` ${m}m` : ""} remaining`;
}

/** "My Enrolled Courses" (desktop enrolled-detail page). */
export default function EnrolledPage() {
  const [list, setList] = useState<C[] | null>(null);
  const [last, setLast] = useState<Last | null>(null);
  useEffect(() => {
    api("/api/student/dashboard").then((d) => setList(d.enrolledCourses || [])).catch(() => setList([]));
    try { setLast(JSON.parse(localStorage.getItem("ck_last_lesson") || "null")); } catch { /* ignore */ }
  }, []);
  const avg = list?.length ? Math.round(list.reduce((s, c) => s + (c.progressPercent || 0), 0) / list.length) : 0;

  return (
    <div className="pt-2">
      <PageHeader icon="📚" title="My Enrolled Courses" sub="Continue where you left off and keep building your skills." back="/my/dashboard"
        right={list && <><span className="rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 py-1.5 text-sm font-bold text-violet-200">📚 {list.length} Course{list.length !== 1 ? "s" : ""}</span><span className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-sm font-bold text-amber-300">⚡ {avg}% Progress</span></>} />
      {!list ? <Loading /> : list.length === 0 ? <EmptyState icon="📖" title="No enrolled courses yet." action={<Link href="/my/courses" className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold">Browse courses</Link>} /> : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {list.map((c) => {
            const done = c.progressPercent >= 100;
            const level = c.progressPercent >= 70 ? { t: "🟠 Advanced", c: "#fdba74" } : c.progressPercent >= 30 ? { t: "🟡 Intermediate", c: "#fde047" } : { t: "🟢 Beginner", c: "#6ee7b7" };
            const left = Math.max(0, c.totalLessons - c.completedLessons);
            const isLast = last?.courseId === c.id;
            return (
              <Link key={c.id} href={isLast && last?.lessonId ? `/my/lesson/${last.lessonId}?course=${c.id}` : `/my/courses/${c.id}`}
                className="group relative flex gap-5 overflow-hidden rounded-[22px] border border-violet-400/15 bg-[#161626]/75 p-6 transition hover:-translate-y-0.5 hover:border-violet-400/40 hover:shadow-[0_12px_30px_rgba(139,92,246,0.12)]">
                <span className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 select-none font-mono text-6xl font-black text-violet-400/[0.05]">{"{ }"}</span>
                <span className="pointer-events-none absolute -left-4 -top-8 h-36 w-36 rounded-full bg-violet-500/10 blur-2xl" />
                <span className="relative mt-0.5 flex h-16 w-16 shrink-0 items-center justify-center self-start rounded-[18px] border border-violet-400/25 bg-gradient-to-br from-violet-500/20 to-indigo-500/10 font-mono text-2xl font-extrabold text-violet-200 shadow-lg">{c.title.charAt(0)}</span>
                <div className="relative flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2.5"><b className="text-[1.05rem] font-extrabold">{c.title}</b><span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold" style={{ color: level.c }}>{level.t}</span></div>
                  <div className="text-[0.8rem] text-slate-400">⚡ {c.completedLessons} of {c.totalLessons} lessons completed</div>
                  {isLast && last?.lessonTitle && <div className="text-xs text-slate-500">📍 Last learned: <span className="font-medium text-violet-300">{last.lessonTitle}</span></div>}
                  {left > 0 && !done && <div className="text-xs text-slate-500">▶ Next: <span className="font-medium text-fuchsia-300">{left} lesson{left > 1 ? "s" : ""} remaining</span></div>}
                  <div className="mt-1 flex items-center gap-2.5">
                    <div className="flex-1"><Bar pct={c.progressPercent} from="from-indigo-500" to="to-purple-500" h="h-1.5" /></div>
                    <b className={`min-w-[38px] text-right text-[0.82rem] ${done ? "text-emerald-400" : "text-violet-300"}`}>{c.progressPercent}%</b>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    {done ? <span className="text-xs font-semibold text-emerald-400">✅ Course Complete!</span> : <span className="text-[0.72rem] text-slate-500">⏱ {remainingLabel(c)}</span>}
                    <span className="text-[0.78rem] font-bold text-violet-400 transition group-hover:translate-x-0.5">{done ? "Review Course" : "Resume"} →</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

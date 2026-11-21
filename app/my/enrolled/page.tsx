"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../api";
import { Bar, EmptyState, Loading, PageHeader } from "@/components/my/ui";

type C = { id: string; title: string; progressPercent: number; completedLessons: number; totalLessons: number };

/** "My Enrolled Courses" (desktop enrolled-detail page). */
export default function EnrolledPage() {
  const [list, setList] = useState<C[] | null>(null);
  const [last, setLast] = useState<{ courseId?: string; lessonId?: string } | null>(null);
  useEffect(() => {
    api("/api/student/dashboard").then((d) => setList(d.enrolledCourses || [])).catch(() => setList([]));
    try { setLast(JSON.parse(localStorage.getItem("ck_last_lesson") || "null")); } catch { /* ignore */ }
  }, []);
  const avg = list?.length ? Math.round(list.reduce((s, c) => s + (c.progressPercent || 0), 0) / list.length) : 0;

  return (
    <div className="mx-auto max-w-4xl pt-2">
      <PageHeader icon="📚" title="My Enrolled Courses" sub="Continue where you left off and keep building your skills." back="/my/dashboard"
        right={list && <><span className="rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 py-1.5 text-sm font-bold text-violet-200">📚 {list.length} Course{list.length !== 1 ? "s" : ""}</span><span className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-sm font-bold text-amber-300">⚡ {avg}% Progress</span></>} />
      {!list ? <Loading /> : list.length === 0 ? <EmptyState icon="📖" title="No enrolled courses yet." action={<Link href="/my/courses" className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold">Browse courses</Link>} /> : (
        <div className="space-y-4">
          {list.map((c) => {
            const level = c.progressPercent >= 70 ? "🟠 Advanced" : c.progressPercent >= 30 ? "🟡 Intermediate" : "🟢 Beginner";
            const left = Math.max(0, c.totalLessons - c.completedLessons);
            return (
              <Link key={c.id} href={last?.courseId === c.id && last.lessonId ? `/my/lesson/${last.lessonId}?course=${c.id}` : `/my/courses/${c.id}`}
                className="flex gap-5 rounded-3xl border border-violet-400/15 bg-[#161626]/75 p-6 transition hover:-translate-y-0.5 hover:border-violet-400/40">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-violet-400/25 bg-violet-500/15 font-mono text-2xl font-extrabold text-violet-200">{c.title.charAt(0)}</span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2"><b className="text-lg">{c.title}</b><span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-bold">{level}</span></div>
                  <div className="text-sm text-slate-400">⚡ {c.completedLessons} of {c.totalLessons} lessons completed</div>
                  {left > 0 && c.progressPercent < 100 && <div className="text-xs text-slate-500">▶ Next: <span className="text-fuchsia-300">{left} lesson{left > 1 ? "s" : ""} remaining</span></div>}
                  <div className="flex items-center gap-3 pt-1"><div className="flex-1"><Bar pct={c.progressPercent} /></div><b className={c.progressPercent >= 100 ? "text-emerald-400" : "text-violet-300"}>{c.progressPercent}%</b></div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { apiCached } from "../api";
import { subjectTheme } from "../ui";

/**
 * Courses page — matches the desktop app exactly:
 * - Full-width course banner photo (C/Java/Python/DSA/Web/AI…) or gradient fallback
 * - Student count chip next to lessons and duration
 * - Coloured "Start/Continue Learning →" button in the subject's accent colour
 * - 3-column grid with the enrolled badge
 * - Category pills + search
 */

const fmtDur = (s?: number) => {
  if (!s || s <= 0) return "";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return h ? `${h} Hours ${m} Mins` : `${m} Mins ${sec} Sec`;
};
const fmtMins = (s?: number) => {
  if (!s || s <= 0) return "";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};

type Course = {
  id: string; title: string; subtitle?: string | null; category?: string | null;
  lessonCount?: number; totalDurationSeconds?: number; rating?: number;
  enrolledStudents?: number; students?: number | string; instructor?: string | null;
};

function Stars({ v }: { v: number }) {
  const r = Math.round(v);
  return <span className="text-sm tracking-tight text-amber-400">{[1,2,3,4,5].map(i => i <= r ? "★" : "☆").join("")}</span>;
}

function CourseCard({ c, isEnrolled }: { c: Course; isEnrolled: boolean }) {
  const th = subjectTheme(c.title);
  const rating = Number(c.rating) || 0;
  const students = c.enrolledStudents ?? (typeof c.students === "number" ? c.students : Number(c.students) || 0);

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#161B22] shadow-[0_8px_28px_rgba(0,0,0,0.4)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_14px_38px_rgba(0,0,0,0.6)]">
      {/* Banner */}
      <Link href={`/my/courses/${c.id}`} className="relative flex aspect-video items-center justify-center overflow-hidden" style={{ background: th.gradient }}>
        {th.banner
          ? <img src={th.banner} alt={c.title} className="absolute inset-0 h-full w-full object-cover object-center transition duration-500 group-hover:scale-105" draggable={false} />
          : <span className="relative z-10 text-7xl font-black uppercase tracking-widest text-white/20">{c.title.slice(0, 3)}</span>}
        {/* gradient overlay */}
        <span className="absolute inset-0 bg-gradient-to-b from-transparent from-40% to-black/50" />
        {isEnrolled && <span className="absolute right-3 top-3 z-20 rounded-full bg-emerald-500 px-3 py-0.5 text-[11px] font-extrabold tracking-wide text-white shadow">Enrolled</span>}
      </Link>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <h3 className="text-[1.07rem] font-extrabold uppercase leading-tight tracking-wide">{c.title}</h3>
        <p className="line-clamp-2 min-h-[36px] text-[0.82rem] leading-relaxed text-slate-400">
          {c.subtitle || `Learn ${c.title} programming from basics to advanced concepts`}
        </p>

        {/* Rating row */}
        {rating > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[0.84rem] font-bold text-amber-400">★ {rating.toFixed(1).replace(/\.0$/, "")}</span>
            <Stars v={rating} />
          </div>
        )}

        {/* Meta chips */}
        <div className="flex flex-wrap gap-1.5">
          {!!c.lessonCount && (
            <span className="flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[0.72rem] font-semibold text-white/65">
              📖 {c.lessonCount} Lessons
            </span>
          )}
          {!!c.totalDurationSeconds && (
            <span className="flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[0.72rem] font-semibold text-white/65">
              🕐 {fmtMins(c.totalDurationSeconds)}
            </span>
          )}
          {students > 0 && (
            <span className="flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[0.72rem] font-semibold text-white/65">
              🎓 {students} Students
            </span>
          )}
        </div>

        {/* CTA */}
        <div className="mt-auto flex items-center gap-2 pt-1">
          <Link href={`/my/courses/${c.id}`}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-[11px] text-[0.84rem] font-bold text-white transition hover:-translate-y-0.5"
            style={{ background: `linear-gradient(135deg,${th.accent},${th.accent}cc)`, boxShadow: `0 4px 16px ${th.accent}55` }}>
            {isEnrolled ? "Continue →" : "Start Learning"} <ArrowRight size={13} />
          </Link>
          <span className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[0.74rem] font-bold text-white/70">👑 Pro</span>
        </div>
      </div>
    </div>
  );
}

export default function MyCourses() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [enrolled, setEnrolled] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  // Search from the top bar arrives as /my/courses?q=...
  const qParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("q") || "" : "";
  useEffect(() => { if (qParam) setQ(qParam); }, [qParam]);

  useEffect(() => {
    apiCached("/api/courses", (d) => setCourses(d.courses || [])).catch(() => setCourses([]));
    apiCached("/api/student/dashboard", (d) => setEnrolled(new Set<string>((d.enrolledCourses || []).map((c: { id: string }) => c.id))))
      .catch(() => {});
  }, []);

  const cats = useMemo(() => {
    const seen = new Set<string>();
    seen.add("All");
    for (const c of courses || []) if (c.category) seen.add(c.category);
    return Array.from(seen);
  }, [courses]);

  const shown = useMemo(() =>
    (courses || []).filter((c) =>
      (cat === "All" || c.category === cat) &&
      (!q.trim() || `${c.title} ${c.subtitle || ""}`.toLowerCase().includes(q.trim().toLowerCase()))
    ), [courses, cat, q]);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 pt-2">
      {/* Header */}
      <div>
        <h1 className="text-[2.2rem] font-extrabold leading-tight">Courses</h1>
        <p className="text-slate-400">Pick a course and keep learning.</p>
      </div>

      {/* Search + category pills (like desktop) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search courses"
            className="w-full rounded-full border border-white/10 bg-[#1a1a2e] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-violet-400"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${
                cat === c
                  ? "bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-[0_2px_10px_rgba(139,92,246,0.4)]"
                  : "border border-white/15 bg-[#1a1a2e] text-slate-400 hover:border-violet-400/50 hover:text-white"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {courses === null && (
        <div className="py-16 text-center text-slate-400">
          <div className="mb-3 inline-block animate-spin text-4xl">⚙️</div>
          <div className="font-semibold">Loading courses…</div>
        </div>
      )}
      {courses && shown.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-14 text-center text-slate-400">
          <div className="text-5xl">🔍</div>
          <div className="mt-2 font-semibold">No courses found</div>
        </div>
      )}
      <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((c) => (
          <CourseCard key={c.id} c={c} isEnrolled={enrolled.has(c.id)} />
        ))}
      </div>
    </div>
  );
}

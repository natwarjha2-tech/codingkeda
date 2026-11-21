"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { api, prettyDuration } from "../api";
import { courseBg, courseIcon } from "../ui";

type Course = {
  id: string; title: string; subtitle?: string | null; category?: string | null;
  color?: string | null; icon?: string | null; lessonCount?: number; totalDurationSeconds?: number;
  rating?: number; instructor?: string | null;
};

export default function MyCourses() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [enrolled, setEnrolled] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");

  useEffect(() => {
    api("/api/courses").then((d) => setCourses(d.courses || [])).catch(() => setCourses([]));
    api("/api/student/dashboard")
      .then((d) => setEnrolled(new Set<string>((d.enrolledCourses || []).map((c: { id: string }) => c.id))))
      .catch(() => {});
  }, []);

  const cats = useMemo(() => ["All", ...Array.from(new Set((courses || []).map((c) => c.category).filter(Boolean) as string[]))], [courses]);
  const shown = (courses || []).filter(
    (c) => (cat === "All" || c.category === cat) && (!q.trim() || `${c.title} ${c.subtitle || ""}`.toLowerCase().includes(q.trim().toLowerCase())),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5 pt-2">
      <div>
        <h1 className="text-3xl font-extrabold">Courses</h1>
        <p className="text-white/60">Pick a course and keep learning.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search courses"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-violet-400"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`rounded-full border px-4 py-2 text-xs font-bold ${cat === c ? "border-violet-400 bg-violet-500/25" : "border-white/10 bg-white/5 text-white/70"}`}>{c}</button>
          ))}
        </div>
      </div>

      {courses === null && <div className="text-white/50">Loading courses…</div>}
      {courses && shown.length === 0 && <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">No courses found.</div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((c) => (
          <Link key={c.id} href={`/my/courses/${c.id}`} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition hover:border-violet-400/40">
            <div className="relative flex h-28 items-center gap-3 p-4" style={courseBg(c.color)}>
              <span className="text-4xl">{courseIcon(c.icon)}</span>
              {enrolled.has(c.id) && <span className="absolute right-3 top-3 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-extrabold">Enrolled</span>}
            </div>
            <div className="p-4">
              <h3 className="font-extrabold leading-tight">{c.title}</h3>
              {c.subtitle && <p className="mt-1 line-clamp-2 text-sm text-white/60">{c.subtitle}</p>}
              <div className="mt-3 flex flex-wrap gap-x-3 text-xs text-white/50">
                {!!c.lessonCount && <span>{c.lessonCount} lessons</span>}
                {!!c.totalDurationSeconds && <span>{prettyDuration(c.totalDurationSeconds)}</span>}
                {!!c.rating && <span>⭐ {Number(c.rating).toFixed(1)}</span>}
              </div>
              <div className="mt-3 text-sm font-bold text-violet-300 group-hover:text-white">{enrolled.has(c.id) ? "Continue →" : "View course →"}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

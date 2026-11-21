"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, ChevronDown, Lock, PlayCircle } from "lucide-react";
import { api, durationToSeconds, prettyDuration } from "../../api";
import { courseBg, courseIcon } from "../../ui";
import FinalTestCard from "@/components/my/FinalTestCard";

type Lesson = { id: string; title: string; duration?: string | null; isFree: boolean; hasVideo?: boolean };
type Module = { id: string; title: string; lessons: Lesson[] };
type Course = {
  id: string; title: string; subtitle?: string | null; instructor?: string | null; color?: string | null; icon?: string | null;
  modules: Module[]; isEnrolled: boolean; accessEndsAt?: string | null; accessExpired?: boolean;
  completedLessons: string[]; progressPercent: number; enrolledStudents?: number;
};

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState("");
  const [openMods, setOpenMods] = useState<Set<string>>(new Set());

  useEffect(() => {
    api(`/api/courses/${encodeURIComponent(id)}?signed=true`)
      .then((d) => {
        setCourse(d.course);
        const first = d.course?.modules?.[0]?.id;
        if (first) setOpenMods(new Set([first]));
      })
      .catch((e) => setError(e.message || "Could not load this course."));
  }, [id]);

  if (error) return <div className="mx-auto max-w-3xl pt-10 text-center text-white/70">{error} <Link href="/my/courses" className="text-violet-300 underline">Back to courses</Link></div>;
  if (!course) return <div className="pt-10 text-center text-white/50">Loading course…</div>;

  const done = new Set(course.completedLessons || []);
  const all = course.modules.flatMap((m) => m.lessons);
  const canOpen = (l: Lesson) => course.isEnrolled || l.isFree;
  const next = all.find((l) => canOpen(l) && !done.has(l.id)) || all.find(canOpen);
  const totalSecs = all.reduce((s, l) => s + durationToSeconds(l.duration), 0);
  const toggle = (m: string) => setOpenMods((s) => { const n = new Set(s); if (n.has(m)) n.delete(m); else n.add(m); return n; });

  return (
    <div className="mx-auto max-w-4xl space-y-5 pt-2">
      <Link href="/my/courses" className="text-sm font-semibold text-white/60 hover:text-white">← All courses</Link>

      <section className="overflow-hidden rounded-3xl border border-white/10" style={courseBg(course.color)}>
        <div className="p-6 md:p-8">
          <div className="text-5xl">{courseIcon(course.icon)}</div>
          <h1 className="mt-2 text-3xl font-extrabold">{course.title}</h1>
          {course.subtitle && <p className="mt-1 max-w-2xl text-white/80">{course.subtitle}</p>}
          <div className="mt-3 flex flex-wrap gap-x-4 text-sm text-white/70">
            {course.instructor && <span>👩‍🏫 {course.instructor}</span>}
            <span>{all.length} lessons</span>
            {totalSecs > 0 && <span>{prettyDuration(totalSecs)}</span>}
            {!!course.enrolledStudents && <span>{course.enrolledStudents} students</span>}
          </div>

          {course.isEnrolled ? (
            <div className="mt-5 max-w-md">
              <div className="flex justify-between text-xs font-semibold text-white/80"><span>Your progress</span><span>{course.progressPercent}%</span></div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-black/30">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400" style={{ width: `${course.progressPercent}%` }} />
              </div>
              {course.accessEndsAt && <div className="mt-2 text-xs text-white/60">Access until {new Date(course.accessEndsAt).toLocaleDateString()}</div>}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-black/30 p-4 text-sm">
              {course.accessExpired ? "Your access has ended. Renew to keep learning." : "Free lessons are open to you. Unlock the rest of the course to watch everything."}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            {next && (
              <Link href={`/my/lesson/${next.id}?course=${course.id}`} className="rounded-full bg-white px-6 py-3 text-sm font-extrabold text-violet-700 hover:bg-violet-50">
                {course.isEnrolled ? (done.size ? "Continue learning" : "Start learning") : "Watch a free lesson"} →
              </Link>
            )}
            {!course.isEnrolled && (
              <Link href={`/payment?courseId=${course.id}`} className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-3 text-sm font-extrabold text-[#431407]">
                {course.accessExpired ? "Renew access" : "Unlock full course"}
              </Link>
            )}
          </div>
        </div>
      </section>

      {course.isEnrolled && <FinalTestCard courseId={course.id} />}

      <section>
        <h2 className="mb-1 text-xl font-extrabold">Course Content</h2>
        <p className="mb-3 text-sm text-white/50">Continue your learning journey</p>
        <div className="space-y-3">
          {course.modules.map((m, mi) => {
            const open = openMods.has(m.id);
            const doneCount = m.lessons.filter((l) => done.has(l.id)).length;
            return (
              <div key={m.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                <button onClick={() => toggle(m.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/25 text-sm font-extrabold">{mi + 1}</span>
                  <span className="flex-1 font-bold">{m.title}</span>
                  <span className="text-xs text-white/50">{doneCount}/{m.lessons.length}</span>
                  <ChevronDown size={18} className={`transition ${open ? "rotate-180" : ""}`} />
                </button>
                {open && (
                  <ul className="border-t border-white/10">
                    {m.lessons.map((l) => {
                      const ok = canOpen(l);
                      const secs = durationToSeconds(l.duration);
                      const row = (
                        <div className={`flex items-center gap-3 px-4 py-3 text-sm ${ok ? "hover:bg-white/5" : "opacity-60"}`}>
                          {done.has(l.id) ? <CheckCircle2 size={18} className="text-emerald-400" /> : ok ? <PlayCircle size={18} className="text-violet-300" /> : <Lock size={16} className="text-red-400" />}
                          <span className="flex-1">{l.title}</span>
                          {l.isFree && !course.isEnrolled && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-300">Free</span>}
                          {secs > 0 && <span className="text-xs text-white/40">{prettyDuration(secs)}</span>}
                        </div>
                      );
                      return (
                        <li key={l.id} className="border-b border-white/5 last:border-0">
                          {ok ? <Link href={`/my/lesson/${l.id}?course=${course.id}`}>{row}</Link> : <Link href={`/payment?courseId=${course.id}`}>{row}</Link>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

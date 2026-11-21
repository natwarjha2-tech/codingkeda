"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../api";
import { EmptyState, Loading, PageHeader } from "@/components/my/ui";
import { DIFF_COLORS } from "../code/logic";

type Hw = { id: string; title: string; description: string; difficulty?: string | null };
type Group = { courseId: string; courseTitle: string; lessonId: string; lessonTitle: string; items: Hw[] };
type ProgLesson = { id: string; title: string; homeworkCount?: number };
type ProgCourse = { id: string; title: string; modules: { lessons: ProgLesson[] }[] };

/** All homework across the student's enrolled courses (lessons that have homework). */
export default function HomeworkPage() {
  const [groups, setGroups] = useState<Group[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const p = await api("/api/student/progress");
        const wanted: { c: ProgCourse; l: ProgLesson }[] = [];
        (p.courses || []).forEach((c: ProgCourse) => c.modules.forEach((m) => m.lessons.forEach((l) => { if ((l.homeworkCount || 0) > 0) wanted.push({ c, l }); })));
        const res = await Promise.all(wanted.map(async ({ c, l }) => {
          const d = await api(`/api/homework?lessonId=${encodeURIComponent(l.id)}`).catch(() => ({ homeworks: [] }));
          return { courseId: c.id, courseTitle: c.title, lessonId: l.id, lessonTitle: l.title, items: d.homeworks || [] } as Group;
        }));
        setGroups(res.filter((g) => g.items.length));
      } catch { setGroups([]); }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-4xl pt-2">
      <PageHeader icon="📝" title="Homework" sub="Practice set by your teachers, lesson by lesson" />
      {!groups ? <Loading /> : groups.length === 0 ? (
        <EmptyState icon="📝" title="No homework right now" text="When your teacher adds homework to a lesson, it will show up here." />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <section key={g.lessonId} className="rounded-2xl border border-white/10 bg-[#161626]/75 p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div><div className="text-xs text-slate-500">{g.courseTitle}</div><div className="font-extrabold">{g.lessonTitle}</div></div>
                <Link href={`/my/lesson/${g.lessonId}?course=${g.courseId}`} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold hover:bg-white/5">Open lesson →</Link>
              </div>
              <div className="space-y-2">
                {g.items.map((h) => {
                  const c = DIFF_COLORS[h.difficulty || ""] || "#a78bfa";
                  return (
                    <div key={h.id} className="rounded-xl bg-white/[0.04] p-3">
                      <div className="flex items-center gap-2"><b className="flex-1 text-sm">{h.title}</b>{h.difficulty && <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase" style={{ color: c, background: `${c}20` }}>{h.difficulty}</span>}</div>
                      <div className="mt-1 whitespace-pre-wrap text-sm text-slate-400">{h.description}</div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          <div className="text-center"><Link href="/my/code" className="text-sm font-bold text-violet-300">💻 Practise in the Code Editor →</Link></div>
        </div>
      )}
    </div>
  );
}

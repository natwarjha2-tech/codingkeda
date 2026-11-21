"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../api";
import { Bar, EmptyState, Loading, PageHeader } from "@/components/my/ui";

type L = { id: string; title: string; completed: boolean };
type C = { id: string; title: string; lessonsCompleted: number; totalLessons: number; progressPercent: number; modules: { id: string; title: string; lessons: L[] }[] };

/** "Learning Progress" — completed videos per course (desktop completed-videos page). */
export default function CompletedPage() {
  const [list, setList] = useState<C[] | null>(null);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    api("/api/student/progress").then((d) => { setList(d.courses || []); setTotal(d.totalLessonsCompleted || 0); }).catch(() => setList([]));
  }, []);

  return (
    <div className="mx-auto max-w-4xl pt-2">
      <PageHeader icon="✅" title="Learning Progress" sub="Your learning journey so far 🎉" back="/my/dashboard"
        right={<span className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-sm font-bold text-emerald-300">✅ {total} Videos Completed</span>} />
      {!list ? <Loading /> : list.length === 0 ? <EmptyState icon="🎬" title="No completed videos yet" text="Watch a lesson to the end to mark it complete." /> : (
        <div className="space-y-4">
          {list.map((c) => {
            const done = c.modules.flatMap((m) => m.lessons.filter((l) => l.completed).map((l) => ({ ...l, mod: m.title })));
            return (
              <section key={c.id} className="rounded-2xl border border-white/10 bg-[#161626]/75 p-5">
                <div className="mb-2 flex items-center justify-between"><b className="text-lg">{c.title}</b><span className="text-sm text-slate-400">{c.lessonsCompleted}/{c.totalLessons}</span></div>
                <Bar pct={c.progressPercent} from="from-emerald-400" to="to-sky-400" />
                {done.length === 0 ? <div className="mt-3 text-sm text-slate-500">No completed lessons in this course yet.</div> : (
                  <ul className="mt-3 space-y-1">
                    {done.map((l) => (
                      <li key={l.id}><Link href={`/my/lesson/${l.id}?course=${c.id}`} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm hover:bg-white/10"><span>✅</span><span className="flex-1 truncate">{l.title}</span><span className="text-[11px] text-slate-500">{l.mod}</span></Link></li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

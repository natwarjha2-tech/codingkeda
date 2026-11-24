"use client";
import { useEffect, useState } from "react";
import { api } from "../api";
import { EmptyState, Loading, PageHeader } from "@/components/my/ui";

type S = { weekNumber: number; title: string; completed: boolean; courseTitle: string };

/** Weekly Streak History (desktop streak-history page): every weekly challenge across enrolled courses. */
export default function StreakPage() {
  const [list, setList] = useState<S[] | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const d = await api("/api/student/dashboard");
        const all = await Promise.all((d.enrolledCourses || []).map(async (c: { id: string; title: string }) => {
          const r = await api(`/api/weekly-streak?courseId=${encodeURIComponent(c.id)}`).catch(() => ({ streaks: [] }));
          return (r.streaks || []).map((s: { weekNumber: number; title: string; completed: boolean }) => ({ ...s, courseTitle: c.title }));
        }));
        setList(all.flat());
      } catch { setList([]); }
    })();
  }, []);
  const passed = list?.filter((s) => s.completed).length || 0;

  return (
    <div className="w-full pt-2">
      <PageHeader icon="🔥" title="Weekly Streak History" sub="Weekly challenges you have passed and the ones still waiting" back="/my/dashboard"
        right={list && <span className="rounded-xl border border-orange-400/25 bg-orange-400/10 px-3 py-1.5 text-sm font-bold text-orange-300">🔥 {passed}/{list.length} passed</span>} />
      {!list ? <Loading /> : list.length === 0 ? <EmptyState icon="🔥" title="No weekly challenges created yet." text="Complete lessons to unlock!" /> : (
        <div className="space-y-3">
          {list.map((s, i) => (
            <div key={i} className={`flex items-center gap-4 rounded-xl border bg-white/[0.03] p-4 ${s.completed ? "border-emerald-400/30" : "border-amber-400/20"}`}>
              <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.completed ? "bg-emerald-400/15" : "bg-amber-400/15"}`}>{s.completed ? "✅" : "🔥"}</span>
              <div className="flex-1"><div className="font-semibold">Week {s.weekNumber}: {s.title}</div><div className="text-xs text-slate-500">{s.courseTitle}</div></div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${s.completed ? "bg-emerald-400/15 text-emerald-400" : "bg-amber-400/15 text-amber-400"}`}>{s.completed ? "✅ PASS" : "⏳ Pending"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

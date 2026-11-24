"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { api, durationToSeconds } from "../api";
import { EmptyState, Loading, PageHeader } from "@/components/my/ui";

/** 29:11 or 1:05:30 — same format as the desktop app. */
const clock = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.round(s % 60);
  const p = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(x)}` : `${m}:${p(x)}`;
};

type L = { id: string; title: string; completed: boolean; duration?: string };
type C = { id: string; title: string; lessonsCompleted: number; totalLessons: number; progressPercent: number; modules: { id: string; title: string; lessons: L[] }[] };

function Ring({ pct, color }: { pct: number; color: string }) {
  const size = 64, sw = 6, r = (size - sw) / 2, circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ - (Math.min(100, pct) / 100) * circ} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fill="#fff" style={{ fontSize: "0.75rem", fontWeight: 800 }}>{pct}%</text>
    </svg>
  );
}

/** "Learning Progress" — completed videos per course (desktop completed-videos page), with expandable lesson lists. */
export default function CompletedPage() {
  const [list, setList] = useState<C[] | null>(null);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  useEffect(() => {
    api("/api/student/progress").then((d) => { setList(d.courses || []); setTotal(d.totalLessonsCompleted || 0); }).catch(() => setList([]));
  }, []);
  const withProgress = (list || []).filter((c) => c.lessonsCompleted > 0);

  return (
    <div className="pt-2">
      <PageHeader icon="✅" title="Learning Progress" sub="Your learning journey so far 🎉" back="/my/dashboard"
        right={<span className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-sm font-bold text-emerald-300">✅ {total} Lesson{total !== 1 ? "s" : ""} Completed</span>} />
      {!list ? <Loading /> : withProgress.length === 0 ? <EmptyState icon="🎬" title="No completed videos yet" text="Watch a lesson to the end to mark it complete." /> : (
        <div className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {withProgress.map((c) => {
            const complete = c.progressPercent >= 100;
            const p = c.progressPercent;
            const moti = complete ? "🏆 Course mastered!" : p >= 75 ? "🔥 You're almost there!" : p >= 40 ? "🎉 Great progress!" : "🚀 Good start, keep going!";
            const isOpen = !!open[c.id];
            const blocks = c.modules.map((m) => ({ m, done: m.lessons.filter((l) => l.completed) })).filter((b) => b.done.length > 0);
            return (
              <div key={c.id} onClick={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))}
                className="group relative cursor-pointer overflow-hidden rounded-[22px] border border-emerald-400/15 bg-[#161626]/75 p-6 transition hover:-translate-y-0.5 hover:border-emerald-400/40 hover:shadow-[0_12px_30px_rgba(16,185,129,0.1)]">
                <span className="pointer-events-none absolute right-12 top-6 select-none font-mono text-5xl font-black text-emerald-400/[0.05]">✓</span>
                <span className="pointer-events-none absolute -left-4 -top-8 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />
                <div className="relative flex gap-5">
                  <Ring pct={p} color={complete ? "#22c55e" : "#a855f7"} />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <b className="text-[1.05rem] font-extrabold">{c.title}</b>
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">{complete ? "✅ Completed" : "🟢 In Progress"}</span>
                    </div>
                    <div className="text-[0.8rem] text-slate-400">{c.lessonsCompleted} of {c.totalLessons} lessons completed</div>
                    <div className="h-[5px] overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-500" style={{ width: `${p}%` }} /></div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[0.78rem] font-medium text-emerald-300">{moti}</span>
                      <Link href={`/my/courses/${c.id}`} onClick={(e) => e.stopPropagation()} className="text-[0.78rem] font-bold text-emerald-400 hover:text-emerald-300">Watch Again ▶</Link>
                    </div>
                  </div>
                  <ChevronDown size={16} className={`self-center text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </div>
                {isOpen && (
                  <div className="relative mt-4 border-t border-white/[0.06] pt-4" onClick={(e) => e.stopPropagation()}>
                    {blocks.length === 0 ? <div className="text-sm text-slate-500">No completed lessons in this course yet.</div> : blocks.map(({ m, done }) => (
                      <div key={m.id} className="mb-3 last:mb-0">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="truncate text-[0.72rem] font-bold uppercase tracking-wide text-violet-300">{m.title}</span>
                          <span className="text-[0.68rem] font-semibold text-slate-500">{done.length}/{m.lessons.length}</span>
                        </div>
                        <div className="space-y-1">
                          {done.map((l) => (
                            <Link key={l.id} href={`/my/lesson/${l.id}?course=${c.id}`} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5 hover:bg-white/[0.07]">
                              <span className="text-sm">✅</span>
                              <span className="min-w-0 flex-1 truncate text-[0.8rem]">{l.title}{durationToSeconds(l.duration) > 0 ? <span className="text-[0.7rem] text-slate-500"> · {clock(durationToSeconds(l.duration))}</span> : null}</span>
                              <span className="rounded-md bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">Completed</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

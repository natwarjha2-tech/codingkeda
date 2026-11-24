"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiCached } from "../api";
import { EmptyState, Loading, PageHeader, fmtDate } from "@/components/my/ui";

type A = { id: string; title: string; badgeType: string; courseTitle?: string; moduleTitle?: string; lessonTitle?: string; score?: number; rank?: number; studentName?: string; instructor?: string; earnedAt: string };

const meta = (b: string) =>
  b === "super-master" ? { icon: "🏆", label: "SUPER MASTER", color: "#fbbf24" } : b === "master" ? { icon: "🥈", label: "MASTER", color: "#a78bfa" } : { icon: "⭐", label: "STAR", color: "#22c55e" };

export default function AchievementsPage() {
  const [list, setList] = useState<A[] | null>(null);
  useEffect(() => { apiCached("/api/achievements", (d) => setList(d.achievements || [])).catch(() => setList([])); }, []);

  return (
    <div className="pt-2">
      <PageHeader icon="🏆" title="My Achievements" sub="Celebrate what you've earned and keep leveling up." back="/my/dashboard"
        right={list && <span className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-sm font-bold text-amber-300">🏆 {list.length} Badge{list.length !== 1 ? "s" : ""} Earned</span>} />
      {!list ? <Loading /> : list.length === 0 ? (
        <EmptyState icon="🏆" title="Your trophy shelf is empty" text="Complete quizzes and climb the leaderboard to earn your first achievement!"
          action={<Link href="/my/courses" className="rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 px-5 py-2.5 text-sm font-bold">Start Learning →</Link>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {list.map((a) => {
            const m = meta(a.badgeType);
            return (
              <div key={a.id} className="relative overflow-hidden rounded-[22px] border bg-[#161626]/75 p-6 transition hover:-translate-y-0.5" style={{ borderColor: `${m.color}35` }}>
                <div className="pointer-events-none absolute -right-8 -top-12 h-44 w-44 rounded-full blur-3xl" style={{ background: `${m.color}18` }} />
                <div className="relative flex gap-5">
                  <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl border text-4xl" style={{ background: `${m.color}12`, borderColor: `${m.color}35` }}>{m.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2"><span className="rounded-md border px-2 py-0.5 text-[10px] font-extrabold tracking-wider" style={{ color: m.color, borderColor: `${m.color}35`, background: `${m.color}12` }}>{m.label}</span><span className="text-[10px] text-slate-500">✓ EARNED</span></div>
                    <h4 className="text-lg font-extrabold">{a.title}</h4>
                    <div className="mb-3 text-sm text-slate-400">{[a.courseTitle, a.moduleTitle, a.lessonTitle].filter(Boolean).join(" › ")}</div>
                    <div className="mb-3 flex gap-3">
                      {a.score !== undefined && <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-center"><div className="text-[10px] uppercase text-slate-500">Score</div><div className="text-lg font-extrabold text-emerald-400">{a.score}%</div></div>}
                      {a.rank !== undefined && <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-center"><div className="text-[10px] uppercase text-slate-500">Rank</div><div className="text-lg font-extrabold" style={{ color: m.color }}>#{a.rank}</div></div>}
                    </div>
                    <div className="text-xs leading-relaxed text-slate-500">
                      {a.studentName && <>Awarded to: <b className="text-white">{a.studentName}</b><br /></>}
                      {a.instructor ? `Instructor: ${a.instructor} · ` : ""}{a.earnedAt ? fmtDate(a.earnedAt) : ""}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

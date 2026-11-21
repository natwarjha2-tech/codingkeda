"use client";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { api } from "../api";
import { Bar, EmptyState, Loading, PageHeader, Panel, Stars } from "@/components/my/ui";

type QuizS = { total: number; attempted: number; correct: number; accuracy: number | null };
type ExS = { total: number; attempted: number; passed: number; rate?: number };
type Lesson = { id: string; title: string; completed: boolean; quiz: QuizS; exercise: ExS; achievements: { badgeType: string; title: string }[]; homeworkCount?: number };
type Course = { id: string; title: string; totalLessons: number; lessonsCompleted: number; progressPercent: number; quiz: QuizS; exercise: ExS; modules: { id: string; title: string; lessons: Lesson[] }[] };
type Data = {
  overallRating: number; overallScore: number; totalLessonsCompleted: number; totalLessons: number;
  ratingBreakdown: { quiz: { rating: number; accuracy: number; totalQuizzes: number; attempted: number; correct: number }; exercise: { rating: number; passRate: number; totalExercises: number; attempted: number; passed: number } };
  courses: Course[];
};

const perf = (s: number) => (s >= 90 ? "Outstanding" : s >= 75 ? "Excellent" : s >= 50 ? "Doing Well" : s >= 25 ? "Getting Started" : "Just Beginning");
const state = (p: number) =>
  p >= 100 ? { l: "Completed", c: "#4ade80" } : p >= 75 ? { l: "Almost Complete", c: "#67e8f9" } : p > 0 ? { l: "In Progress", c: "#a78bfa" } : { l: "Not Started", c: "#94a3b8" };

/** Student Progress — same scoring as the desktop/mobile (GET /api/student/progress). */
export default function ProgressPage() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const load = () => { setErr(""); api("/api/student/progress").then(setD).catch((e) => setErr(e.message || "Failed to load progress.")); };
  useEffect(load, []);

  const header = <PageHeader icon="🎓" title="Student Progress" sub="Track your learning journey and performance" />;
  if (err) return <div className="mx-auto max-w-5xl pt-2">{header}<div className="text-center text-slate-400">{err} <button onClick={load} className="text-violet-300 underline">Retry</button></div></div>;
  if (!d) return <div className="mx-auto max-w-5xl pt-2">{header}<Loading text="Loading progress data..." /></div>;

  const score = d.overallScore || 0;
  const lessonPct = d.totalLessons ? Math.round((d.totalLessonsCompleted / d.totalLessons) * 100) : 0;
  const q = d.ratingBreakdown?.quiz, e = d.ratingBreakdown?.exercise;

  return (
    <div className="mx-auto max-w-5xl space-y-5 pt-2">
      {header}
      <section className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-[#2e1a4a]/60 to-[#161626] p-6">
        <div className="grid items-center gap-6 md:grid-cols-[1fr_1px_1.2fr]">
          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Overall Performance</div>
            <Stars value={d.overallRating} size="text-2xl" />
            <div className="mt-1 text-4xl font-extrabold">{d.overallRating} <span className="text-lg text-slate-500">/ 5</span></div>
            <span className="mt-2 inline-block rounded-full border border-violet-400/30 bg-violet-500/15 px-3 py-0.5 text-xs font-bold text-violet-200">{perf(score)}</span>
          </div>
          <div className="hidden h-20 w-px bg-white/10 md:block" />
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Learning Score</div>
            <div className="mb-2 bg-gradient-to-r from-violet-400 to-pink-500 bg-clip-text text-5xl font-extrabold text-transparent">{score}%</div>
            <Bar pct={score} h="h-2.5" />
            <div className="mt-2 text-xs text-slate-400">Keep going! You&apos;re doing great.</div>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-violet-400/15 bg-violet-500/5 p-4"><div className="text-2xl font-extrabold">{d.totalLessonsCompleted} / {d.totalLessons}</div><div className="text-xs text-slate-400">Lessons Completed</div><div className="text-xs font-semibold text-emerald-300">{lessonPct}% Completed</div></div>
          <div className="rounded-2xl border border-violet-400/15 bg-violet-500/5 p-4"><div className="text-2xl font-extrabold">{d.courses.length}</div><div className="text-xs text-slate-400">Courses Enrolled</div></div>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Quiz Performance" icon="📝">
          <Stars value={q?.rating || 0} />
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
            <Box v={`${q?.accuracy ?? 0}%`} l="Accuracy" /><Box v={`${q?.attempted ?? 0}/${q?.totalQuizzes ?? 0}`} l="Attempted" /><Box v={q?.correct ?? 0} l="Correct" />
          </div>
        </Panel>
        <Panel title="Exercise Performance" icon="💻">
          <Stars value={e?.rating || 0} />
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
            <Box v={`${e?.passRate ?? 0}%`} l="Pass rate" /><Box v={`${e?.attempted ?? 0}/${e?.totalExercises ?? 0}`} l="Attempted" /><Box v={e?.passed ?? 0} l="Passed" />
          </div>
        </Panel>
      </div>

      <Panel title="Course-wise Progress" icon="📚">
        {d.courses.length === 0 ? <EmptyState icon="📚" title="No courses yet" text="Enrol in a course to see your progress here." /> : (
          <div className="space-y-3">
            {d.courses.map((c) => {
              const st = state(c.progressPercent);
              const isOpen = open === c.id;
              return (
                <div key={c.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                  <button onClick={() => setOpen(isOpen ? null : c.id)} className="w-full p-4 text-left">
                    <div className="mb-3 flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15 text-xl">{/java(?!script)/i.test(c.title) ? "☕" : /python/i.test(c.title) ? "🐍" : /^c\b|c programming/i.test(c.title) ? "🇨" : "📘"}</span>
                      <div className="min-w-0 flex-1"><div className="truncate font-bold">{c.title}</div><span className="text-xs font-bold" style={{ color: st.c }}>{st.l}</span></div>
                      <span className="text-lg font-extrabold text-violet-300">{c.progressPercent}%</span>
                      <ChevronDown size={18} className={`transition ${isOpen ? "rotate-180" : ""}`} />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Metric label="📖 Lessons" pct={c.progressPercent} text={`${c.lessonsCompleted}/${c.totalLessons}`} />
                      <Metric label="📝 Quiz" pct={c.quiz.total ? (c.quiz.attempted / c.quiz.total) * 100 : 0} text={c.quiz.attempted ? `${c.quiz.accuracy ?? 0}% accuracy` : "Not taken"} />
                      <Metric label="💻 Exercises" pct={c.exercise.total ? (c.exercise.passed / c.exercise.total) * 100 : 0} text={`${c.exercise.passed}/${c.exercise.total} passed`} />
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-white/10 p-4">
                      {c.modules.map((m) => (
                        <div key={m.id} className="mb-3">
                          <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">{m.title}</div>
                          {m.lessons.map((l) => (
                            <div key={l.id} className="mb-1 flex flex-wrap items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm">
                              <span>{l.completed ? "✅" : "⭕"}</span>
                              <span className="min-w-0 flex-1 truncate">{l.title}</span>
                              {l.quiz.total > 0 && <span className="rounded bg-violet-500/15 px-2 py-0.5 text-[11px]">📝 {l.quiz.attempted ? `${l.quiz.accuracy ?? 0}%` : "—"}</span>}
                              {l.exercise.total > 0 && <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[11px]">💻 {l.exercise.passed}/{l.exercise.total}</span>}
                              {l.achievements?.map((a, i) => <span key={i} title={a.title}>{a.badgeType === "super-master" ? "🏆" : a.badgeType === "master" ? "🥈" : "⭐"}</span>)}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

function Box({ v, l }: { v: React.ReactNode; l: string }) {
  return <div className="rounded-xl bg-white/5 p-2.5"><div className="font-extrabold">{v}</div><div className="text-[11px] text-slate-500">{l}</div></div>;
}
function Metric({ label, pct, text }: { label: string; pct: number; text: string }) {
  return <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3"><div className="mb-1.5 flex justify-between text-xs"><span className="text-slate-300">{label}</span><b>{text}</b></div><Bar pct={pct} h="h-1.5" /></div>;
}

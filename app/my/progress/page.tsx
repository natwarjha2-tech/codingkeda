"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { apiCached } from "../api";
import { EmptyState, Loading, PageHeader, Stars } from "@/components/my/ui";

/**
 * Student Progress — laid out like Khan Academy / Coursera progress pages:
 * 1) How am I doing? (score ring + rating), 2) Where am I strong or weak? (skills),
 * 3) What should I do next? (smart next steps), 4) Course mastery (per lesson).
 * Data: GET /api/student/progress (same scoring as the desktop & mobile apps).
 */

type QuizS = { total: number; attempted: number; correct: number; accuracy: number | null };
type ExS = { total: number; attempted: number; passed: number; rate?: number };
type Lesson = { id: string; title: string; completed: boolean; quiz: QuizS; exercise: ExS; achievements: { badgeType: string; title: string }[] };
type Course = { id: string; title: string; totalLessons: number; lessonsCompleted: number; progressPercent: number; quiz: QuizS; exercise: ExS; modules: { id: string; title: string; lessons: Lesson[] }[] };
type Data = {
  overallRating: number; overallScore: number; totalLessonsCompleted: number; totalLessons: number;
  ratingBreakdown: { quiz: { rating: number; accuracy: number; totalQuizzes: number; attempted: number; correct: number }; exercise: { rating: number; passRate: number; totalExercises: number; attempted: number; passed: number } };
  courses: Course[];
};

// Mastery levels (Khan Academy style), worked out per lesson from real data.
type Level = "mastered" | "proficient" | "familiar" | "none";
const LEVELS: Record<Level, { label: string; color: string; hint: string }> = {
  mastered: { label: "Mastered", color: "#22c55e", hint: "Video done, quiz ≥ 80% and exercises passed" },
  proficient: { label: "Proficient", color: "#8b5cf6", hint: "Video done and practice mostly good" },
  familiar: { label: "Familiar", color: "#f59e0b", hint: "Started — practice to level up" },
  none: { label: "Not started", color: "#475569", hint: "Not opened yet" },
};
function levelOf(l: Lesson): Level {
  const quizOk = l.quiz.total === 0 || (l.quiz.attempted > 0 && (l.quiz.accuracy ?? 0) >= 80);
  const exOk = l.exercise.total === 0 || l.exercise.passed >= l.exercise.total;
  const practiced = l.quiz.attempted > 0 || l.exercise.attempted > 0;
  if (l.completed && quizOk && exOk) return "mastered";
  if (l.completed && ((l.quiz.total === 0 || (l.quiz.accuracy ?? 0) >= 60) || l.exercise.passed > 0)) return "proficient";
  if (l.completed || practiced) return "familiar";
  return "none";
}

const perf = (s: number) => (s >= 90 ? { l: "Outstanding", e: "🏆" } : s >= 75 ? { l: "Excellent", e: "🌟" } : s >= 50 ? { l: "Doing Well", e: "💪" } : s >= 25 ? { l: "Getting Started", e: "🚀" } : { l: "Just Beginning", e: "🌱" });
const courseEmoji = (t: string) => (/java(?!script)/i.test(t) ? "☕" : /python/i.test(t) ? "🐍" : /^c\b|c programming/i.test(t) ? "©️" : /dsa|algorithm/i.test(t) ? "🧩" : /web|html|react/i.test(t) ? "🌐" : /robot/i.test(t) ? "🤖" : /\bai\b|artificial/i.test(t) ? "🧠" : "📘");

export default function ProgressPage() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const load = () => { setErr(""); apiCached<Data>("/api/student/progress", setD).catch((e) => setErr(e.message || "Failed to load progress.")); };
  useEffect(load, []);

  // Per-lesson mastery + smart "next steps" (all from real data).
  const derived = useMemo(() => {
    if (!d) return null;
    const totals: Record<Level, number> = { mastered: 0, proficient: 0, familiar: 0, none: 0 };
    const perCourse: Record<string, Record<Level, number>> = {};
    const steps: { kind: "quiz" | "exercise" | "continue"; text: string; sub: string; href: string; prio: number }[] = [];
    for (const c of d.courses) {
      const pc: Record<Level, number> = { mastered: 0, proficient: 0, familiar: 0, none: 0 };
      let nextLesson: { l: Lesson; m: string } | null = null;
      for (const m of c.modules) for (const l of m.lessons) {
        const lv = levelOf(l);
        pc[lv]++; totals[lv]++;
        const href = `/my/lesson/${l.id}?course=${c.id}`;
        if (l.completed && l.quiz.total > 0 && l.quiz.attempted === 0) steps.push({ kind: "quiz", text: `Take the quiz: ${l.title}`, sub: `${c.title} · ${m.title}`, href, prio: 2 });
        else if (l.quiz.attempted > 0 && (l.quiz.accuracy ?? 0) < 60) steps.push({ kind: "quiz", text: `Retry the quiz: ${l.title}`, sub: `Scored ${l.quiz.accuracy ?? 0}% — aim for 80%`, href, prio: 1 });
        if (l.exercise.attempted > 0 && l.exercise.passed < l.exercise.total) steps.push({ kind: "exercise", text: `Finish the exercise: ${l.title}`, sub: `${l.exercise.passed}/${l.exercise.total} passed`, href, prio: 1 });
        if (!nextLesson && !l.completed) nextLesson = { l, m: m.title };
      }
      perCourse[c.id] = pc;
      if (nextLesson && c.progressPercent > 0 && c.progressPercent < 100) steps.push({ kind: "continue", text: `Continue: ${nextLesson.l.title}`, sub: `${c.title} · ${nextLesson.m}`, href: `/my/lesson/${nextLesson.l.id}?course=${c.id}`, prio: 0 });
    }
    steps.sort((a, b) => a.prio - b.prio);
    return { totals, perCourse, steps: steps.slice(0, 5) };
  }, [d]);

  const header = <PageHeader icon="🎓" title="Student Progress" sub="How you're doing, where to improve, and what to do next" back="/my/dashboard" />;
  if (err) return <div className="w-full pt-2">{header}<div className="text-center text-slate-400">{err} <button onClick={load} className="text-violet-300 underline">Retry</button></div></div>;
  if (!d || !derived) return <div className="w-full pt-2">{header}<Loading text="Loading progress data..." /></div>;

  const score = Math.round(d.overallScore || 0);
  const p = perf(score);
  const lessonPct = d.totalLessons ? Math.round((d.totalLessonsCompleted / d.totalLessons) * 100) : 0;
  const q = d.ratingBreakdown?.quiz, e = d.ratingBreakdown?.exercise;
  const allLessons = Object.values(derived.totals).reduce((a, b) => a + b, 0);

  return (
    <div className="w-full space-y-5 pt-2">
      {header}

      {/* 1. How am I doing? */}
      <section className="relative overflow-hidden rounded-3xl border border-violet-400/20 bg-gradient-to-br from-[#2e1a4a]/70 via-[#1c1636] to-[#161626] p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="relative grid items-center gap-6 lg:grid-cols-[auto_1fr_auto]">
          <Ring pct={score} size={150} stroke={12} from="#8b5cf6" to="#ec4899">
            <div className="text-4xl font-black">{score}<span className="text-lg text-slate-400">%</span></div>
            <div className="text-[11px] font-semibold text-slate-400">Learning score</div>
          </Ring>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-violet-300">Overall performance</div>
            <div className="mt-1 flex items-center gap-3">
              <span className="text-3xl font-black">{p.e} {p.l}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2"><Stars value={d.overallRating} size="text-xl" /><b className="text-sm">{d.overallRating} / 5</b></div>
            <p className="mt-2 max-w-md text-sm text-slate-300">
              Your score mixes lessons watched, quiz accuracy and exercises passed. {score < 75 ? "Use the next steps below to raise it 📈" : "Amazing work — keep it up! 🎉"}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
            <Mini v={`${d.totalLessonsCompleted}/${d.totalLessons}`} l="Lessons done" c="#22c55e" />
            <Mini v={d.courses.length} l="Courses" c="#8b5cf6" />
            <Mini v={derived.totals.mastered} l="Lessons mastered" c="#f59e0b" />
          </div>
        </div>
      </section>

      {/* 2. Skills */}
      <section className="grid gap-4 md:grid-cols-3">
        <Skill emoji="🎬" title="Lessons" color="#22c55e" pct={lessonPct} main={`${lessonPct}%`} sub={`${d.totalLessonsCompleted} of ${d.totalLessons} watched`} />
        <Skill emoji="📝" title="Quizzes" color="#8b5cf6" pct={q?.accuracy ?? 0} main={`${q?.accuracy ?? 0}%`} sub={`accuracy · ${q?.attempted ?? 0}/${q?.totalQuizzes ?? 0} taken · ${q?.correct ?? 0} correct`} rating={q?.rating} />
        <Skill emoji="💻" title="Exercises" color="#06b6d4" pct={e?.passRate ?? 0} main={`${e?.passRate ?? 0}%`} sub={`pass rate · ${e?.passed ?? 0}/${e?.totalExercises ?? 0} passed`} rating={e?.rating} />
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[1.2fr_1fr]">
        {/* 3. What to do next */}
        <section className="rounded-2xl border border-white/10 bg-[#161626]/75 p-5">
          <h2 className="mb-1 text-lg font-extrabold">🎯 What to do next</h2>
          <p className="mb-4 text-xs text-slate-400">Small steps that raise your score the fastest</p>
          {derived.steps.length === 0 ? (
            <div className="rounded-xl bg-emerald-500/10 p-4 text-center text-sm text-emerald-200">🎉 Nothing pending — you&apos;re all caught up! Explore a new course next.</div>
          ) : (
            <div className="space-y-2">
              {derived.steps.map((s, i) => {
                const t = s.kind === "quiz" ? { e: "📝", c: "#8b5cf6" } : s.kind === "exercise" ? { e: "💻", c: "#06b6d4" } : { e: "▶️", c: "#22c55e" };
                return (
                  <Link key={i} href={s.href} className="group flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 transition hover:-translate-y-0.5 hover:border-violet-400/30 hover:bg-violet-500/[0.06]">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg" style={{ background: `${t.c}22` }}>{t.e}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{s.text}</span>
                      <span className="block truncate text-[11px] text-slate-400">{s.sub}</span>
                    </span>
                    <ArrowRight size={16} className="shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-violet-300" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Mastery overview */}
        <section className="rounded-2xl border border-white/10 bg-[#161626]/75 p-5">
          <h2 className="mb-1 text-lg font-extrabold">🏅 Mastery overview</h2>
          <p className="mb-4 text-xs text-slate-400">Across all {allLessons} lessons in your courses</p>
          <Stacked counts={derived.totals} h="h-4" />
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {(Object.keys(LEVELS) as Level[]).map((k) => (
              <div key={k} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3" title={LEVELS[k].hint}>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300"><span className="h-2.5 w-2.5 rounded-full" style={{ background: LEVELS[k].color }} />{LEVELS[k].label}</div>
                <div className="mt-1 text-2xl font-extrabold">{derived.totals[k]}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">Mastered = video watched, quiz 80%+ and exercises passed.</p>
        </section>
      </div>

      {/* 4. Course mastery */}
      <section className="rounded-2xl border border-white/10 bg-[#161626]/75 p-5">
        <h2 className="mb-4 text-lg font-extrabold">📚 Course mastery</h2>
        {d.courses.length === 0 ? <EmptyState icon="📚" title="No courses yet" text="Enrol in a course to see your progress here." /> : (
          <div className="space-y-3">
            {d.courses.map((c) => {
              const isOpen = open === c.id;
              const pc = derived.perCourse[c.id];
              const status = c.progressPercent >= 100 ? { l: "Completed", c: "#4ade80" } : c.progressPercent > 0 ? { l: "In progress", c: "#a78bfa" } : { l: "Not started", c: "#94a3b8" };
              return (
                <div key={c.id} className={`overflow-hidden rounded-2xl border transition ${isOpen ? "border-violet-400/30 bg-violet-500/[0.04]" : "border-white/[0.08] bg-white/[0.02]"}`}>
                  <button onClick={() => setOpen(isOpen ? null : c.id)} className="grid w-full items-center gap-4 p-4 text-left md:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_auto]">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-2xl">{courseEmoji(c.title)}</span>
                      <div className="min-w-0">
                        <div className="truncate font-extrabold">{c.title}</div>
                        <div className="text-xs"><span className="font-bold" style={{ color: status.c }}>{status.l}</span><span className="text-slate-500"> · {c.lessonsCompleted}/{c.totalLessons} lessons</span></div>
                      </div>
                    </div>
                    <div>
                      <Stacked counts={pc} h="h-2.5" />
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
                        <span>📝 Quiz {c.quiz.attempted ? `${c.quiz.accuracy ?? 0}%` : "—"}</span>
                        <span>💻 Exercises {c.exercise.passed}/{c.exercise.total}</span>
                        <span className="text-emerald-300">{pc.mastered} mastered</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 justify-self-end">
                      <Ring pct={c.progressPercent} size={52} stroke={5} from="#8b5cf6" to="#22d3ee"><span className="text-xs font-extrabold">{c.progressPercent}%</span></Ring>
                      <ChevronDown size={18} className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-white/[0.06] p-4">
                      {/* Table header */}
                      <div className="mb-1 hidden grid-cols-[minmax(0,1fr)_90px_90px_90px_120px] gap-2 px-3 text-[10px] font-bold uppercase tracking-wide text-slate-500 md:grid">
                        <span>Lesson</span><span className="text-center">Video</span><span className="text-center">Quiz</span><span className="text-center">Exercise</span><span className="text-center">Mastery</span>
                      </div>
                      {c.modules.map((m) => (
                        <div key={m.id} className="mb-3">
                          <div className="mb-1 px-3 text-[11px] font-extrabold uppercase tracking-wide text-violet-300">{m.title}</div>
                          {m.lessons.map((l) => {
                            const lv = LEVELS[levelOf(l)];
                            return (
                              <Link key={l.id} href={`/my/lesson/${l.id}?course=${c.id}`}
                                className="mb-1 grid items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-sm transition hover:bg-white/[0.07] md:grid-cols-[minmax(0,1fr)_90px_90px_90px_120px]">
                                <span className="flex min-w-0 items-center gap-2">
                                  <span className="truncate font-semibold">{l.title}</span>
                                  {l.achievements?.map((a, i) => <span key={i} title={a.title}>{a.badgeType === "super-master" ? "🥇" : a.badgeType === "master" ? "🥈" : "🥉"}</span>)}
                                </span>
                                <Cell ok={l.completed} text={l.completed ? "Watched" : "—"} />
                                <Cell ok={l.quiz.total === 0 ? null : l.quiz.attempted > 0 && (l.quiz.accuracy ?? 0) >= 80} warn={l.quiz.attempted > 0 && (l.quiz.accuracy ?? 0) < 80}
                                  text={l.quiz.total === 0 ? "No quiz" : l.quiz.attempted ? `${l.quiz.accuracy ?? 0}%` : "Not taken"} />
                                <Cell ok={l.exercise.total === 0 ? null : l.exercise.passed >= l.exercise.total} warn={l.exercise.attempted > 0 && l.exercise.passed < l.exercise.total}
                                  text={l.exercise.total === 0 ? "None" : `${l.exercise.passed}/${l.exercise.total}`} />
                                <span className="flex justify-start md:justify-center">
                                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: `${lv.color}22`, color: lv.color === "#475569" ? "#94a3b8" : lv.color }}>{lv.label}</span>
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Ring({ pct, size, stroke, from, to, children }: { pct: number; size: number; stroke: number; from: string; to: string; children: React.ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, id = `g${size}${from.slice(1)}`;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={from} /><stop offset="100%" stopColor={to} /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (Math.max(0, Math.min(100, pct)) / 100) * c} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .6s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
function Mini({ v, l, c }: { v: React.ReactNode; l: string; c: string }) {
  return <div className="rounded-xl border px-4 py-2.5 text-center lg:text-left" style={{ borderColor: `${c}40`, background: `${c}12` }}><div className="text-lg font-extrabold">{v}</div><div className="text-[11px] text-slate-400">{l}</div></div>;
}
function Skill({ emoji, title, color, pct, main, sub, rating }: { emoji: string; title: string; color: string; pct: number; main: string; sub: string; rating?: number }) {
  const tag = pct >= 80 ? "Strong" : pct >= 50 ? "Good" : pct > 0 ? "Needs practice" : "Not started";
  return (
    <div className="flex items-center gap-4 rounded-2xl border bg-[#161626]/75 p-4" style={{ borderColor: `${color}35` }}>
      <Ring pct={pct} size={72} stroke={7} from={color} to={color}><span className="text-2xl">{emoji}</span></Ring>
      <div className="min-w-0">
        <div className="flex items-center gap-2"><b>{title}</b><span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${color}22`, color }}>{tag}</span></div>
        <div className="text-2xl font-extrabold" style={{ color }}>{main}</div>
        <div className="text-[11px] text-slate-400">{sub}</div>
        {rating != null && <Stars value={rating} size="text-xs" />}
      </div>
    </div>
  );
}
function Stacked({ counts, h }: { counts: Record<Level, number>; h: string }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className={`flex w-full overflow-hidden rounded-full bg-white/[0.06] ${h}`}>
      {(Object.keys(LEVELS) as Level[]).map((k) => counts[k] > 0 && (
        <div key={k} title={`${LEVELS[k].label}: ${counts[k]}`} style={{ width: `${(counts[k] / total) * 100}%`, background: LEVELS[k].color }} />
      ))}
    </div>
  );
}
function Cell({ ok, warn, text }: { ok: boolean | null; warn?: boolean; text: string }) {
  const cls = ok === null ? "text-slate-500" : ok ? "text-emerald-300" : warn ? "text-amber-300" : "text-slate-400";
  const icon = ok === null ? "" : ok ? "✓ " : warn ? "! " : "";
  return <span className={`text-xs font-semibold md:text-center ${cls}`}><span className="text-slate-500 md:hidden">· </span>{icon}{text}</span>;
}

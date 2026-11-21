"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/app/my/api";
import CodoHelp from "./CodoHelp";

type Quiz = { id: string; question: string; options: string[] };
type Result = { correct: boolean; correctAnswer: number; explanation?: string | null; selected: number };

/** Quiz tab: one question at a time. The server marks each answer (and awards coins). */
export default function QuizTab({ lessonId, courseId, onCoins }: { lessonId: string; courseId: string; onCoins: () => void }) {
  const [quizzes, setQuizzes] = useState<Quiz[] | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [reward, setReward] = useState("");
  const started = useRef(Date.now());
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (!full) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [full]);

  useEffect(() => {
    setQuizzes(null); setIdx(0); setSel(null); setResults({}); setMsg(""); setReward("");
    api(`/api/quiz?lessonId=${encodeURIComponent(lessonId)}`)
      .then((d) => { setQuizzes(d.quizzes || []); setAttempted(!!d.attempted); started.current = Date.now(); })
      .catch(() => setQuizzes([]));
  }, [lessonId]);

  if (quizzes === null) return <Card>Loading quiz…</Card>;
  if (quizzes.length === 0) return <Card><Empty icon="❓" text="Quiz coming soon for this lesson." /></Card>;

  const q = quizzes[idx];
  const r = results[q.id];
  const answered = Object.keys(results).length;
  const finished = answered === quizzes.length;
  const score = Object.values(results).filter((x) => x.correct).length;

  const check = async () => {
    if (sel === null) { setMsg("Please pick an answer first."); return; }
    setBusy(true); setMsg("");
    try {
      const d = await api("/api/quiz", {
        method: "POST",
        json: { quizId: q.id, selected: sel, courseId, lessonId, timeTaken: Math.round((Date.now() - started.current) / 1000) },
      });
      setResults((s) => ({ ...s, [q.id]: { correct: !!d.correct, correctAnswer: d.correctAnswer, explanation: d.explanation, selected: sel } }));
      if (d.coinsAwarded > 0) {
        setReward(`🪙 +${d.coinsAwarded} coins${d.rank ? ` · Rank #${d.rank}` : ""}${d.badge ? ` · ${d.badge}` : ""}`);
        onCoins();
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not check your answer.");
    } finally { setBusy(false); }
  };

  const next = () => { setIdx((i) => i + 1); setSel(null); setMsg(""); };
  const retry = () => { setResults({}); setIdx(0); setSel(null); setReward(""); setAttempted(true); started.current = Date.now(); };

  const letters = ["A", "B", "C", "D", "E", "F"];

  return (
    <div className={full ? "fixed inset-0 z-[85] overflow-y-auto bg-[#0a0814]/97 p-4 md:p-10" : ""}>
    <div className={full ? "mx-auto max-w-3xl" : ""}>
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-extrabold">Quiz</h3>
        <button onClick={() => setFull((f) => !f)} className="rounded-lg border border-violet-400/35 bg-violet-500/15 px-3 py-1.5 text-xs font-bold text-violet-300">{full ? "✕ Close" : "⛶ Open full page"}</button>
      </div>
      <p className="mb-3 text-xs text-white/50">Test what you&apos;ve learned</p>

      {attempted && (
        <div className="mb-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm">
          <b className="text-amber-300">⚠️ You attempted this quiz before. Try again only for practice.</b>
          <div className="text-xs text-white/60">No coins or leaderboard changes on re-attempts.</div>
        </div>
      )}

      {finished ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-6 text-center">
          <div className="text-5xl">{score === quizzes.length ? "🏆" : "🎉"}</div>
          <div className="mt-2 text-lg font-extrabold text-emerald-300">You completed this quiz with {score}/{quizzes.length} correct</div>
          {reward && <div className="mt-2 font-bold text-amber-300">{reward}</div>}
          <button onClick={retry} className="mt-4 rounded-xl border border-white/15 px-5 py-2 text-sm font-bold hover:bg-white/5">Practice again</button>
        </div>
      ) : (
        <div>
          {quizzes.length > 1 && <div className="mb-1 text-xs font-bold text-white/50">Question {idx + 1} of {quizzes.length}</div>}
          <div className="text-base font-bold">{q.question}</div>
          <div className="mt-3 space-y-2">
            {q.options.map((o, i) => {
              let cls = "border-white/10 bg-white/5 hover:border-violet-400/50";
              if (r) {
                if (i === r.correctAnswer) cls = "border-emerald-400 bg-emerald-400/15";
                else if (i === r.selected) cls = "border-red-400 bg-red-400/15";
                else cls = "border-white/10 bg-white/5 opacity-60";
              } else if (sel === i) cls = "border-violet-400 bg-violet-500/20";
              return (
                <button key={i} disabled={!!r} onClick={() => setSel(i)} className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${cls}`}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xs font-extrabold">{letters[i]}</span>
                  <span>{o}</span>
                </button>
              );
            })}
          </div>

          {msg && <div className="mt-3 text-sm text-amber-300">{msg}</div>}

          {r ? (
            <div className="mt-4">
              <div className={`rounded-xl p-3 text-sm font-bold ${r.correct ? "bg-emerald-400/15 text-emerald-300" : "bg-red-400/15 text-red-300"}`}>
                {r.correct ? "Correct! Well done! 🎉" : "Incorrect. The correct answer is highlighted."}
              </div>
              {r.explanation && <div className="mt-2 rounded-xl bg-white/5 p-3 text-sm text-white/80">💡 {r.explanation}</div>}
              {!r.correct && <CodoHelp kind="quiz" itemId={q.id} />}
              {reward && <div className="mt-2 font-bold text-amber-300">{reward}</div>}
              {idx < quizzes.length - 1 && (
                <button onClick={next} className="mt-3 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-extrabold hover:bg-emerald-400">Next Question →</button>
              )}
            </div>
          ) : (
            <button onClick={check} disabled={busy} className="mt-4 rounded-xl bg-violet-600 px-6 py-3 text-sm font-extrabold hover:bg-violet-500 disabled:opacity-60">
              {busy ? "Checking…" : "Check Answer"}
            </button>
          )}
        </div>
      )}
    </Card>
    </div>
    </div>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">{children}</div>;
}
export function Empty({ icon, text }: { icon: string; text: string }) {
  return <div className="py-8 text-center"><div className="text-4xl opacity-50">{icon}</div><p className="mt-2 text-sm text-white/50">{text}</p></div>;
}

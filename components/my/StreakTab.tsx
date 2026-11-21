"use client";
import { useState } from "react";
import { api } from "@/app/my/api";
import { Card } from "./QuizTab";

export type Streak = { id: string; title: string; description?: string | null; problem: string; weekNumber: number };

/** Weekly Streak challenge for a lesson (shown only when the lesson has one). */
export default function StreakTab({ streak }: { streak: Streak }) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ passed: boolean; feedback: string } | null>(null);

  const submit = async () => {
    if (!answer.trim()) { setRes({ passed: false, feedback: "Please write your answer first." }); return; }
    setBusy(true);
    try {
      const d = await api("/api/weekly-streak", { method: "POST", json: { streakId: streak.id, answer } });
      setRes({ passed: !!d.passed, feedback: d.feedback || (d.passed ? "Well done!" : "Not quite right. Try again!") });
    } catch (e) { setRes({ passed: false, feedback: e instanceof Error ? e.message : "Could not submit." }); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <h3 className="text-lg font-extrabold">🔥 Weekly Streak · Week {streak.weekNumber}</h3>
      <div className="mt-1 font-bold">{streak.title}</div>
      {streak.description && <p className="mt-1 text-sm text-white/70">{streak.description}</p>}
      <div className="mt-3 whitespace-pre-wrap rounded-xl bg-white/5 p-4 text-sm">{streak.problem}</div>
      <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={7} spellCheck={false} placeholder="Write your answer or code here…"
        className="mt-3 w-full resize-y rounded-xl border border-white/10 bg-black/50 p-4 font-mono text-sm text-violet-200 outline-none focus:border-violet-400" />
      <button onClick={submit} disabled={busy} className="mt-3 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-extrabold hover:bg-orange-400 disabled:opacity-60">{busy ? "Checking…" : "Submit answer"}</button>
      {res && <div className={`mt-3 rounded-xl p-3 text-sm font-bold ${res.passed ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-300"}`}>{res.passed ? "✅ " : "⚠️ "}{res.feedback}</div>}
    </Card>
  );
}

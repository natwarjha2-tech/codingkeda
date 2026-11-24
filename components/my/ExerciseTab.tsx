"use client";
import { useEffect, useState } from "react";
import { Play, Send } from "lucide-react";
import Link from "next/link";
import { api, apiCached } from "@/app/my/api";
import MonacoEditor from "./MonacoEditor";
import CodoHelp from "./CodoHelp";
import { Card, Empty } from "./QuizTab";

const LANGS = [
  { id: "java", label: "Java", judge0: 62 },
  { id: "c", label: "C", judge0: 50 },
  { id: "python", label: "Python", judge0: 71 },
  { id: "javascript", label: "JavaScript", judge0: 63 },
];

type Exercise = {
  id: string; title?: string | null; description?: string | null; difficulty?: string | null; type?: string | null;
  language?: string | null; starterCode?: string | null; hints?: string[] | string | null;
  inputFormat?: string | null; outputFormat?: string | null; constraints?: string | null; explanation?: string | null;
};
type TestResult = { test_case: number; passed: boolean; is_hidden: boolean; input?: string; expected?: string; actual?: string; time?: string };

export default function ExerciseTab({ lessonId, courseId, onCoins }: { lessonId: string; courseId: string; onCoins: () => void }) {
  const [items, setItems] = useState<Exercise[] | null>(null);

  useEffect(() => {
    setItems(null);
    apiCached(`/api/exercise?lessonId=${encodeURIComponent(lessonId)}`, (d) => setItems(d.exercises || []), { skipIfFresh: true })
      .catch(() => setItems([]));
  }, [lessonId]);

  if (items === null) return <Card>Loading exercise…</Card>;
  if (items.length === 0) return <Card><Empty icon="💻" text="Exercise coming soon for this lesson." /></Card>;

  return (
    <Card>
      <h3 className="mb-3 text-lg font-extrabold">Practice Exercise</h3>
      <div className="space-y-8">
        {items.map((ex, i) => (
          <div key={ex.id} className={i < items.length - 1 ? "border-b border-white/10 pb-8" : ""}>
            {items.length > 1 && <div className="mb-2 text-xs font-bold uppercase tracking-wide text-violet-300">Exercise {i + 1} of {items.length}{ex.difficulty ? ` · ${ex.difficulty}` : ""}</div>}
            <ExerciseItem ex={ex} courseId={courseId} lessonId={lessonId} onCoins={onCoins} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function ExerciseItem({ ex, courseId, lessonId, onCoins }: { ex: Exercise; courseId: string; lessonId: string; onCoins: () => void }) {
  const coding = ex.type === "coding";
  const startLang = LANGS.find((l) => l.id === (ex.language || "").toLowerCase())?.id || "java";
  const [lang, setLang] = useState(startLang);
  const [code, setCode] = useState(ex.starterCode || "");
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState<React.ReactNode>(null);
  const [results, setResults] = useState<React.ReactNode>(null);
  const [panel, setPanel] = useState<"output" | "results">("output");
  const [busy, setBusy] = useState<"" | "run" | "submit">("");
  const [passed, setPassed] = useState(false);

  const judge0 = LANGS.find((l) => l.id === lang)?.judge0 ?? 62;
  const hints = Array.isArray(ex.hints) ? ex.hints.join(" | ") : ex.hints || "";

  const run = async () => {
    if (!code.trim()) { setOutput(<Err>Please write some code before running.</Err>); setPanel("output"); return; }
    setBusy("run"); setPanel("output"); setOutput(<span className="text-white/60">Running…</span>);
    try {
      const d = await api("/api/code/run", { method: "POST", json: { source_code: code, language_id: judge0, stdin } });
      if (!d.success) { setOutput(<Err>{d.message || "Execution failed."}</Err>); return; }
      if (d.status === "compilation_error" && d.compile_output) setOutput(<Block label="Compilation Error" bad text={d.compile_output} />);
      else if (d.status === "runtime_error" && d.stderr) setOutput(<Block label="Runtime Error" bad text={d.stderr} />);
      else if (d.status === "time_limit") setOutput(<Block label="Time Limit Exceeded" bad text="Your code took too long to run (limit: 2 seconds)." />);
      else setOutput(<Block label="Executed Successfully" text={d.stdout || "No output produced."} extra={d.stderr && d.stdout ? d.stderr : ""} stats={d.time ? `⏱ ${d.time}s` : ""} />);
    } catch (e) { setOutput(<Err>{e instanceof Error ? e.message : "Could not reach the code runner."}</Err>); }
    finally { setBusy(""); }
  };

  const submit = async () => {
    if (!code.trim()) { setResults(<Err>Please write your solution before submitting.</Err>); setPanel("results"); return; }
    setBusy("submit"); setPanel("results"); setResults(<span className="text-white/60">Running against test cases…</span>);
    try {
      if (coding) {
        const d = await api("/api/code/submit", { method: "POST", json: { exerciseId: ex.id, source_code: code, language_id: judge0, courseId } });
        if (!d.success) { setResults(<Err>{d.message || "Submission failed."}</Err>); return; }
        setPassed(!!d.passed);
        if (d.passed) onCoins();
        setResults(
          <div>
            <div className={`rounded-lg p-3 font-bold ${d.passed ? "bg-emerald-400/15 text-emerald-300" : "bg-red-400/15 text-red-300"}`}>
              {d.passed ? "✅ Accepted — All Test Cases Passed!" : `❌ ${d.message || "Some test cases failed."}`}
            </div>
            <div className="mt-2 space-y-2">
              {(d.results as TestResult[] | undefined)?.map((tc) => (
                <div key={tc.test_case} className={`rounded-lg border p-2 text-sm ${tc.passed ? "border-emerald-400/30" : "border-red-400/30"}`}>
                  {tc.passed ? "✅" : "❌"} Test Case {tc.test_case}{tc.time ? <span className="text-white/40"> ({tc.time}s)</span> : null}
                  {!tc.passed && (tc.is_hidden
                    ? <div className="text-xs text-white/50">Hidden test case</div>
                    : <div className="mt-1 space-y-0.5 font-mono text-xs"><div>Input: {tc.input}</div><div>Expected: {tc.expected}</div><div>Got: {tc.actual}</div></div>)}
                </div>
              ))}
            </div>
          </div>,
        );
      } else {
        const d = await api("/api/exercise", { method: "POST", json: { exerciseId: ex.id, code, courseId, language: lang } });
        setPassed(!!d.passed);
        setResults(<div className={`rounded-lg p-3 font-bold ${d.passed ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-300"}`}>{d.passed ? "✅ " : "⚠️ "}{d.message || (d.passed ? "Correct! Well done! 🎉" : "Not quite right. Keep trying!")}</div>);
      }
    } catch (e) { setResults(<Err>{e instanceof Error ? e.message : "Could not submit. Try again."}</Err>); }
    finally { setBusy(""); }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const t = e.currentTarget;
    const s = t.selectionStart;
    const v = code.slice(0, s) + "  " + code.slice(t.selectionEnd);
    setCode(v);
    requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 2; });
  };

  return (
    <div>
      {coding && lessonId && (
        <Link href={`/my/code?exercise=${encodeURIComponent(ex.id)}&lesson=${encodeURIComponent(lessonId)}&course=${encodeURIComponent(courseId)}`}
          className="mb-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2.5 text-sm font-bold hover:-translate-y-0.5">
          ↗ Practice in Code Editor →
        </Link>
      )}
      {ex.title && <div className="text-base font-extrabold">{ex.title}</div>}
      {ex.description && <div className="mt-1 whitespace-pre-wrap text-sm text-white/85">{ex.description}</div>}
      {(ex.inputFormat || ex.outputFormat || ex.constraints) && (
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
          {ex.inputFormat && <Info label="Input" text={ex.inputFormat} />}
          {ex.outputFormat && <Info label="Output" text={ex.outputFormat} />}
          {ex.constraints && <Info label="Constraints" text={ex.constraints} />}
        </div>
      )}
      {hints && <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm">💡 {hints}</div>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {coding && (
          <select value={lang} onChange={(e) => setLang(e.target.value)} className="rounded-lg border border-white/15 bg-[#1a1a2e] px-3 py-2 text-sm font-semibold">
            {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        )}
        <span className="text-xs font-semibold text-white/50">{coding ? "Your code" : "Your answer"}</span>
      </div>
      {coding ? (
        <div className="mt-2 h-80 overflow-hidden rounded-xl border border-white/10">
          <MonacoEditor value={code} resetKey={`${ex.id}:${lang}`} language={lang} theme="dark" onChange={setCode} />
        </div>
      ) : (
        <textarea
          value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={onKey} spellCheck={false}
          rows={6} placeholder="Write your solution here…"
          className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/50 p-4 font-mono text-sm text-violet-200 outline-none focus:border-violet-400"
        />
      )}

      {coding && (
        <textarea value={stdin} onChange={(e) => setStdin(e.target.value)} rows={2} placeholder="Custom input (optional)"
          className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-white/5 p-3 font-mono text-xs outline-none focus:border-violet-400" />
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {coding && (
          <button onClick={run} disabled={!!busy} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-2.5 text-sm font-bold hover:bg-white/5 disabled:opacity-60">
            <Play size={14} /> {busy === "run" ? "Running…" : "Run"}
          </button>
        )}
        <button onClick={submit} disabled={!!busy} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-extrabold hover:bg-violet-500 disabled:opacity-60">
          <Send size={14} /> {busy === "submit" ? "Submitting…" : coding ? "Submit" : "Submit Solution"}
        </button>
      </div>

      {!coding && <CodoHelp kind="exercise" itemId={ex.id} />}

      {(output || results) && (
        <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/40">
          {coding && (
            <div className="flex border-b border-white/10 text-xs font-bold">
              <button onClick={() => setPanel("output")} className={`px-4 py-2 ${panel === "output" ? "bg-white/10" : "text-white/50"}`}>Output</button>
              <button onClick={() => setPanel("results")} className={`px-4 py-2 ${panel === "results" ? "bg-white/10" : "text-white/50"}`}>Test Results</button>
            </div>
          )}
          <div className="p-4 text-sm">{coding && panel === "output" ? output : results || output}</div>
        </div>
      )}

      {passed && ex.explanation && <div className="mt-3 rounded-xl bg-white/5 p-3 text-sm text-white/80">📘 {ex.explanation}</div>}
    </div>
  );
}

function Info({ label, text }: { label: string; text: string }) {
  return <div className="rounded-lg bg-white/5 p-2"><div className="font-bold text-white/60">{label}</div><div className="whitespace-pre-wrap text-white/85">{text}</div></div>;
}
function Err({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-red-300">{children}</span>;
}
function Block({ label, text, bad, extra, stats }: { label: string; text: string; bad?: boolean; extra?: string; stats?: string }) {
  return (
    <div>
      <div className={`mb-2 inline-block rounded px-2 py-0.5 text-xs font-bold ${bad ? "bg-red-400/20 text-red-300" : "bg-emerald-400/20 text-emerald-300"}`}>{label}</div>
      <pre className={`whitespace-pre-wrap font-mono text-xs ${bad ? "text-red-200" : "text-white/90"}`}>{text}</pre>
      {extra && <pre className="mt-2 whitespace-pre-wrap border-t border-white/10 pt-2 font-mono text-xs text-amber-300">{extra}</pre>}
      {stats && <div className="mt-2 text-xs text-white/40">{stats}</div>}
    </div>
  );
}

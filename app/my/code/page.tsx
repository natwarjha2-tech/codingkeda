"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft, Bot, ChevronDown, ChevronUp, Code2, FileText, FlaskConical, History, Laptop, Lightbulb, Menu,
  Moon, MoreVertical, Network, Play, Plus, Send, Sparkles, Sun, Terminal, X,
} from "lucide-react";
import { api } from "../api";
import { useMy } from "../MyContext";
import MonacoEditor, { type EditorHandle } from "@/components/my/MonacoEditor";
import { CODING_LANGUAGES, getDefaultStarter, langOf } from "@/components/my/monaco";
import {
  CATEGORIES, DIFF_COLORS, addSubmission, awardSolve, currentStreak, detectAlgorithm, extractHints, filenameFromTitle,
  formatIndent, getMyProblems, getScore, getSubmissions, restoreCode, saveCode, saveMyProblems, timeAgo,
  type Problem, type Submission,
} from "./logic";

type Tab = "all" | "my" | "score";
type Line = { kind: "info" | "ok" | "err" | "warn" | "pre" | "errpre" | "node"; text?: string; node?: React.ReactNode };

export default function CodeEditorPage() {
  return (
    <Suspense fallback={<div className="pt-10 text-center text-white/50">Loading Code Editor…</div>}>
      <CodeEditor />
    </Suspense>
  );
}

function CodeEditor() {
  const { user, refreshCoins } = useMy();
  const who = user?.email || "anon";
  const params = useSearchParams();

  // theme (shared key with the desktop app)
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => { setTheme((localStorage.getItem("ck_ce_theme") as "dark" | "light") || "dark"); }, []);
  const toggleTheme = () => setTheme((t) => { const n = t === "dark" ? "light" : "dark"; localStorage.setItem("ck_ce_theme", n); return n; });
  const L = theme === "light";
  // Palette copied from the desktop app's --ce-* variables (global.css).
  const c = {
    bg: L ? "bg-white" : "bg-black",
    panel: L ? "bg-white" : "bg-black",
    bar: L ? "bg-[#f1f3f5] border-[#dee2e6]" : "bg-white/5 border-white/10",
    head: L ? "bg-[#e9ecef]" : "bg-black/40",
    card: L ? "bg-[#f8f9fa] border-[#e9ecef]" : "bg-white/[0.03] border-white/[0.06]",
    text: L ? "text-[#212529]" : "text-[#e2e8f0]",
    muted: L ? "text-[#6c757d]" : "text-[#94a3b8]",
    border: L ? "border-[#dee2e6]" : "border-white/10",
    btn: L ? "bg-[#e9ecef] border-[#ced4da] text-[#495057] hover:bg-[#dee2e6]" : "bg-white/[0.08] border-white/15 text-[#94a3b8] hover:bg-white/[0.12]",
    input: L ? "bg-[#e9ecef] border-[#ced4da] text-[#212529]" : "bg-white/[0.08] border-white/15 text-[#e2e8f0]",
  };
  // Desktop toolbar buttons: .coding-toolbar-btn--problems / desc / format / ai / panel / mode, plus run & submit.
  const TB = {
    base: "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-[7px] text-[0.78rem] font-semibold leading-none transition hover:-translate-y-px hover:shadow-lg",
    problems: L ? "border-[rgba(37,99,235,0.25)] bg-[rgba(37,99,235,0.08)] text-[#2563eb] hover:bg-[rgba(37,99,235,0.15)]" : "border-[rgba(96,165,250,0.3)] bg-[rgba(96,165,250,0.12)] text-[#60a5fa] hover:bg-[rgba(96,165,250,0.22)] hover:text-[#93c5fd]",
    desc: L ? "border-[rgba(13,148,136,0.25)] bg-[rgba(13,148,136,0.08)] text-[#0d9488] hover:bg-[rgba(13,148,136,0.15)]" : "border-[rgba(45,212,191,0.3)] bg-[rgba(45,212,191,0.12)] text-[#2dd4bf] hover:bg-[rgba(45,212,191,0.22)] hover:text-[#5eead4]",
    format: L ? "border-[rgba(22,163,74,0.25)] bg-[rgba(22,163,74,0.08)] text-[#16a34a] hover:bg-[rgba(22,163,74,0.15)]" : "border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.12)] text-[#22c55e] hover:bg-[rgba(34,197,94,0.22)] hover:text-[#4ade80]",
    ai: L ? "border-[rgba(108,71,255,0.25)] bg-[rgba(108,71,255,0.08)] text-[#6c47ff] hover:bg-[rgba(108,71,255,0.15)]" : "border-[rgba(108,71,255,0.3)] bg-[rgba(108,71,255,0.12)] text-[#a78bfa] hover:bg-[rgba(108,71,255,0.22)] hover:text-[#c4b5fd]",
    panel: L ? "border-[rgba(79,70,229,0.25)] bg-[rgba(79,70,229,0.08)] text-[#4f46e5] hover:bg-[rgba(79,70,229,0.15)]" : "border-[rgba(129,140,248,0.3)] bg-[rgba(129,140,248,0.12)] text-[#818cf8] hover:bg-[rgba(129,140,248,0.22)] hover:text-[#a5b4fc]",
    mode: L ? "border-[rgba(217,119,6,0.25)] bg-[rgba(217,119,6,0.08)] text-[#d97706] hover:bg-[rgba(217,119,6,0.15)]" : "border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.12)] text-[#fbbf24] hover:bg-[rgba(245,158,11,0.22)] hover:text-[#fcd34d]",
    run: L ? "border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.1)] text-[#15803d] hover:bg-[rgba(34,197,94,0.2)]" : "border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.15)] text-[#22c55e] hover:bg-[rgba(34,197,94,0.25)]",
    submit: "border-transparent bg-gradient-to-br from-[#6c47ff] to-[#b251ff] font-bold text-white hover:from-[#7c5aff] hover:to-[#c060ff]",
  };

  // problems
  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [myProblems, setMyProblems] = useState<Problem[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [cat, setCat] = useState("all");
  const [diff, setDiff] = useState("all");
  const [active, setActive] = useState<Problem | null>(null);

  // layout
  const [leftOpen, setLeftOpen] = useState(true);
  const [descOpen, setDescOpen] = useState(true);
  const [lastHidden, setLastHidden] = useState<"left" | "desc" | null>(null);
  const [descPct, setDescPct] = useState(38);
  const [bottomOpen, setBottomOpen] = useState(true);
  const split = useRef<HTMLDivElement>(null);

  // editor
  const editor = useRef<EditorHandle>(null);
  const [lang, setLang] = useState("java");
  const [docValue, setDocValue] = useState("");
  const [docKey, setDocKey] = useState("none");
  const [cursor, setCursor] = useState("Ln 1, Col 1");
  const [stdin, setStdin] = useState("");
  const [inputOpen, setInputOpen] = useState(true);
  const [out, setOut] = useState<Line[]>([]);
  const [busy, setBusy] = useState<"" | "run" | "submit">("");
  const [history, setHistory] = useState<Submission[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AI + solution
  const [aiMenu, setAiMenu] = useState(false);
  const [aiPanel, setAiPanel] = useState<{ title: string; body: React.ReactNode } | null>(null);
  const [solution, setSolution] = useState<any>(null);
  const [userCx, setUserCx] = useState<{ tc: string; sc: string } | null>(null);

  // modals
  const [addOpen, setAddOpen] = useState(false);
  const [solOpen, setSolOpen] = useState(false);
  const [board, setBoard] = useState<{ id: string; title: string } | null>(null);
  const [itemMenu, setItemMenu] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<Problem | null>(null);
  const [scoreTick, setScoreTick] = useState(0);

  /* ── load ── */
  useEffect(() => {
    api("/api/coding-problems")
      .then((d) => { setProblems(d.problems || []); setCategories(d.categories || CATEGORIES); })
      .catch(() => setProblems([]));
  }, []);
  useEffect(() => { setMyProblems(getMyProblems(who)); }, [who]);

  const openProblem = useCallback((p: Problem) => {
    setActive(p);
    const l = (p.defaultLanguage || "java").toLowerCase();
    const safeLang = CODING_LANGUAGES.some((x) => x.id === l) ? l : "java";
    setLang(safeLang);
    const saved = restoreCode(who, p.id, safeLang);
    setDocValue(saved ?? (p.starterCode?.[safeLang] || getDefaultStarter(safeLang)));
    setDocKey(`${p.id}:${safeLang}:${Date.now()}`);
    const firstVisible = (p.testCases || []).find((t) => !t.isHidden);
    setStdin(firstVisible?.input || "");
    setOut([]);
    setUserCx(null);
    setAiPanel(null);
    setHistory(getSubmissions(who, p.id));
    setLeftOpen(false);           // full-screen workspace, like the desktop
    setLastHidden("left");
    setDescOpen(true);
    // pre-load best solution (AI ▾ features use it)
    setSolution(p.bestSolution || null);
    if (!p.bestSolution && !p.id.startsWith("my-")) {
      api(`/api/coding-problems/best-solution?problemId=${encodeURIComponent(p.id)}`).then((d) => d?.solution && setSolution(d.solution)).catch(() => {});
    }
  }, [who]);

  // Opened from a lesson's Exercise tab: /my/code?exercise=<id>&lesson=<id>&course=<id>
  useEffect(() => {
    const exId = params.get("exercise");
    const lessonId = params.get("lesson") || "";
    const courseId = params.get("course") || "";
    if (!exId || !lessonId) return;
    (async () => {
      try {
        const d = await api(`/api/exercise?lessonId=${encodeURIComponent(lessonId)}`);
        const ex = (d.exercises || []).find((e: any) => e.id === exId);
        if (!ex) return;
        let tcs: { input: string; expectedOutput: string }[] = [];
        try { const t = await api(`/api/exercise/test-cases?exerciseId=${encodeURIComponent(exId)}`); tcs = t.testCases || []; } catch { /* none */ }
        openProblem({
          id: ex.id, title: ex.title || "Exercise", description: ex.description || "", category: "Course Exercise",
          lessonId, courseId, difficulty: ex.difficulty || "medium", defaultLanguage: ex.language || "java",
          inputFormat: ex.inputFormat || "", outputFormat: ex.outputFormat || "", constraints: ex.constraints || "",
          explanation: ex.explanation || "", tags: ex.tags || [], timeComplexity: ex.timeComplexity || "", spaceComplexity: ex.spaceComplexity || "",
          starterCode: ex.starterCode ? { [ex.language || "java"]: ex.starterCode } : {},
          testCases: tcs.map((t) => ({ input: t.input, expectedOutput: t.expectedOutput, isHidden: false })),
          hints: Array.isArray(ex.hints) ? ex.hints : [], bestSolution: ex.bestSolution || null,
        });
      } catch { /* ignore */ }
    })();
  }, [params, openProblem]);

  const list = useMemo(() => {
    let l = tab === "my" ? myProblems : problems || [];
    if (cat !== "all") l = l.filter((p) => p.category === cat);
    if (diff !== "all") l = l.filter((p) => p.difficulty === diff);
    return l;
  }, [tab, myProblems, problems, cat, diff]);

  /* ── editor events ── */
  const onCode = (v: string) => {
    if (!active) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const pid = active.id, l = lang;
    saveTimer.current = setTimeout(() => saveCode(who, pid, l, v), 1500);
  };

  const changeLang = (l: string) => {
    if (!active) return;
    const cur = editor.current?.getValue() || "";
    saveCode(who, active.id, lang, cur);
    setLang(l);
    const saved = restoreCode(who, active.id, l);
    let next = saved;
    if (next === null) {
      const isDefault = !cur.trim() || CODING_LANGUAGES.some((x) => cur.trim() === getDefaultStarter(x.id).trim());
      next = isDefault ? active.starterCode?.[l] || getDefaultStarter(l) : cur;
    }
    setDocValue(next);
    setDocKey(`${active.id}:${l}:${Date.now()}`);
  };

  const format = () => {
    if (lang === "javascript") { editor.current?.format(); return; }
    const code = editor.current?.getValue() || "";
    const f = formatIndent(code, lang);
    if (f !== code) editor.current?.setValue(f);
  };

  const toggleLeft = () => { setLeftOpen((o) => { if (o) setLastHidden("left"); return !o; }); };
  const toggleDesc = () => { setDescOpen((o) => { if (o) setLastHidden("desc"); return !o; }); setTimeout(() => editor.current?.layout(), 60); };
  const restoreLast = () => {
    if (lastHidden === "left" && !leftOpen) toggleLeft();
    else if (lastHidden === "desc" && !descOpen) toggleDesc();
    else if (!leftOpen) toggleLeft();
    else if (!descOpen) toggleDesc();
  };

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const box = split.current;
    if (!box) return;
    const move = (ev: MouseEvent) => {
      const r = box.getBoundingClientRect();
      setDescPct(Math.min(65, Math.max(15, ((ev.clientX - r.left) / r.width) * 100)));
    };
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); editor.current?.layout(); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  /* ── run / submit ── */
  const analyze = (code: string) => {
    if (code.trim().length < 10) return;
    api("/api/code/analyze-complexity", { method: "POST", json: { code, language: lang } })
      .then((d) => {
        if (d?.timeComplexity && d?.spaceComplexity) {
          setUserCx({ tc: d.timeComplexity, sc: d.spaceComplexity });
          setOut((o) => [...o, { kind: "node", node: <div className="mt-2 flex gap-3 rounded-lg border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold"><span className="text-violet-300">📊 TC: {d.timeComplexity}</span><span className="text-amber-300">📊 SC: {d.spaceComplexity}</span></div> }]);
        }
      })
      .catch(() => {});
  };

  const runResultLines = (d: any, submitMode = false): Line[] => {
    if (!d?.success) return [{ kind: "err", text: d?.message || "Execution failed." }];
    if (d.status === "compilation_error") return [{ kind: "err", text: "Compilation Error" }, { kind: "errpre", text: d.compile_output || "" }];
    if (d.status === "runtime_error") return [{ kind: "err", text: "Runtime Error" }, { kind: "errpre", text: d.stderr || "" }];
    if (d.status === "time_limit") return [{ kind: "warn", text: "Time Limit Exceeded" }];
    const lines: Line[] = submitMode
      ? [{ kind: "ok", text: "✅ Submitted successfully" }, { kind: "info", text: "No test cases configured — output shown below (not verified)." }, { kind: "pre", text: d.stdout || "(no output)" }]
      : [{ kind: "ok", text: "Executed Successfully" }, { kind: "pre", text: d.stdout || "(no output)" }];
    if (!submitMode && (d.time != null || d.memory != null)) {
      lines.push({ kind: "node", node: <div className="mt-2 flex gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold">{d.time != null && <span className="text-emerald-400">⏱ {parseFloat(d.time).toFixed(3)}s</span>}{d.memory != null && <span className="text-sky-400">💾 {d.memory >= 1024 ? `${(d.memory / 1024).toFixed(1)} MB` : `${d.memory} KB`}</span>}</div> });
    }
    return lines;
  };

  const run = async () => {
    const code = editor.current?.getValue() || "";
    if (!code.trim()) { setOut([{ kind: "err", text: "Write some code first." }]); return; }
    setBusy("run"); setOut([{ kind: "info", text: "Running..." }]); setBottomOpen(true);
    try {
      const d = await api("/api/code/run", { method: "POST", json: { source_code: code, language_id: langOf(lang).judge0Id, stdin } });
      setOut(runResultLines(d));
      if (d?.success) analyze(code);
    } catch (e) { setOut([{ kind: "err", text: e instanceof Error ? e.message : "Connection failed." }]); }
    finally { setBusy(""); }
  };

  const finishAccepted = (p: Problem, code: string, extra: Line[]) => {
    const award = awardSolve(who, p, lang);
    const lines: Line[] = [...extra];
    if (award.awarded) {
      lines.push({ kind: "node", node: <div className="mt-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-400">🎉 +{award.points} points | +{award.coins} coins earned!</div> });
      if (award.streakBonus) lines.push({ kind: "node", node: <div className="mt-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-300">🔥 7-Day Streak Complete! +10 bonus coins awarded!</div> });
      api("/api/coding-score/earn", { method: "POST", json: { problemId: p.id, problemTitle: p.title, difficulty: p.difficulty, points: award.points, coins: award.coins } }).then(refreshCoins).catch(() => {});
      if (award.streakBonus) {
        const today = new Date().toISOString().split("T")[0];
        api("/api/coding-score/earn", { method: "POST", json: { problemId: `streak_bonus_${today}`, problemTitle: "7-Day Streak Bonus", difficulty: "streak", points: 0, coins: 10 } }).catch(() => {});
      }
      setScoreTick((t) => t + 1);
    }
    setOut((o) => [...o, ...lines]);
    // per-problem leaderboard (+ coins for top ranks)
    if (!p.id.startsWith("my-")) {
      api("/api/coding-problems/leaderboard", { method: "POST", json: { problemId: p.id, problemTitle: p.title, qualityTag: "green", lessonId: p.lessonId, courseId: p.courseId } })
        .then((d) => {
          if (d?.success && !d.alreadyRanked && d.rank) {
            setOut((o) => [...o, { kind: "node", node: <div className="mt-2 flex items-center justify-between rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-sm font-bold"><span className="text-violet-300">🏆 Rank #{d.rank}</span>{d.coinsAwarded > 0 && <span className="text-amber-300">+{d.coinsAwarded} 🪙 coins</span>}</div> }]);
            refreshCoins();
          }
        })
        .catch(() => {});
    }
    void code;
  };

  const submit = async () => {
    const p = active;
    const code = editor.current?.getValue() || "";
    if (!p) return;
    if (!code.trim()) { setOut([{ kind: "err", text: "Write your solution first." }]); return; }
    const judge0 = langOf(lang).judge0Id;
    setBusy("submit"); setBottomOpen(true); setOut([{ kind: "info", text: "Testing against all cases..." }]);

    try {
      // Course exercise: the server runs all test cases (including hidden ones) and records progress.
      if (p.courseId) {
        const d = await api("/api/code/submit", { method: "POST", json: { exerciseId: p.id, source_code: code, language_id: judge0, courseId: p.courseId } });
        const results: any[] = d.results || [];
        const passedCount = results.filter((r) => r.passed).length;
        setOut([{ kind: "node", node: <TcResults passed={!!d.passed} message={d.message} results={results} total={results.length} /> }]);
        addSubmission(who, p.id, { status: d.passed ? "accepted" : "wrong_answer", passed: !!d.passed, language: lang, passedCount, totalCount: results.length });
        setHistory(getSubmissions(who, p.id));
        analyze(code);
        if (d.passed) finishAccepted(p, code, []);
        return;
      }

      const tcs = p.testCases || [];
      if (tcs.length === 0) {
        const d = await api("/api/code/run", { method: "POST", json: { source_code: code, language_id: judge0, stdin } });
        setOut(runResultLines(d, true));
        if (d?.success) analyze(code);
        return;
      }

      const results = await Promise.all(tcs.map(async (tc, i) => {
        try {
          const d = await api("/api/code/run", { method: "POST", json: { source_code: code, language_id: judge0, stdin: tc.input } });
          const stdout = String(d.stdout || "").trim();
          const ok = !!d.success && d.status === "accepted" && stdout === String(tc.expectedOutput).trim();
          return { test_case: i + 1, passed: ok, is_hidden: !!tc.isHidden, input: tc.input, expected: tc.expectedOutput, actual: stdout || d.stderr || d.compile_output || "No output" };
        } catch {
          return { test_case: i + 1, passed: false, is_hidden: !!tc.isHidden, input: "?", expected: "?", actual: "Error" };
        }
      }));
      const passedCount = results.filter((r) => r.passed).length;
      const allPassed = passedCount === results.length;
      setOut([{ kind: "node", node: <TcResults passed={allPassed} message={`${passedCount}/${results.length} test cases passed.`} results={results} total={results.length} /> }]);
      analyze(code);
      addSubmission(who, p.id, { status: allPassed ? "accepted" : "wrong_answer", passed: allPassed, language: lang, passedCount, totalCount: results.length });
      setHistory(getSubmissions(who, p.id));
      if (allPassed) finishAccepted(p, code, []);
    } catch (e) {
      setOut([{ kind: "err", text: e instanceof Error ? e.message : "Connection failed." }]);
    } finally { setBusy(""); }
  };

  /* ── AI ▾ ── */
  const langSolution = (): any => {
    if (!solution) return null;
    const s = solution[lang];
    if (s?.code) return s;
    if (solution.code && solution.language === lang) return solution;
    return null;
  };
  const notReady = <div className="text-amber-400">Best solution not loaded yet. Please wait a moment and try again.</div>;
  const aiHints = () => {
    setAiMenu(false);
    const s = langSolution();
    if (!s) { setAiPanel({ title: "💡 Hints", body: notReady }); return; }
    setAiPanel({
      title: "💡 Hints",
      body: (
        <div>
          <div className="mb-2 text-xs text-slate-400">Based on optimal {lang.toUpperCase()} solution:</div>
          {extractHints(s.code).map((h, i) => <div key={i} className="mb-2 flex gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 p-2 text-sm"><b className="text-amber-300">{i + 1}.</b><span>{h}</span></div>)}
          {(s.timeComplexity || s.tc) && <div className="mt-2 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-2 text-xs font-semibold text-emerald-400">⏱ Target TC: {s.timeComplexity || s.tc} | 💾 Target SC: {s.spaceComplexity || s.sc || "?"}</div>}
        </div>
      ),
    });
  };
  const aiAlgo = () => {
    setAiMenu(false);
    const s = langSolution();
    if (!s) { setAiPanel({ title: "🔬 Algorithm", body: notReady }); return; }
    const a = detectAlgorithm(s.code);
    setAiPanel({
      title: "🔬 Algorithm",
      body: (
        <div>
          <div className="mb-2 text-xs text-slate-400">Algorithm used in optimal {lang.toUpperCase()} solution:</div>
          <div className="mb-3 inline-block rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 py-1.5 text-sm font-bold text-sky-300">{a.name}</div>
          <div className="mb-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm leading-relaxed">{a.explanation}</div>
          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-violet-300">Step-by-Step:</div>
          {a.steps.map((st, i) => <div key={i} className="mb-1 flex gap-2 rounded bg-violet-500/5 px-2 py-1 text-xs"><b className="text-violet-300">→</b>{st}</div>)}
          <div className="mt-3 flex gap-2 text-xs font-bold"><span className="rounded bg-emerald-400/10 px-2 py-1 text-emerald-400">⏱ {s.timeComplexity || s.tc || "?"}</span><span className="rounded bg-sky-400/10 px-2 py-1 text-sky-300">💾 {s.spaceComplexity || s.sc || "?"}</span></div>
          {s.explanation && <div className="mt-3 rounded-lg border border-emerald-400/15 bg-emerald-400/5 p-2 text-xs"><b className="text-emerald-400">Summary:</b> {s.explanation}</div>}
        </div>
      ),
    });
  };
  const aiOptimal = () => {
    setAiMenu(false);
    const s = langSolution();
    if (!s) { setAiPanel({ title: "💻 Optimal Solution", body: notReady }); return; }
    editor.current?.setValue(s.code);
    if (active) saveCode(who, active.id, lang, s.code);
    setAiPanel(null);
  };

  /* ── my problems ── */
  const addProblem = (p: Problem) => {
    const next = [...myProblems, p];
    setMyProblems(next); saveMyProblems(who, next);
    setAddOpen(false); setTab("my");
  };
  const deleteProblem = (p: Problem) => {
    const next = myProblems.filter((x) => x.id !== p.id);
    setMyProblems(next); saveMyProblems(who, next);
    try {
      Object.keys(localStorage).forEach((k) => { if (k.startsWith(`ck_pg_${who}_${p.id}_`) || k === `ck_pg_subs_${who}_${p.id}`) localStorage.removeItem(k); });
    } catch { /* ignore */ }
    if (active?.id === p.id) { setActive(null); setLeftOpen(true); }
    setConfirmDel(null);
  };

  /* ── render ── */
  const p = active;
  const langLocked = !!p && (p.category === "Course Exercise" || !!p.lockedLanguage) && !!p.defaultLanguage;
  const langs = langLocked ? CODING_LANGUAGES.filter((l) => l.id === p!.defaultLanguage) : CODING_LANGUAGES;
  const tbBtn = `${TB.base} ${c.btn}`;

  return (
    <div className={`-mx-4 md:-mx-6 flex h-[calc(100vh-48px)] overflow-hidden ${c.bg} ${c.text}`}>
      {/* LEFT: problem list */}
      <div className={`flex h-full flex-col overflow-hidden border-r transition-all duration-200 ${c.panel} ${c.border} ${leftOpen ? "w-[320px] min-w-[280px]" : "w-0 min-w-0 border-r-0"}`}>
        <div className={`flex items-center justify-between border-b px-4 py-3.5 ${c.border}`}>
          <h3 className="m-0 flex items-center gap-2 text-[0.95rem] font-bold"><Laptop size={16} className="text-violet-400" /> Coding Practice</h3>
          <button onClick={() => setAddOpen(true)} title="Add your own problem" className="flex h-7 w-7 items-center justify-center rounded-lg border border-violet-400/30 bg-violet-500/15 text-violet-300"><Plus size={13} /></button>
        </div>
        <div className={`flex gap-1.5 border-b px-3 py-2 ${c.border}`}>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className={`min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-xs outline-none ${c.input}`}>
            <option value="all">All Categories</option>
            {categories.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <select value={diff} onChange={(e) => setDiff(e.target.value)} className={`min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-xs outline-none ${c.input}`}>
            <option value="all">All Levels</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
          </select>
        </div>
        <div className={`flex border-b px-3 ${c.border}`}>
          {([["all", "All Problems"], ["my", "My Problems"], ["score", "Coding Score"]] as [Tab, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`border-b-2 px-3 py-2.5 text-xs font-semibold ${tab === k ? "border-violet-400 text-violet-400" : `border-transparent ${c.muted}`}`}>{label}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-1.5 pb-5">
          {tab === "score" ? (
            <ScoreTab who={who} tick={scoreTick} c={c} onRank={(id, title) => setBoard({ id, title })} />
          ) : problems === null && tab === "all" ? (
            <div className={`p-10 text-center text-sm ${c.muted}`}>Loading problems...</div>
          ) : list.length === 0 ? (
            tab === "my"
              ? <div className={`p-10 text-center ${c.muted}`}><div className="mb-3 text-3xl">📝</div><div className="text-sm">No custom problems yet.</div><div className="mt-1.5 text-xs">Click + to add your own!</div></div>
              : <div className={`p-10 text-center text-sm ${c.muted}`}>No problems found for this filter.</div>
          ) : (
            list.map((x, i) => (
              <div key={x.id} onClick={() => openProblem(x)}
                className={`relative mb-1 flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 ${active?.id === x.id ? "bg-violet-500/15 ring-1 ring-violet-400/30" : L ? "hover:bg-slate-100" : "hover:bg-white/5"}`}>
                <span className={`w-5 text-center text-xs ${c.muted}`}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{x.title}</div>
                  <div className={`truncate text-[11px] ${c.muted}`}>{x.category}</div>
                </div>
                <DiffPill d={x.difficulty} />
                {tab === "my" && (
                  <button onClick={(e) => { e.stopPropagation(); setItemMenu(itemMenu === x.id ? null : x.id); }} className={`rounded p-1 ${c.muted} hover:bg-white/10`} title="More"><MoreVertical size={14} /></button>
                )}
                {itemMenu === x.id && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setItemMenu(null); }} />
                    <div className="absolute right-2 top-9 z-50 min-w-32 overflow-hidden rounded-lg border border-white/10 bg-[#1a1a2e] shadow-xl">
                      <button onClick={(e) => { e.stopPropagation(); setItemMenu(null); setConfirmDel(x); }} className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-white/5">🗑 Delete</button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT */}
      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        {!p ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="px-10 py-16 text-center">
              {!leftOpen && <button onClick={toggleLeft} className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/80 hover:text-white"><Menu size={13} /> Problems</button>}
              <div className="mb-4 text-5xl">🖥️</div>
              <h2 className="mb-2 text-2xl font-extrabold">Select a Problem</h2>
              <p className={`text-sm leading-relaxed ${c.muted}`}>Choose a problem from the left panel to start coding.<br />Practice makes perfect!</p>
            </div>
          </div>
        ) : (
          <div ref={split} className="flex h-full w-full overflow-hidden">
            {/* Description */}
            {descOpen && (
              <>
                <div style={{ width: `${descPct}%` }} className="h-full min-w-[150px] flex-none select-text overflow-y-auto px-3 pb-10 pt-3">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-lg font-extrabold">{p.title}</span>
                    <DiffPill d={p.difficulty} />
                    <span className={`rounded-md border px-2 py-0.5 text-[11px] ${c.card} ${c.muted}`}>{p.category}</span>
                  </div>
                  <div className={`mb-3 whitespace-pre-wrap rounded-xl border p-4 text-sm leading-[1.7] ${c.card}`}>{p.description}</div>
                  {(p.inputFormat || p.outputFormat) && (
                    <div className="mb-3 flex gap-2.5">
                      {p.inputFormat && <FmtBox label="Input Format" text={p.inputFormat} c={c} />}
                      {p.outputFormat && <FmtBox label="Output Format" text={p.outputFormat} c={c} />}
                    </div>
                  )}
                  {(p.testCases || []).filter((t) => !t.isHidden).length > 0 && (
                    <div className={`mb-3 overflow-hidden rounded-xl border ${c.card}`}>
                      <div className={`flex items-center gap-2 border-b px-3 py-2 text-xs font-bold ${c.border}`}><FlaskConical size={13} className="text-violet-400" /> Sample Test Cases</div>
                      <div className="space-y-2 p-3">
                        {(p.testCases || []).filter((t) => !t.isHidden).map((t, i) => (
                          <div key={i}>
                            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#a78bfa]">Sample {i + 1}</div>
                            <div className="grid grid-cols-2 gap-2">
                              <div><div className={`text-[10px] uppercase ${c.muted}`}>Input</div><pre className={`whitespace-pre-wrap rounded-md border p-2 font-mono text-xs ${L ? "border-[#e9ecef] bg-[#e9ecef] text-[#5b21b6]" : "border-white/[0.06] bg-black/30 text-[#c4b5fd]"}`}>{t.input}</pre></div>
                              <div><div className={`text-[10px] uppercase ${c.muted}`}>Expected</div><pre className={`whitespace-pre-wrap rounded-md border p-2 font-mono text-xs ${L ? "border-[#e9ecef] bg-[#e9ecef] text-[#5b21b6]" : "border-white/[0.06] bg-black/30 text-[#c4b5fd]"}`}>{t.expectedOutput}</pre></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {!!p.hints?.length && <div className="mb-3 flex gap-2 rounded-xl border border-[rgba(245,158,11,0.15)] bg-[rgba(245,158,11,0.06)] px-4 py-3 text-[0.82rem] text-[#fbbf24]"><Lightbulb size={15} className="mt-0.5 shrink-0 text-[#fbbf24]" /><span>{p.hints.join(" | ")}</span></div>}
                  {p.explanation && <div className="mb-3 rounded-xl border border-emerald-400/15 bg-emerald-400/5 p-3 text-sm"><div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-emerald-400">Explanation</div><div className="opacity-85">{p.explanation}</div></div>}
                  {!!p.tags?.length && <div className="mb-3 flex flex-wrap gap-1.5">{p.tags.map((t) => <span key={t} className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${c.card} ${c.muted}`}>#{t}</span>)}</div>}
                  {(p.constraints || p.timeComplexity || p.spaceComplexity) && (
                    <div className="rounded-xl border border-violet-400/15 bg-violet-500/5 p-3 text-sm">
                      {p.constraints && <><div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-violet-300">Constraints</div><div className="mb-2 whitespace-pre-wrap opacity-85">{p.constraints}</div></>}
                      {(p.timeComplexity || p.spaceComplexity) && (
                        <div className={`flex gap-4 border-t pt-2 text-xs font-semibold ${c.border}`}>
                          {p.timeComplexity && <span className="text-emerald-400">⏱ Expected: {p.timeComplexity}</span>}
                          {p.spaceComplexity && <span className="text-sky-400">💾 Space: {p.spaceComplexity}</span>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div onMouseDown={startResize} className={`w-[5px] flex-none cursor-col-resize border-x hover:bg-violet-500/50 ${c.border} ${L ? "bg-slate-200" : "bg-white/5"}`} />
              </>
            )}

            {/* Editor side */}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden pl-1">
              {/* Toolbar */}
              <div className={`m-2 mb-0 flex flex-wrap items-center justify-between gap-2 rounded-t-xl border border-b-0 px-3 py-2 ${c.bar}`}>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(!leftOpen || !descOpen) && <button onClick={restoreLast} className={tbBtn} title="Show hidden panel"><ArrowLeft size={13} /></button>}
                  <button onClick={toggleLeft} className={`${TB.base} ${TB.problems}`} title="Toggle Problem List"><Menu size={13} /> Problems</button>
                  <button onClick={toggleDesc} className={`${TB.base} ${TB.desc}`} title="Toggle Description Panel"><FileText size={13} /> Desc</button>
                  <select value={lang} onChange={(e) => changeLang(e.target.value)} className={`min-w-[100px] max-w-[160px] cursor-pointer rounded-lg border px-3 py-[7px] text-[0.78rem] font-semibold outline-none ${c.input}`}>
                    {langs.map((l) => <option key={l.id} value={l.id}>{l.icon} {l.label}</option>)}
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Format — green outline like desktop */}
                  <button onClick={format} className={`${TB.base} ${TB.format}`} title="Format Code"><Sparkles size={13} /> Format</button>
                  {/* AI — violet glow button with dropdown */}
                  <div className="relative">
                    <button onClick={() => setAiMenu((m) => !m)} className={`${TB.base} ${TB.ai}`} title="AI Assist">
                      <Bot size={13} /> AI ▾
                    </button>
                    {aiMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setAiMenu(false)} />
                        <div className="absolute right-0 top-full z-50 mt-1 min-w-44 overflow-hidden rounded-xl border border-violet-400/30 bg-[#1a1a2e] text-white shadow-2xl">
                          <button onClick={aiHints} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-xs font-semibold hover:bg-violet-500/15"><Lightbulb size={13} className="text-amber-400" /> Hints</button>
                          <button onClick={aiAlgo} className="flex w-full items-center gap-2 border-t border-white/10 px-3.5 py-2.5 text-left text-xs font-semibold hover:bg-violet-500/15"><Network size={13} className="text-sky-400" /> Algorithm</button>
                          <button onClick={aiOptimal} className="flex w-full items-center gap-2 border-t border-white/10 px-3.5 py-2.5 text-left text-xs font-semibold hover:bg-violet-500/15"><Code2 size={13} className="text-emerald-400" /> Optimal Solution</button>
                        </div>
                      </>
                    )}
                  </div>
                  <button onClick={() => { setBottomOpen((b) => !b); setTimeout(() => editor.current?.layout(), 60); }} className={`${TB.base} ${TB.panel}`} title="Toggle Bottom Panel">
                    {bottomOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />} {bottomOpen ? "Hide Panel" : "Show Panel"}
                  </button>
                  <button onClick={toggleTheme} className={`${TB.base} ${TB.mode}`} title="Toggle Dark/Light Mode">{L ? <Sun size={13} /> : <Moon size={13} />} {L ? "Light" : "Dark"}</button>
                  {/* Run — green gradient exactly like desktop */}
                  <button onClick={run} disabled={!!busy}
                    className={`${TB.base} ${TB.run} font-bold disabled:opacity-60`}>
                    <Play size={12} fill="currentColor" /> {busy === "run" ? "Running..." : "Run"}
                  </button>
                  {/* Submit — violet gradient exactly like desktop */}
                  <button onClick={submit} disabled={!!busy}
                    className={`${TB.base} ${TB.submit} disabled:opacity-60`}>
                    <Send size={12} /> {busy === "submit" ? "Testing..." : "Submit"}
                  </button>
                </div>
              </div>

              {/* AI panel */}
              {aiPanel && (
                <div className="absolute right-2 top-12 z-40 max-h-[55vh] w-[380px] max-w-[92%] overflow-y-auto rounded-xl border border-violet-400/30 bg-[#12101f] p-4 text-white shadow-2xl">
                  <div className="mb-3 flex items-center justify-between"><b className="text-sm">{aiPanel.title}</b><button onClick={() => setAiPanel(null)} className="rounded-full bg-white/10 p-1"><X size={12} /></button></div>
                  {aiPanel.body}
                </div>
              )}

              {/* Monaco */}
              <div className={`m-2 mt-0 flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-xl border ${L ? "border-[#dee2e6]" : "border-white/10"}`}>
                <div className={`flex items-center justify-between border-b px-3.5 py-2 ${c.head} ${c.border}`}>
                  <span className={`flex items-center gap-1.5 text-xs font-semibold ${c.muted}`}><Code2 size={12} /> {filenameFromTitle(p.title, langOf(lang).extension)}</span>
                  <span className={`text-[0.72rem] opacity-60 ${c.muted}`}>{cursor}</span>
                </div>
                <div className="min-h-0 flex-1">
                  <MonacoEditor ref={editor} value={docValue} resetKey={docKey} language={lang} theme={theme} onChange={onCode} onCursor={(l, col) => setCursor(`Ln ${l}, Col ${col}`)} />
                </div>
              </div>

              {/* Bottom panels */}
              {bottomOpen && (
                <div className="max-h-[45%] min-h-[160px] flex-none space-y-2 overflow-y-auto px-2 pb-2">
                  <div className={`overflow-hidden rounded-xl border ${c.card}`}>
                    <button onClick={() => setInputOpen((o) => !o)} className="flex w-full items-center justify-between px-3 py-2 text-xs font-bold"><span className="flex items-center gap-1.5"><Terminal size={12} /> Custom Input</span><span>{inputOpen ? "▼" : "▶"}</span></button>
                    {inputOpen && <textarea value={stdin} onChange={(e) => setStdin(e.target.value)} rows={3} placeholder="Enter all input in line by line before run" className={`w-full resize-y border-t bg-transparent p-3 font-mono text-xs outline-none ${c.border}`} />}
                  </div>
                  <div className={`overflow-hidden rounded-xl border ${c.card}`}>
                    <div className={`flex items-center justify-between border-b px-3 py-2 text-xs font-bold ${c.border}`}><span className="flex items-center gap-1.5"><Terminal size={12} /> Output</span><button onClick={() => setOut([])} className="rounded-md border border-red-500/20 bg-red-500/10 px-2.5 py-[3px] text-[0.7rem] font-semibold text-red-500 hover:bg-red-500/20">Clear</button></div>
                    <div className="p-3 text-sm">
                      {out.length === 0 ? <span className={`italic ${c.muted}`}>Run your code to see output...</span> : out.map((l, i) => <OutLine key={i} l={l} />)}
                      {out.some((l) => l.kind === "node") && !busy && !p.id.startsWith("my-") && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button onClick={() => setSolOpen(true)} className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-400">🏆 View Best Solution</button>
                          <button onClick={() => setBoard({ id: p.id, title: p.title })} className="rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-xs font-bold text-violet-300">🏆 Leaderboard</button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={`overflow-hidden rounded-xl border ${c.card}`}>
                    <div className={`flex items-center gap-1.5 border-b px-3 py-2 text-xs font-bold ${c.border} ${c.muted}`}><History size={12} /> Submission History</div>
                    <div className="max-h-28 space-y-1 overflow-y-auto p-2">
                      {history.length === 0 ? <span className={`text-xs italic ${c.muted}`}>No submissions yet.</span> : history.map((s, i) => <HistoryRow key={i} s={s} c={c} />)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {addOpen && <AddProblemModal onClose={() => setAddOpen(false)} onAdd={addProblem} />}
      {solOpen && p && <BestSolutionModal problem={p} solution={solution} userCx={userCx} onLoaded={setSolution} onClose={() => setSolOpen(false)} />}
      {board && <ProblemBoardModal id={board.id} title={board.title} onClose={() => setBoard(null)} />}
      {confirmDel && (
        <Shell title="Delete problem?" onClose={() => setConfirmDel(null)}>
          <p className="text-sm text-white/70">&quot;{confirmDel.title}&quot; and its saved code will be removed from this browser.</p>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setConfirmDel(null)} className="rounded-lg border border-white/15 px-4 py-2 text-sm">Cancel</button>
            <button onClick={() => deleteProblem(confirmDel)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold">Delete</button>
          </div>
        </Shell>
      )}
    </div>
  );
}

/* ───────────── small pieces ───────────── */
type C = Record<string, string>;

function DiffPill({ d }: { d: string }) {
  const col = DIFF_COLORS[d] || "#f59e0b";
  return <span className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: `${col}20`, color: col, border: `1px solid ${col}40` }}>{d}</span>;
}
function FmtBox({ label, text, c }: { label: string; text: string; c: C }) {
  return <div className={`flex-1 rounded-xl border p-3 ${c.card}`}><div className={`mb-1.5 text-[10px] font-bold uppercase tracking-wide ${c.muted}`}>{label}</div><pre className="m-0 whitespace-pre-wrap text-xs opacity-85">{text}</pre></div>;
}
function OutLine({ l }: { l: Line }) {
  if (l.kind === "node") return <>{l.node}</>;
  if (l.kind === "pre") return <pre className="whitespace-pre-wrap rounded-md bg-black/40 p-2 font-mono text-xs text-white/90">{l.text}</pre>;
  if (l.kind === "errpre") return <pre className="whitespace-pre-wrap rounded-md bg-red-500/10 p-2 font-mono text-xs text-red-300">{l.text}</pre>;
  const cls = { info: "text-white/60", ok: "inline-block rounded bg-emerald-400/15 px-2 py-0.5 text-xs font-bold text-emerald-400 mb-2", err: "inline-block rounded bg-red-400/15 px-2 py-0.5 text-xs font-bold text-red-400 mb-2", warn: "inline-block rounded bg-amber-400/15 px-2 py-0.5 text-xs font-bold text-amber-300" }[l.kind];
  return <div><span className={cls}>{l.text}</span></div>;
}
function TcResults({ passed, message, results, total }: { passed: boolean; message?: string; results: any[]; total: number }) {
  return (
    <div>
      <div className={`mb-2 rounded-lg px-3 py-2 text-sm font-bold ${passed ? "bg-emerald-400/15 text-emerald-400" : "bg-red-400/15 text-red-400"}`}>
        {passed ? `✅ Accepted — All ${total} Test Cases Passed!` : `❌ ${message || "Some test cases failed."}`}
      </div>
      <div className="space-y-1.5">
        {results.map((r) => (
          <div key={r.test_case} className={`rounded-lg border p-2 text-xs ${r.passed ? "border-emerald-400/30" : "border-red-400/30"}`}>
            <div className="font-semibold">{r.passed ? "✅" : "❌"} Test Case {r.test_case}{r.time ? <span className="text-white/40"> ({r.time}s)</span> : null}</div>
            {!r.passed && (r.is_hidden
              ? <div className="text-white/50">Hidden test case</div>
              : <div className="mt-1 space-y-0.5 font-mono"><div><b>Input:</b> {r.input}</div><div><b>Expected:</b> {r.expected}</div><div><b>Got:</b> {r.actual}</div></div>)}
          </div>
        ))}
      </div>
    </div>
  );
}
function HistoryRow({ s, c }: { s: Submission; c: C }) {
  const map: Record<string, [string, string, string]> = {
    accepted: ["✅", "#22c55e", "Accepted"], wrong_answer: ["❌", "#ef4444", "Wrong Answer"], time_limit: ["⏱", "#f59e0b", "Time Limit"],
    runtime_error: ["💥", "#ef4444", "Runtime Error"], compilation_error: ["🔴", "#ef4444", "Compilation Error"],
  };
  const [icon, color, text] = s.passed ? map.accepted : map[s.status] || ["⏳", "#94a3b8", s.status || "submitted"];
  return (
    <div className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 ${c.card}`}>
      <span className="text-xs font-bold" style={{ color }}>{icon} {text}</span>
      <span className={`flex items-center gap-2 text-[11px] ${c.muted}`}>
        <span className="rounded bg-violet-500/10 px-1.5 text-[10px] font-bold text-violet-300">{(s.language || "?").toUpperCase()}</span>
        {s.passedCount !== undefined && <span>{s.passedCount}/{s.totalCount}</span>}
        <span>{timeAgo(s.createdAt)}</span>
      </span>
    </div>
  );
}

function ScoreTab({ who, tick, c, onRank }: { who: string; tick: number; c: C; onRank: (id: string, title: string) => void }) {
  const s = useMemo(() => getScore(who), [who, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const streak = currentStreak(s);
  const prog = Math.min(streak, 7);
  const totalSubs = Object.values(s.submissionCalendar).reduce((a, b) => a + b, 0);
  const days = Array.from({ length: 49 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (48 - i)); const k = d.toISOString().split("T")[0]; return { k, n: s.submissionCalendar[k] || 0 }; });
  const solved = [...s.solvedProblems].sort((a, b) => +new Date(b.solvedAt) - +new Date(a.solvedAt));
  return (
    <div className="space-y-3 p-1">
      <div className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/15 to-pink-500/10 p-4 text-center">
        <div className="text-3xl font-extrabold">{s.totalPoints}</div>
        <div className="mb-2 text-xs font-semibold text-violet-300">Total Points</div>
        <div className="text-sm font-bold text-amber-300">🪙 {s.totalCoins} coins earned</div>
      </div>
      <div className="rounded-xl border border-amber-400/15 bg-amber-400/5 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold text-amber-300">🔥 Current Streak: {streak} day{streak !== 1 ? "s" : ""}</span>
          {streak >= 7 ? <span className="rounded-lg bg-emerald-400/15 px-2 text-[10px] font-bold text-emerald-400">✅ Streak Active!</span> : <span className="text-[10px] text-slate-400">{7 - prog} more to bonus</span>}
        </div>
        <div className="flex gap-1">{Array.from({ length: 7 }, (_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i < prog ? "bg-amber-400" : "bg-white/10"}`} />)}</div>
        <div className="mt-1.5 text-[10px] text-slate-400">Complete 7 consecutive days → +10 bonus coins 🪙</div>
      </div>
      <div className={`rounded-xl border p-3 ${c.card}`}>
        <div className="mb-2 text-xs font-bold">{totalSubs} Submissions in {new Date().getFullYear()}</div>
        <div className="grid grid-cols-7 gap-0.5">{days.map((d) => <div key={d.k} title={`${d.k}: ${d.n} submissions`} className="aspect-square rounded-sm" style={{ background: `rgba(34,197,94,${d.n === 0 ? 0.1 : d.n === 1 ? 0.4 : d.n === 2 ? 0.6 : 0.9})` }} />)}</div>
      </div>
      {solved.length === 0 ? (
        <div className={`p-8 text-center ${c.muted}`}><div className="mb-2 text-2xl">📊</div><div className="text-sm">No problems solved yet.<br />Start solving to earn points!</div></div>
      ) : (
        <>
          <div className={`px-2 text-xs font-bold ${c.muted}`}>Solved Problems ({solved.length})</div>
          {solved.map((x) => (
            <div key={x.problemId} className={`rounded-xl border p-2.5 ${c.card}`}>
              <div className="mb-1 flex items-center justify-between gap-2"><span className="truncate text-sm font-bold">✅ {x.title}</span><DiffPill d={x.difficulty} /></div>
              <div className="flex items-center justify-between">
                <div className={`flex gap-2.5 text-[11px] ${c.muted}`}>
                  <span className="font-semibold text-violet-300">+{x.points}pts</span><span className="font-semibold text-amber-300">+{x.coins}🪙</span>
                  <span>{(x.language || "").toUpperCase()}</span><span>{new Date(x.solvedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
                {!x.problemId.startsWith("my-") && <button onClick={() => onRank(x.problemId, x.title)} className="rounded-md border border-violet-400/25 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-300">🏆 Rank</button>}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function Shell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <div className={`max-h-[80vh] w-full overflow-y-auto rounded-2xl border border-violet-400/30 bg-[#1a1a2e] p-6 text-white ${wide ? "max-w-2xl" : "max-w-md"}`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold">{title}</h3><button onClick={onClose} className="rounded-full bg-white/10 p-1.5"><X size={14} /></button></div>
        {children}
      </div>
    </div>
  );
}

function AddProblemModal({ onClose, onAdd }: { onClose: () => void; onAdd: (p: Problem) => void }) {
  const [title, setTitle] = useState(""); const [desc, setDesc] = useState("");
  const [cat, setCat] = useState(CATEGORIES[0]); const [diff, setDiff] = useState("easy"); const [lang, setLang] = useState("java");
  const [tin, setTin] = useState(""); const [tout, setTout] = useState(""); const [err, setErr] = useState("");
  const f = "rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400";
  const save = () => {
    if (!title.trim() || !desc.trim()) { setErr("⚠ Title and Description are required."); return; }
    onAdd({
      id: `my-${Date.now()}`, title: title.trim(), description: desc.trim(), category: cat, difficulty: diff,
      defaultLanguage: lang, lockedLanguage: true, starterCode: { [lang]: getDefaultStarter(lang) },
      testCases: tin && tout.trim() ? [{ input: tin, expectedOutput: tout.trim(), isHidden: false }] : [], hints: [],
    });
  };
  return (
    <Shell title="➕ Add Custom Problem" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Problem Title" className={f} />
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Problem Description" rows={3} className={`${f} resize-y`} />
        <div className="flex gap-2">
          <select value={cat} onChange={(e) => setCat(e.target.value)} className={`${f} flex-1 bg-[#1a1a2e]`}>{CATEGORIES.map((x) => <option key={x}>{x}</option>)}</select>
          <select value={diff} onChange={(e) => setDiff(e.target.value)} className={`${f} flex-1 bg-[#1a1a2e]`}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select>
        </div>
        <div className="text-xs font-semibold text-white/50">Language (locked for this problem):</div>
        <select value={lang} onChange={(e) => setLang(e.target.value)} className={`${f} bg-[#1a1a2e]`}>{CODING_LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.icon} {l.label}</option>)}</select>
        <div className="text-xs font-semibold text-white/50">Test Cases:</div>
        <div className="flex gap-2">
          <input value={tin} onChange={(e) => setTin(e.target.value)} placeholder="Input (e.g. 5 3)" className={`${f} flex-1`} />
          <input value={tout} onChange={(e) => setTout(e.target.value)} placeholder="Expected Output (e.g. 8)" className={`${f} flex-1`} />
        </div>
        {err && <div className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-400">{err}</div>}
        <button onClick={save} className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 py-3 text-sm font-bold">Add Problem</button>
      </div>
    </Shell>
  );
}

function BestSolutionModal({ problem, solution, userCx, onLoaded, onClose }: { problem: Problem; solution: any; userCx: { tc: string; sc: string } | null; onLoaded: (s: any) => void; onClose: () => void }) {
  const [s, setS] = useState<any>(solution);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (s) return;
    api(`/api/coding-problems/best-solution?problemId=${encodeURIComponent(problem.id)}`)
      .then((d) => { if (d?.solution) { setS(d.solution); onLoaded(d.solution); } else setErr("Best solution not available for this problem yet."); })
      .catch(() => setErr("Could not load best solution."));
  }, [s, problem.id, onLoaded]);
  const langs = ["c", "java", "python", "javascript"].filter((l) => s?.[l]?.code);
  const [tab, setTab] = useState<string>("");
  const cur = langs.length ? s[tab || (langs.includes(s?.language) ? s.language : langs[0])] : s;
  const activeTab = tab || (langs.includes(s?.language) ? s.language : langs[0]);
  return (
    <Shell title={`🏆 Best Solution — ${problem.title}`} onClose={onClose} wide>
      {!s && !err && <div className="text-white/50">Loading…</div>}
      {err && <div className="text-amber-300">{err}</div>}
      {s && (
        <>
          {langs.length > 0 && (
            <div className="mb-3 flex gap-1 border-b border-white/10 pb-2">
              {langs.map((l) => <button key={l} onClick={() => setTab(l)} className={`rounded-md border px-3 py-1 text-xs font-bold ${l === activeTab ? "border-violet-400/50 bg-violet-500/20 text-violet-300" : "border-white/10 text-slate-400"}`}>{l.toUpperCase()}</button>)}
            </div>
          )}
          {cur && (
            <>
              <div className="mb-3 flex flex-wrap gap-2 text-xs font-bold">
                <span className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-emerald-400">⏱ Best TC: {cur.timeComplexity || cur.tc || "?"}</span>
                <span className="rounded-md border border-sky-400/20 bg-sky-400/10 px-2 py-1 text-sky-300">💾 Best SC: {cur.spaceComplexity || cur.sc || "?"}</span>
                {userCx && <><span className="rounded-md border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-amber-300">👤 Your TC: {userCx.tc}</span><span className="rounded-md border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-amber-300">👤 Your SC: {userCx.sc}</span></>}
              </div>
              <pre className="mb-3 overflow-x-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-[#0d0b1e] p-4 font-mono text-xs text-slate-200">{cur.code}</pre>
              {cur.explanation && <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/5 p-3 text-sm"><div className="mb-1 text-[11px] font-bold uppercase text-emerald-400">Explanation</div><div className="text-white/80">{cur.explanation}</div></div>}
            </>
          )}
        </>
      )}
    </Shell>
  );
}

function ProblemBoardModal({ id, title, onClose }: { id: string; title: string; onClose: () => void }) {
  const [d, setD] = useState<{ leaderboard: { rank: number; name: string; coins: number }[]; totalParticipants: number } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api(`/api/coding-problems/leaderboard?problemId=${encodeURIComponent(id)}`).then(setD).catch(() => setErr("Could not load leaderboard."));
  }, [id]);
  return (
    <Shell title={`🏆 Leaderboard — ${title}`} onClose={onClose}>
      {err && <div className="text-amber-300">{err}</div>}
      {!d && !err && <div className="text-white/50">Loading…</div>}
      {d && (
        <>
          <div className="mb-3 text-xs text-slate-400">{d.totalParticipants || 0} participants</div>
          {d.leaderboard.length === 0 ? <div className="py-8 text-center text-slate-400">No submissions yet. Be the first!</div> : d.leaderboard.map((e) => (
            <div key={e.rank} className="mb-1 flex items-center rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
              <span className="w-10 text-sm font-extrabold" style={{ color: e.rank <= 3 ? "#fbbf24" : e.rank <= 20 ? "#22c55e" : e.rank <= 50 ? "#60a5fa" : "#94a3b8" }}>#{e.rank}</span>
              <span className="flex-1 text-sm font-semibold">{e.name}</span>
              {e.coins > 0 && <span className="text-xs font-bold text-amber-300">+{e.coins}🪙</span>}
            </div>
          ))}
        </>
      )}
    </Shell>
  );
}

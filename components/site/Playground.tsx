"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getToken } from "@/services/auth";
import { exampleFor } from "@/app/lib/tutorials";

type Lang = "python" | "java" | "c" | "javascript";

// Language ids understood by POST /api/code/run.
const LANGS: { id: Lang; label: string; emoji: string; runId: number; file: string; starter: string }[] = [
  { id: "python", label: "Python", emoji: "🐍", runId: 71, file: "main.py", starter: 'name = input("What is your name? ")\nprint("Hello,", name, "👋")\n' },
  { id: "java", label: "Java", emoji: "☕", runId: 62, file: "Main.java", starter: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, CodingKida!");\n    }\n}\n' },
  { id: "c", label: "C", emoji: "🔧", runId: 50, file: "main.c", starter: '#include <stdio.h>\n\nint main() {\n    printf("Hello, CodingKida!\\n");\n    return 0;\n}\n' },
  { id: "javascript", label: "JavaScript", emoji: "🌐", runId: 63, file: "main.js", starter: 'const friends = ["Riya", "Kabir"];\nfor (const f of friends) console.log("Hi " + f);\n' },
];

const STORE = "ck_playground_v1";

interface RunResult { ok: boolean; out: string; err: string; status: string; time?: string | null }

export default function Playground() {
  const params = useSearchParams();
  const [lang, setLang] = useState<Lang>("python");
  const [code, setCode] = useState(LANGS[0].starter);
  const [stdin, setStdin] = useState("");
  const [title, setTitle] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  // Load: tutorial example (?example=python/loops) first, else the last saved code.
  useEffect(() => {
    setLoggedIn(!!getToken());
    const ex = exampleFor(params.get("example"));
    if (ex) {
      setLang(ex.lang as Lang);
      setCode(ex.code);
      setTitle(ex.title);
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || "null");
      if (saved?.lang && typeof saved.code === "string") { setLang(saved.lang); setCode(saved.code); }
    } catch { /* ignore */ }
  }, [params]);

  // Save as you type.
  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify({ lang, code })); } catch { /* ignore */ }
  }, [lang, code]);

  const meta = LANGS.find((l) => l.id === lang)!;
  const lineCount = code.split("\n").length;

  const switchLang = (id: Lang) => {
    if (id === lang) return;
    const next = LANGS.find((l) => l.id === id)!;
    setLang(id);
    setCode(next.starter);
    setTitle(null);
    setResult(null);
  };

  // Tab key inserts 4 spaces instead of leaving the editor.
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.currentTarget;
      const { selectionStart: s, selectionEnd: end } = el;
      const nextCode = code.slice(0, s) + "    " + code.slice(end);
      setCode(nextCode);
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 4; });
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); }
  };

  const run = async () => {
    const token = getToken();
    if (!token) { setLoggedIn(false); return; }
    if (!code.trim() || running) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/code/run", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ source_code: code, language_id: meta.runId, stdin }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) { setLoggedIn(false); setResult(null); return; }
      if (!res.ok || !data.success) {
        setResult({ ok: false, out: "", err: data.message || "Could not run the code. Please try again.", status: "error" });
        return;
      }
      const err = [data.compile_output, data.stderr].filter(Boolean).join("\n");
      setResult({ ok: !err && data.status !== "runtime_error" && data.status !== "compilation_error", out: data.stdout || "", err, status: data.status_description || data.status, time: data.time });
    } catch {
      setResult({ ok: false, out: "", err: "Network problem. Check your internet and try again.", status: "error" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="px-4 md:px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-5xl font-black">Code playground 🧪</h1>
            <p className="mt-2 text-[#4B5563]">
              {title ? <>Example: <b>{title}</b>. Change it and press Run!</> : "Write code, press Run, see what happens."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {LANGS.map((l) => (
              <button
                key={l.id}
                onClick={() => switchLang(l.id)}
                className={`rounded-full px-4 py-2 font-extrabold border-2 ${lang === l.id ? "bg-[#7C3AED] border-[#7C3AED] text-white" : "bg-white border-[#E5E7EB] hover:border-[#C4B5FD]"}`}
              >
                {l.emoji} {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Editor */}
          <div className="lg:col-span-3 rounded-[24px] overflow-hidden border-4 border-white shadow-xl bg-[#1E1B4B]">
            <div className="flex items-center gap-2 px-4 py-3 bg-[#16133A]">
              <span className="w-3 h-3 rounded-full bg-[#EF4444]" /><span className="w-3 h-3 rounded-full bg-[#FFB020]" /><span className="w-3 h-3 rounded-full bg-[#22C55E]" />
              <span className="ml-3 text-xs font-bold text-white/70">{meta.file}</span>
              <button onClick={() => { setCode(meta.starter); setTitle(null); setResult(null); }} className="ml-auto text-xs font-bold text-white/70 hover:text-white">↺ Reset</button>
            </div>
            <div className="flex h-[420px] md:h-[480px]">
              <div ref={gutterRef} aria-hidden className="select-none overflow-hidden py-4 pl-3 pr-2 text-right font-mono text-sm leading-6 text-white/30">
                {Array.from({ length: lineCount }, (_, i) => <div key={i}>{i + 1}</div>)}
              </div>
              <textarea
                ref={editorRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={onKeyDown}
                onScroll={(e) => { if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop; }}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                aria-label="Code editor"
                className="flex-1 resize-none bg-transparent py-4 pr-4 font-mono text-sm leading-6 text-white outline-none whitespace-pre overflow-auto"
              />
            </div>
          </div>

          {/* Input + output */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <button
              onClick={run}
              disabled={running}
              className="rounded-2xl bg-[#22C55E] px-6 py-4 text-xl font-black text-white border-b-[6px] border-[#15803D] hover:brightness-110 active:translate-y-0.5 disabled:opacity-60 transition-all"
            >
              {running ? "Running… ⏳" : "▶ Run code"}
            </button>
            <p className="-mt-2 text-center text-xs font-bold text-[#6B7280]">Shortcut: Ctrl + Enter</p>

            {loggedIn === false && (
              <div className="rounded-[20px] bg-[#FFF7E6] border-2 border-[#FDE68A] p-5">
                <p className="font-black">🔐 Log in to run code</p>
                <p className="mt-1 text-sm text-[#4B5563]">Running code is free for CodingKida students. It only takes a minute to make an account.</p>
                <div className="mt-3 flex gap-3">
                  <Link href="/login?redirect=/playground" className="rounded-xl bg-[#7C3AED] px-4 py-2 font-black text-white">Log in</Link>
                  <Link href="/login?mode=signup" className="rounded-xl bg-white px-4 py-2 font-black text-[#6D28D9] border-2 border-[#DDD6FE]">Sign up free</Link>
                </div>
              </div>
            )}

            <label className="rounded-[20px] bg-white border-2 border-[#E5E7EB] p-4">
              <span className="text-sm font-black text-[#6B7280]">⌨️ Input (for input() / scanf)</span>
              <textarea
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                rows={3}
                placeholder="Type input here, one value per line"
                className="mt-2 w-full resize-none rounded-xl bg-[#F9FAFB] p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-[#C4B5FD]"
              />
            </label>

            <div className="flex-1 min-h-[180px] rounded-[20px] bg-[#0F0D2E] p-4 font-mono text-sm">
              <div className="flex items-center justify-between">
                <span className="font-sans text-xs font-black text-white/50">OUTPUT</span>
                {result && (
                  <span className={`font-sans text-xs font-black ${result.ok ? "text-[#86EFAC]" : "text-[#FCA5A5]"}`}>
                    {result.ok ? "✅ Ran successfully" : `⚠️ ${result.status}`}{result.time ? ` · ${result.time}s` : ""}
                  </span>
                )}
              </div>
              {!result && !running && <p className="mt-3 text-white/40">Press Run to see the output here.</p>}
              {running && <p className="mt-3 text-white/60">Running your code…</p>}
              {result?.out && <pre className="mt-3 whitespace-pre-wrap text-[#E5E7EB]">{result.out}</pre>}
              {result?.err && <pre className="mt-3 whitespace-pre-wrap text-[#FCA5A5]">{result.err}</pre>}
              {result && !result.out && !result.err && <p className="mt-3 text-white/50">(No output. Did you forget to print?)</p>}
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { e: "📖", t: "New to coding?", d: "Start with our free tutorials.", href: "/learn", cta: "Open tutorials" },
            { e: "🔥", t: "Weekly challenge", d: "A new problem every Monday.", href: "/weekly-challenge", cta: "See this week" },
            { e: "🏆", t: "Win medals", d: "Solve course exercises to win Coding Gold.", href: "/courses", cta: "See courses" },
          ].map((c) => (
            <Link key={c.t} href={c.href} className="rounded-[20px] bg-white border-2 border-[#EDE9FE] p-5 flex gap-4 hover:-translate-y-0.5 transition-transform">
              <span className="text-3xl">{c.e}</span>
              <span><b className="block">{c.t}</b><span className="text-[#6B7280]">{c.d}</span> <span className="font-black text-[#7C3AED]">{c.cta} →</span></span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

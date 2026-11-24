"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Send } from "lucide-react";
import { api } from "../api";

type Msg = { role: "user" | "codo"; text: string };

const QUICK = [
  "What is a for loop?",
  "How does recursion work?",
  "What is an array?",
  "Explain OOP in simple words",
  "What is Big-O notation?",
  "What's the difference between Python and Java?",
];

/** Codo AI Assistant — kids-friendly, full-width, beautiful chat. */
export default function CodoPage() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [msgs.length]);

  const send = async (q = text) => {
    const question = q.trim();
    if (!question || busy) return;
    setText("");
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setBusy(true);
    try {
      const d = await api("/api/ai-mentor", { method: "POST", json: { question, mode: "general" } });
      setMsgs((m) => [...m, { role: "codo", text: d.answer || "Hmm, I couldn&apos;t find an answer right now. Try asking differently!" }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "codo", text: e instanceof Error ? e.message : "Something went wrong. Please try again!" }]);
    } finally { setBusy(false); }
  };

  const empty = msgs.length === 0;

  return (
    <div className={`-mx-4 md:-mx-6 flex h-[calc(100vh-48px)] flex-col bg-[#07070d]`}>
      {/* Top bar */}
      <div className="flex items-center gap-4 border-b border-violet-400/15 bg-gradient-to-r from-[#0d0b2a] to-[#1a0a3e] px-5 py-4">
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-violet-400/30 bg-gradient-to-br from-sky-400 to-violet-500 shadow-[0_0_16px_rgba(139,92,246,0.4)]">
          <img src="/codo.jpg" alt="Codo" className="h-full w-full object-cover" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold">Codo <span className="text-violet-300">🤖</span></h1>
          <p className="text-xs text-slate-400">Your friendly AI coding buddy · answers instantly from your course material</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Online
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 md:px-8">
        {empty && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border-2 border-violet-400/30 bg-gradient-to-br from-sky-400 to-violet-500 shadow-[0_0_30px_rgba(139,92,246,0.3)]">
              <img src="/codo.jpg" alt="Codo" className="h-full w-full object-cover" />
            </div>
            <h2 className="text-2xl font-extrabold">Hi, I&apos;m Codo! 👋</h2>
            <p className="mt-1 max-w-md text-slate-400">I&apos;m CodingKida&apos;s AI coding buddy. Ask me anything about your lessons, programming concepts, or if you&apos;re stuck on a problem!</p>
            <div className="mt-6 grid max-w-2xl grid-cols-2 gap-2 md:grid-cols-3">
              {QUICK.map((q) => (
                <button key={q} onClick={() => send(q)}
                  className="flex items-center gap-2 rounded-xl border border-violet-400/25 bg-violet-500/10 px-4 py-3 text-left text-sm font-semibold text-slate-300 transition hover:-translate-y-0.5 hover:border-violet-400/50 hover:bg-violet-500/20">
                  <ArrowRight size={12} className="shrink-0 text-violet-400" /> {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {!empty && (
          <div className="mx-auto max-w-3xl space-y-5">
            {msgs.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                {m.role === "codo" && (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-violet-400/30 bg-gradient-to-br from-sky-400 to-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.3)]">
                    <img src="/codo.jpg" alt="Codo" className="h-full w-full object-cover" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${m.role === "user" ? "ml-auto rounded-tr-sm bg-gradient-to-br from-violet-600 to-violet-500 shadow-[0_3px_12px_rgba(139,92,246,0.35)]" : "rounded-tl-sm border border-white/10 bg-[#1a1a2e] text-slate-200"}`}>
                  <div className={`mb-0.5 text-[10px] font-bold ${m.role === "user" ? "text-violet-200/70" : "text-sky-400"}`}>{m.role === "user" ? "You" : "🤖 Codo"}</div>
                  <div className="whitespace-pre-wrap">{m.text}</div>
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-violet-400/30 bg-gradient-to-br from-sky-400 to-violet-500">
                  <img src="/codo.jpg" alt="" className="h-full w-full object-cover" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-white/10 bg-[#1a1a2e] px-5 py-4">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400 [animation-delay:0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400 [animation-delay:0.3s]" />
                </div>
              </div>
            )}
            <div ref={end} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-white/10 bg-[#0e0e18] px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Ask Codo a coding question…"
            disabled={busy}
            className="flex-1 rounded-2xl border border-violet-400/25 bg-[#1a1a2e] px-5 py-3.5 text-sm outline-none transition placeholder:text-slate-500 focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.15)] disabled:opacity-50"
          />
          <button
            onClick={() => send()}
            disabled={busy || !text.trim()}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-[0_3px_14px_rgba(139,92,246,0.5)] transition hover:shadow-[0_5px_20px_rgba(139,92,246,0.7)] hover:brightness-110 disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { api } from "../api";

type Msg = { role: "user" | "codo"; text: string };

/** Codo, the AI buddy (same backend as the apps: POST /api/ai-mentor). */
export default function CodoPage() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "codo", text: "Hi, I'm Codo 🤖 — CodingKida's AI assistant. Ask me anything about your lessons and coding!" },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [msgs.length]);

  const send = async () => {
    const q = text.trim();
    if (!q || busy) return;
    setText(""); setBusy(true);
    setMsgs((m) => [...m, { role: "user", text: q }]);
    try {
      const d = await api("/api/ai-mentor", { method: "POST", json: { question: q, mode: "general" } });
      setMsgs((m) => [...m, { role: "codo", text: d.answer || "Hmm, I could not find an answer. Try asking in a different way." }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "codo", text: e instanceof Error ? e.message : "Something went wrong. Please try again." }]);
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-3xl pt-2">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-indigo-900/40 to-violet-700/30 p-6">
        <h1 className="flex items-center gap-3 text-3xl font-extrabold"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-violet-400 text-2xl">🤖</span> Codo</h1>
        <p className="mt-1 text-white/75">Your friendly AI buddy. Ask me anything about your lessons and coding.</p>
      </div>

      <div className="mt-4 flex h-[60vh] flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : ""}`}>
              <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "bg-violet-600/50" : "border border-white/10 bg-white/5"}`}>{m.text}</div>
            </div>
          ))}
          {busy && <div className="text-sm text-white/50">Codo is thinking…</div>}
          <div ref={end} />
        </div>
        <div className="flex gap-2 border-t border-white/10 bg-black/20 p-4">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask a coding question…"
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-violet-400" />
          <button onClick={send} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-5 text-sm font-bold disabled:opacity-60">Ask <Send size={14} /></button>
        </div>
      </div>
    </div>
  );
}

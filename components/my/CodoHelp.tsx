"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/app/my/api";

type Source = { name: string; fileUrl: string | null; snippet: string };

/**
 * Codo "Stuck? Can I help? 👋" — same two-step help as the desktop app:
 * 1st tap → a gentle hint (never the answer), 2nd tap → the correct answer with
 * simple reasons from the lesson material. Uses POST /api/lesson-help and plays
 * Codo's stored voice when the server returns it.
 */
export default function CodoHelp({ kind, itemId }: { kind: "quiz" | "exercise"; itemId: string }) {
  const [stage, setStage] = useState<"hint" | "answer">("hint");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<{ stage: string; text: string; sources: Source[] }[]>([]);
  const [err, setErr] = useState("");
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => { audio.current?.pause(); }, []);
  useEffect(() => { setStage("hint"); setItems([]); setErr(""); audio.current?.pause(); }, [itemId]);

  const ask = async () => {
    if (busy) return;
    setBusy(true); setErr("");
    audio.current?.pause();
    try {
      const body = kind === "quiz" ? { kind, quizId: itemId, stage } : { kind, exerciseId: itemId, stage };
      const d = await api("/api/lesson-help", { method: "POST", json: body });
      setItems((x) => [...x, { stage, text: d.help || "", sources: Array.isArray(d.sources) ? d.sources : [] }]);
      if (d.audio) {
        const a = new Audio(`data:audio/mpeg;base64,${d.audio}`);
        audio.current = a;
        a.play().catch(() => {});
      }
      if (stage === "hint") setStage("answer");
    } catch (e) { setErr(e instanceof Error ? e.message : "Codo couldn't help right now."); }
    finally { setBusy(false); }
  };

  const done = items.some((i) => i.stage === "answer");
  return (
    <div className="mt-3">
      {!done && (
        <button onClick={ask} disabled={busy} className="group inline-flex h-11 items-center gap-2 rounded-xl border border-sky-400/35 bg-gradient-to-r from-sky-400/10 to-violet-400/10 pl-1.5 pr-4 transition hover:-translate-y-0.5 hover:border-sky-400/70 disabled:opacity-60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/codo.jpg" alt="Codo" className="h-8 w-8 rounded-full object-cover group-hover:animate-bounce" />
          <span className="text-sm font-bold text-sky-300">{busy ? "Codo is thinking…" : stage === "hint" ? "Stuck? Can I help? 👋" : "Show me the answer 💡"}</span>
        </button>
      )}
      {items.map((it, i) => (
        <div key={i} className={`mt-2 rounded-xl border p-3 text-sm ${it.stage === "hint" ? "border-amber-400/25 bg-amber-400/5" : "border-emerald-400/25 bg-emerald-400/5"}`}>
          <div className="mb-1 flex items-center gap-2 text-xs font-bold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/codo.jpg" alt="" className="h-5 w-5 rounded-full" /> {it.stage === "hint" ? "Codo's hint" : "Codo explains the answer"}
            {audio.current && <button onClick={() => { const a = audio.current; if (!a) return; if (a.paused) a.play().catch(() => {}); else a.pause(); }} className="ml-auto rounded bg-white/10 px-2 py-0.5 text-[11px]">🔊 Play / pause</button>}
          </div>
          <div className="whitespace-pre-wrap leading-relaxed">{it.text}</div>
          {it.sources.length > 0 && (
            <div className="mt-2 text-[11px] text-slate-400">📚 From your course material: {it.sources.map((s) => s.name).filter(Boolean).join(", ")}</div>
          )}
        </div>
      ))}
      {err && <div className="mt-2 text-sm text-amber-300">{err}</div>}
    </div>
  );
}

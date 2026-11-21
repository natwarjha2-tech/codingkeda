"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { api } from "@/app/my/api";
import { useMy } from "@/app/my/MyContext";
import { getToken } from "@/services/auth";
import { Card } from "./QuizTab";

type Msg = { id: string; senderId: string; senderRole: string; senderName: string; text: string; createdAt: string };

/**
 * AskNow tab: the lesson's shared Q&A. Codo (AI) answers instantly; students
 * can ask a human expert (the instructor) with "Connect with our Expert".
 * New messages arrive live over SSE (/api/lesson-chat/stream), like the desktop;
 * if the stream can't connect it falls back to refreshing every 5 seconds.
 */
export default function AskTab({ lessonId }: { lessonId: string }) {
  const { user } = useMy();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const [asking, setAsking] = useState(false);
  const [live, setLive] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const merge = useCallback((list: Msg[]) => {
    setMsgs((cur) => {
      const map = new Map(cur.map((m) => [m.id, m]));
      list.forEach((m) => map.set(m.id, m));
      return [...map.values()].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    });
  }, []);

  const load = useCallback(() => {
    api(`/api/lesson-chat?lessonId=${encodeURIComponent(lessonId)}`)
      .then((d) => { merge(d.messages || []); setLoaded(true); })
      .catch((e) => { setErr(e.message || "Could not load the discussion."); setLoaded(true); });
  }, [lessonId, merge]);

  useEffect(() => {
    setMsgs([]); setLoaded(false); setErr(""); setLive(false);
    load();
    let poll: ReturnType<typeof setInterval> | null = null;
    let es: EventSource | null = null;
    const token = getToken();
    const startPoll = () => { if (!poll) poll = setInterval(load, 5000); };
    if (token && typeof EventSource !== "undefined") {
      es = new EventSource(`/api/lesson-chat/stream?lessonId=${encodeURIComponent(lessonId)}&token=${encodeURIComponent(token)}`);
      es.addEventListener("ready", () => setLive(true));
      es.addEventListener("message", (ev) => { try { merge([JSON.parse((ev as MessageEvent).data)]); } catch { /* ignore */ } });
      es.onerror = () => { setLive(false); es?.close(); es = null; startPoll(); };
    } else startPoll();
    return () => { es?.close(); if (poll) clearInterval(poll); };
  }, [lessonId, load, merge]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest" }); }, [msgs.length]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true); setErr("");
    try {
      const d = await api("/api/lesson-chat", { method: "POST", json: { lessonId, text: t } });
      setText("");
      if (d.message) merge([d.message]);
      // Codo's reply is posted by the server a moment later; the stream (or poll) brings it in.
      if (!live) setTimeout(load, 2500);
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not send."); }
    finally { setSending(false); }
  };

  const askExpert = async () => {
    if (!window.confirm("Ask a CodingKida expert (your instructor) to help with this lesson?")) return;
    setAsking(true); setErr("");
    try { const d = await api("/api/lesson-chat/escalate", { method: "POST", json: { lessonId } }); if (d.message) merge([d.message]); }
    catch (e) { setErr(e instanceof Error ? e.message : "Could not reach an expert right now."); }
    finally { setAsking(false); }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-extrabold">AskNow {live && <span className="ml-1 align-middle text-[10px] font-bold text-emerald-400">● live</span>}</h3>
        <button onClick={askExpert} disabled={asking} className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-400/20 disabled:opacity-60">👩‍🏫 Connect with our Expert</button>
      </div>
      <div className="mt-3 max-h-80 min-h-32 space-y-3 overflow-y-auto pr-1">
        {!loaded && <div className="py-6 text-center text-sm text-white/50">Loading discussion…</div>}
        {loaded && msgs.length === 0 && !err && (
          <div className="py-6 text-center text-sm text-white/50">Ask a question about this lesson. Codo answers instantly from your course material, and your instructor can add more. Everyone enrolled can see the discussion.</div>
        )}
        {msgs.map((m) => {
          const ai = m.senderRole === "ai";
          const teacher = m.senderRole === "instructor";
          const mine = !ai && !teacher && (m.senderId === user?.id || m.senderName === user?.name);
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : ""}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${ai ? "border border-sky-400/25 bg-sky-400/10" : teacher ? "border border-amber-400/25 bg-amber-400/10" : mine ? "bg-violet-600/40" : "bg-white/5"}`}>
                <div className="mb-0.5 text-[11px] font-bold text-white/60">{ai ? "🤖 Codo" : teacher ? `👩‍🏫 ${m.senderName} (Instructor)` : m.senderName}</div>
                <div className="whitespace-pre-wrap">{m.text}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      {err && <div className="mt-2 text-sm text-amber-300">{err}</div>}
      <div className="mt-3 flex gap-2 border-t border-white/10 pt-3">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask Codo a question about this lesson…"
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-violet-400" />
        <button onClick={send} disabled={sending} className="rounded-xl bg-violet-600 px-4 hover:bg-violet-500 disabled:opacity-60" aria-label="Send"><Send size={16} /></button>
      </div>
    </Card>
  );
}

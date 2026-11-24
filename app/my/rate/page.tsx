"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useMy } from "../MyContext";
import { PageHeader, Panel, Stars } from "@/components/my/ui";

type Review = { rating: number; feedback: string; createdAt: string; studentName: string };
type Data = { avgRating: number; totalReviews: number; ratingCounts: Record<string, number>; reviews: Review[] };

const META: Record<number, { label: string; emoji: string; color: string }> = {
  1: { label: "Very Poor", emoji: "😞", color: "#ef4444" },
  2: { label: "Needs Improvement", emoji: "😕", color: "#f97316" },
  3: { label: "Average", emoji: "🙂", color: "#f59e0b" },
  4: { label: "Good", emoji: "😊", color: "#a78bfa" },
  5: { label: "Excellent", emoji: "🤩", color: "#22c55e" },
};

export default function RatePage() {
  const { user } = useMy();
  const [stars, setStars] = useState(0);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [d, setD] = useState<Data | null>(null);
  const me = (user?.email || "").split("@")[0].toLowerCase();

  const load = useCallback(() => {
    api("/api/feedback/lesson?lessonId=app_rating").then((x: Data) => {
      setD(x);
      const mine = (x.reviews || []).find((r) => r.studentName?.toLowerCase() === me);
      if (mine) { setStars((s) => s || mine.rating); setText((t) => t || mine.feedback || ""); }
    }).catch(() => {});
  }, [me]);
  useEffect(load, [load]);

  const mine = d?.reviews?.find((r) => r.studentName?.toLowerCase() === me);
  const submit = async () => {
    if (!stars) { setMsg({ ok: false, text: "Please select a rating" }); return; }
    setBusy(true);
    try {
      await api("/api/feedback", { method: "POST", json: { rating: stars, feedback: text, lessonId: "app_rating", lessonTitle: "App Rating" } });
      setMsg({ ok: true, text: "🎉 Thank you for your feedback!" });
      load();
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not submit." }); }
    finally { setBusy(false); }
  };

  // Latest review per student (newest first), max 8.
  const recent: Review[] = [];
  const seen = new Set<string>();
  for (const r of [...(d?.reviews || [])].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))) {
    if (seen.has(r.studentName)) continue;
    seen.add(r.studentName); recent.push(r);
    if (recent.length >= 8) break;
  }
  const m = META[stars];

  return (
    <div className="mx-auto max-w-6xl space-y-5 pt-2">
      <PageHeader icon="⭐" title="Rate CodingKida" sub="Your feedback helps us make learning better" />
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <Panel>
            <div className="text-lg font-extrabold">How are we doing?</div>
            <div className="text-sm text-slate-400">Tap a star to leave your rating</div>
            <div className="my-4 flex gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} onClick={() => setStars(i)} aria-label={`${i} stars`} className="text-4xl transition hover:scale-110" style={{ color: i <= stars ? META[stars].color : "rgba(255,255,255,0.18)" }}>{i <= stars ? "★" : "☆"}</button>
              ))}
            </div>
            {m && <span className="mb-3 inline-block rounded-full border px-3 py-1 text-sm font-bold" style={{ color: m.color, borderColor: `${m.color}40`, background: `${m.color}1f` }}>{m.label} {m.emoji}</span>}
            <div className="mb-1 text-xs text-slate-400">What did you like? What can we improve? (optional)</div>
            <div className="relative">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Share your experience with CodingKida..." className="w-full resize-none rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none focus:border-violet-400" />
              <span className="absolute bottom-2 right-3 text-[10px] text-slate-500">{text.length}</span>
            </div>
            <div className="mt-2 text-xs text-slate-500">ℹ️ Your review is public and helps other students.</div>
            <button onClick={submit} disabled={busy} className="mt-4 w-full rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 py-3 font-bold disabled:opacity-60">⭐ {mine ? "Update Rating" : "Submit Rating"}</button>
            {msg && <div className={`mt-2 text-sm ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</div>}
          </Panel>
          {mine && <div className="flex items-center gap-3 rounded-2xl border border-violet-400/20 bg-violet-500/5 p-4 text-sm"><span>✏️</span><div className="flex-1"><b>Already rated?</b><div className="text-xs text-slate-400">You can update your rating anytime.</div></div></div>}
        </div>
        <div className="space-y-4">
          <Panel title="Overall Rating">
            {!d || d.totalReviews === 0 ? <div className="text-sm text-slate-400">Be the first to rate CodingKida — your feedback helps other students and helps us improve.</div> : (
              <div className="flex gap-5">
                <div className="text-center"><div className="text-5xl font-extrabold">{d.avgRating}</div><Stars value={d.avgRating} /><div className="text-xs text-slate-500">Based on {d.totalReviews} reviews</div></div>
                <div className="flex-1 space-y-1.5">
                  {[5, 4, 3, 2, 1].map((n) => {
                    const c = d.ratingCounts?.[n] || 0;
                    return <div key={n} className="flex items-center gap-2 text-xs"><span className="w-3">{n}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full" style={{ width: `${d.totalReviews ? (c / d.totalReviews) * 100 : 0}%`, background: META[n].color }} /></div><span className="w-6 text-right text-slate-500">{c}</span></div>;
                  })}
                </div>
              </div>
            )}
          </Panel>
          {recent.length > 0 && (
            <Panel title="Recent Reviews">
              <div className="space-y-3">
                {recent.map((r, i) => (
                  <div key={i} className="rounded-xl bg-white/5 p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/30 text-sm font-bold">{(r.studentName || "?").charAt(0).toUpperCase()}</span>
                      <div className="flex-1"><div className="text-sm font-bold">{r.studentName}</div><div className="text-[11px] text-slate-500">{new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div></div>
                      <span className="text-sm" style={{ color: META[r.rating]?.color }}>{"★".repeat(r.rating)}</span>
                    </div>
                    {r.feedback && <div className="text-sm text-slate-300">{r.feedback}</div>}
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

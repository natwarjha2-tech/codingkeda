"use client";
import { useEffect, useState } from "react";
import { api } from "@/app/my/api";
import { Card } from "./QuizTab";

type Review = { rating: number; feedback: string; createdAt: string; studentName: string };

/** Rate tab: star rating + optional note, and what other students said. */
export default function RateTab({ lessonId, lessonTitle }: { lessonId: string; lessonTitle: string }) {
  const [stars, setStars] = useState(0);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [avg, setAvg] = useState(0);
  const [reviews, setReviews] = useState<Review[]>([]);

  const load = () =>
    api(`/api/feedback/lesson?lessonId=${encodeURIComponent(lessonId)}`)
      .then((d) => { setAvg(d.avgRating || 0); setReviews((d.reviews || []).filter((r: Review) => r.feedback).slice(0, 10)); })
      .catch(() => {});

  useEffect(() => { setStars(0); setText(""); setMsg(""); load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [lessonId]);

  const submit = async () => {
    if (!stars) { setMsg("Please pick a star rating."); return; }
    setBusy(true); setMsg("");
    try {
      await api("/api/feedback", { method: "POST", json: { rating: stars, feedback: text, lessonId, lessonTitle } });
      setMsg("Thank you for your feedback! 💜");
      setText("");
      load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Could not send your rating."); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <h3 className="text-lg font-extrabold">Rate This Lesson</h3>
      <p className="mt-1 text-sm text-white/60">How helpful was this lesson?</p>
      <div className="my-3 flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setStars(n)} className={`text-3xl transition hover:scale-110 ${n <= stars ? "" : "grayscale opacity-40"}`} aria-label={`${n} stars`}>⭐</button>
        ))}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Share your thoughts about this lesson (optional)…" rows={3}
        className="w-full resize-none rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none focus:border-violet-400" />
      <button onClick={submit} disabled={busy} className="mt-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-6 py-2.5 text-sm font-extrabold disabled:opacity-60">Submit</button>
      {msg && <div className="mt-2 text-sm text-white/80">{msg}</div>}

      {reviews.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 text-sm font-bold">Student reviews {avg ? `· ⭐ ${avg}` : ""}</div>
          <div className="space-y-2">
            {reviews.map((r, i) => (
              <div key={i} className="rounded-xl bg-white/5 p-3 text-sm">
                <div className="flex justify-between text-xs text-white/50"><span className="font-bold text-white/80">{r.studentName}</span><span>{"⭐".repeat(r.rating)}</span></div>
                <div className="mt-1">{r.feedback}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

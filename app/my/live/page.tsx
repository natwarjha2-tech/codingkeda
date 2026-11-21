"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "../api";
import { EmptyState, Loading, PageHeader } from "@/components/my/ui";

type LiveClass = { id: string; title: string; status: string; scheduledAt: string | null; durationMinutes: number | null; instructorName: string; courseTitle: string; agenda: string };
type Rec = { id: string; url?: string | null; duration?: number; hlsStatus?: string };
type RecCourse = { courseTitle: string; classes: { classId: string; title: string; endedAt?: string; recordings: Rec[] }[] };

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "Time to be announced");
function countdown(iso: string | null, now: number) {
  if (!iso) return "";
  const s = Math.floor((new Date(iso).getTime() - now) / 1000);
  if (s <= 0) return "Starting soon…";
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `Starts in ${d ? `${d}d ` : ""}${h || d ? `${h}h ` : ""}${m}m ${d ? "" : `${sec}s`}`.trim();
}
const fmtDur = (sec?: number) => (sec && sec > 0 ? `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}` : "");

/** Live Classes (desktop live.js + live-recordings.js) — join classes and watch recordings. */
export default function LivePage() {
  const [tab, setTab] = useState<"classes" | "recordings">("classes");
  const [classes, setClasses] = useState<LiveClass[] | null>(null);
  const [off, setOff] = useState(false);
  const [recs, setRecs] = useState<RecCourse[] | null>(null);
  const [now, setNow] = useState(Date.now());
  const [playing, setPlaying] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    const load = () => api("/api/live/classes/enrolled").then((d) => setClasses(d.classes || [])).catch((e) => { if (e instanceof ApiError && e.status === 503) setOff(true); setClasses([]); });
    load();
    const t = setInterval(load, 30000); // pick up a class going live
    const c = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(t); clearInterval(c); };
  }, []);
  useEffect(() => {
    if (tab !== "recordings" || recs) return;
    api("/api/live/classes/recordings/mine").then((d) => setRecs(d.courses || [])).catch(() => setRecs([]));
  }, [tab, recs]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 pt-2">
      <PageHeader icon="🎥" title="Live Classes" sub="Learn live with your teacher and classmates" back={null}
        right={<div className="flex gap-1 rounded-xl bg-white/5 p-1">
          {(["classes", "recordings"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-1.5 text-sm font-bold ${tab === t ? "bg-violet-600" : "text-slate-400"}`}>{t === "classes" ? "📡 Classes" : "🎞️ Recordings"}</button>)}
        </div>} />

      {tab === "classes" && (!classes ? <Loading /> : off ? <EmptyState icon="📡" title="Live classes are not enabled yet." /> : classes.length === 0 ? (
        <EmptyState icon="📅" title="No live classes scheduled right now" text="Check back soon! You'll get a notification when your teacher schedules one." />
      ) : (
        <div className="space-y-3">
          {classes.map((c) => {
            const live = c.status === "live";
            return (
              <div key={c.id} className={`flex flex-wrap items-center gap-4 rounded-2xl border p-5 ${live ? "border-red-400/40 bg-red-500/5" : "border-white/10 bg-[#161626]/75"}`}>
                <div className="min-w-0 flex-1">
                  <h4 className="flex items-center gap-2 font-extrabold">{live && <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />}{c.title || "Live Class"}</h4>
                  <p className="text-sm text-slate-400">{c.instructorName || "Instructor"}{c.courseTitle ? ` · ${c.courseTitle}` : ""}{!live ? ` · ${when(c.scheduledAt)}${c.durationMinutes ? ` · ${c.durationMinutes} min` : ""}` : ""}</p>
                  {c.agenda && <p className="mt-1 text-sm text-slate-500">{c.agenda}</p>}
                  {!live && c.scheduledAt && <p className="mt-1 text-sm font-semibold text-amber-300">⏰ {countdown(c.scheduledAt, now)}</p>}
                </div>
                {live ? <Link href={`/my/live/${c.id}`} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-extrabold hover:bg-red-500">Join Now →</Link>
                  : <button disabled className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-bold text-slate-400">🕐 Scheduled</button>}
              </div>
            );
          })}
        </div>
      ))}

      {tab === "recordings" && (!recs ? <Loading /> : recs.length === 0 ? <EmptyState icon="🎞️" title="No recordings yet" text="Recorded classes will appear here once available." /> : (
        <div className="space-y-4">
          {recs.map((course, ci) => (
            <div key={ci} className="rounded-2xl border border-white/10 bg-[#161626]/75 p-4">
              <div className="mb-3 font-bold">📁 {course.courseTitle || "Course"}</div>
              {course.classes.filter((c) => c.recordings?.length).map((c) => (
                <div key={c.classId} className="mb-3">
                  <div className="mb-1.5 text-sm font-semibold text-slate-300">🧑‍🏫 {c.title || "Live Class"}{c.endedAt ? <span className="text-slate-500"> · {new Date(c.endedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span> : null}</div>
                  {c.recordings.map((r, ri) => {
                    const label = `Recording${c.recordings.length > 1 ? ` ${ri + 1}` : ""}`;
                    return r.url ? (
                      <button key={r.id} onClick={() => setPlaying({ url: r.url!, title: `${c.title} — ${label}` })} className="mb-1 flex w-full items-center justify-between rounded-xl bg-white/5 px-4 py-2.5 text-left text-sm hover:bg-white/10">
                        <span>▶️ {label}</span><span className="text-xs text-slate-500">{fmtDur(r.duration)}</span>
                      </button>
                    ) : (
                      <div key={r.id} className="mb-1 rounded-xl bg-white/5 px-4 py-2.5 text-sm text-slate-400" title="This recording is being prepared. Please check back in a few minutes.">⏳ {label} · {r.hlsStatus === "ready" ? "Available in the CodingKida app" : "Processing…"}</div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}

      {playing && (
        <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/90 p-4" onClick={() => setPlaying(null)}>
          <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex justify-between"><b className="text-sm">{playing.title}</b><button onClick={() => setPlaying(null)} className="rounded-lg bg-red-500/20 px-3 py-1 text-xs font-bold text-red-300">✕ Close</button></div>
            <video src={playing.url} controls autoPlay playsInline controlsList="nodownload" onContextMenu={(e) => e.preventDefault()} className="aspect-video w-full rounded-xl bg-black" />
          </div>
        </div>
      )}
    </div>
  );
}

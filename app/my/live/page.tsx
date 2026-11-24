"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, Clock, Play, Users, Video } from "lucide-react";
import { api, ApiError } from "../api";

type LiveClass = {
  id: string; title: string; status: string; scheduledAt: string | null;
  durationMinutes: number | null; instructorName: string; courseTitle: string; agenda: string;
};
type Rec = { id: string; url?: string | null; duration?: number; hlsStatus?: string };
type RecCourse = { courseTitle: string; classes: { classId: string; title: string; endedAt?: string; recordings: Rec[] }[] };

const when = (iso: string | null) => iso
  ? new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
  : "Time to be announced";

const fmtDur = (sec?: number) => (!sec || sec <= 0 ? "" : `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`);

function countdown(iso: string | null, now: number) {
  if (!iso) return "";
  const s = Math.floor((new Date(iso).getTime() - now) / 1000);
  if (s <= 0) return "Starting soon…";
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d) return `Starts in ${d}d ${h}h`;
  if (h) return `Starts in ${h}h ${m}m`;
  return `Starts in ${m}m ${s % 60}s`;
}

export default function LivePage() {
  const [tab, setTab] = useState<"classes" | "recordings">("classes");
  const [classes, setClasses] = useState<LiveClass[] | null>(null);
  const [off, setOff] = useState(false);
  const [recs, setRecs] = useState<RecCourse[] | null>(null);
  const [now, setNow] = useState(Date.now());
  const [playing, setPlaying] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    const load = () =>
      api("/api/live/classes/enrolled")
        .then((d) => setClasses(d.classes || []))
        .catch((e) => { if (e instanceof ApiError && e.status === 503) setOff(true); setClasses([]); });
    load();
    const t = setInterval(load, 30_000);
    const c = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(t); clearInterval(c); };
  }, []);

  useEffect(() => {
    if (tab !== "recordings" || recs) return;
    api("/api/live/classes/recordings/mine").then((d) => setRecs(d.courses || [])).catch(() => setRecs([]));
  }, [tab, recs]);

  return (
    <div className="mx-auto w-full max-w-[1400px] pt-2">
      {/* Hero banner */}
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-violet-500/15 bg-gradient-to-br from-[#0d0b2a] to-[#1a0a3e] px-7 py-7">
        <div className="pointer-events-none absolute -right-10 -top-10 h-72 w-72 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-20 h-40 w-40 rounded-full bg-pink-500/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/20"><Video size={18} className="text-red-400" /></span>
              <h1 className="text-2xl font-extrabold md:text-3xl">Live Classes</h1>
            </div>
            <p className="text-slate-400">Learn live with your teacher and classmates 🎓</p>
          </div>
          <div className="flex gap-2 rounded-2xl bg-white/5 p-1.5">
            {(["classes", "recordings"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`rounded-xl px-5 py-2 text-sm font-bold transition ${tab === t ? "bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-[0_2px_10px_rgba(139,92,246,0.4)]" : "text-slate-400 hover:text-white"}`}>
                {t === "classes" ? "📡 Live Classes" : "🎞️ Recordings"}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Classes tab */}
      {tab === "classes" && (
        <>
          {!classes && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="relative">
                <div className="h-14 w-14 animate-spin rounded-full border-4 border-violet-500/30 border-t-violet-500" />
                <Video size={22} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-violet-400" />
              </div>
              <p className="text-slate-400">Loading your live classes…</p>
            </div>
          )}
          {off && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] py-20 text-center">
              <div className="text-6xl">📡</div>
              <h3 className="mt-3 text-xl font-extrabold">Live classes not enabled yet</h3>
              <p className="mt-1 text-slate-400">Your teacher hasn&apos;t set up live classes. Check back soon!</p>
            </div>
          )}
          {classes && !off && classes.length === 0 && (
            <div className="relative overflow-hidden rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-600/10 to-pink-500/5 py-16 text-center">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_80%,rgba(139,92,246,0.08),transparent_60%)]" />
              <div className="relative">
                <div className="mb-3 text-6xl">📅</div>
                <h3 className="text-xl font-extrabold">No live classes scheduled</h3>
                <p className="mx-auto mt-2 max-w-sm text-slate-400">Your teacher will notify you when the next class is ready. Check back soon!</p>
                <Link href="/my/courses" className="mt-5 inline-block rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-6 py-3 text-sm font-bold">Keep learning in the meantime →</Link>
              </div>
            </div>
          )}
          {classes && classes.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {classes.map((c) => {
                const live = c.status === "live";
                return (
                  <div key={c.id} className={`group relative overflow-hidden rounded-2xl border bg-[#161626]/90 p-5 shadow-[0_8px_28px_rgba(0,0,0,0.4)] transition hover:-translate-y-1 ${live ? "border-red-500/40 shadow-[0_8px_28px_rgba(239,68,68,0.15)]" : "border-violet-400/15"}`}>
                    {/* Glow */}
                    <div className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl ${live ? "bg-red-500/20" : "bg-violet-600/10"}`} />
                    <div className="relative">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <h4 className="flex items-center gap-2 font-extrabold leading-tight">
                          {live && <span className="flex h-2.5 w-2.5 animate-ping rounded-full bg-red-500" />}
                          <span className="line-clamp-2">{c.title || "Live Class"}</span>
                        </h4>
                        <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-extrabold ${live ? "bg-red-500/20 text-red-300" : "border border-violet-400/25 bg-violet-500/10 text-violet-300"}`}>{live ? "● LIVE" : "Scheduled"}</span>
                      </div>

                      {/* Info pills */}
                      <div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><Users size={11} /> {c.instructorName || "Instructor"}</span>
                        {c.courseTitle && <span className="flex items-center gap-1"><Video size={11} /> {c.courseTitle}</span>}
                        {!live && c.scheduledAt && <span className="flex items-center gap-1"><Calendar size={11} /> {when(c.scheduledAt)}</span>}
                        {!live && c.durationMinutes && <span className="flex items-center gap-1"><Clock size={11} /> {c.durationMinutes} min</span>}
                      </div>

                      {c.agenda && <p className="mb-3 line-clamp-2 text-sm text-slate-500">{c.agenda}</p>}

                      {/* Countdown */}
                      {!live && c.scheduledAt && (
                        <div className="mb-3 flex items-center gap-1.5 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-sm font-semibold text-amber-300">
                          ⏰ {countdown(c.scheduledAt, now)}
                        </div>
                      )}

                      {/* CTA */}
                      {live
                        ? <Link href={`/my/live/${c.id}`} className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-red-500 px-5 py-2.5 text-sm font-extrabold shadow-[0_3px_12px_rgba(239,68,68,0.5)] hover:shadow-[0_5px_18px_rgba(239,68,68,0.7)]">
                            <Play size={14} fill="#fff" /> Join Now →
                          </Link>
                        : <button disabled className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-slate-500">
                            <Clock size={14} /> Scheduled
                          </button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Recordings tab */}
      {tab === "recordings" && (
        <>
          {!recs && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-violet-500/30 border-t-violet-500" />
              <p className="text-slate-400">Loading recordings…</p>
            </div>
          )}
          {recs && recs.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] py-20 text-center">
              <div className="text-6xl">🎞️</div>
              <h3 className="mt-3 text-xl font-extrabold">No recordings yet</h3>
              <p className="mt-1 text-slate-400">Recorded classes will appear here once your teacher saves them.</p>
            </div>
          )}
          {recs && recs.length > 0 && (
            <div className="space-y-6">
              {recs.map((course, ci) => (
                <div key={ci} className="rounded-2xl border border-white/10 bg-[#161626]/80 overflow-hidden">
                  <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.03] px-5 py-3.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/20 text-lg">📁</div>
                    <b className="text-base font-extrabold">{course.courseTitle || "Course"}</b>
                  </div>
                  <div className="divide-y divide-white/[0.05]">
                    {course.classes.filter((c) => c.recordings?.length).map((c) => (
                      <div key={c.classId} className="p-5">
                        <div className="mb-3 flex items-center gap-2 text-sm font-bold">
                          <span className="text-base">🧑‍🏫</span> {c.title || "Live Class"}
                          {c.endedAt && <span className="text-xs font-normal text-slate-500">· {new Date(c.endedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {c.recordings.map((r, ri) => {
                            const label = `Recording${c.recordings.length > 1 ? ` ${ri + 1}` : ""}`;
                            const ready = r.hlsStatus === "ready" || !!r.url;
                            return ready ? (
                              <button key={r.id} onClick={() => setPlaying({ url: r.url!, title: `${c.title} — ${label}` })}
                                className="group flex items-center gap-3 rounded-xl border border-violet-400/20 bg-violet-500/10 p-4 text-left transition hover:border-violet-400/50 hover:bg-violet-500/20">
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 shadow-[0_3px_10px_rgba(139,92,246,0.5)] transition group-hover:scale-110">
                                  <Play size={18} fill="#fff" />
                                </span>
                                <div>
                                  <div className="font-bold">{label}</div>
                                  {r.duration && <div className="text-xs text-slate-400">⏱ {fmtDur(r.duration)}</div>}
                                </div>
                              </button>
                            ) : (
                              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-xl">⏳</span>
                                <div>
                                  <div className="font-semibold text-slate-400">{label}</div>
                                  <div className="text-xs text-slate-500">Processing…</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Video player modal */}
      {playing && (
        <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/90 p-4" onClick={() => setPlaying(null)}>
          <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <b className="text-sm font-bold">{playing.title}</b>
              <button onClick={() => setPlaying(null)} className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/30">✕ Close</button>
            </div>
            <video src={playing.url} controls autoPlay playsInline controlsList="nodownload" onContextMenu={(e) => e.preventDefault()} className="aspect-video w-full rounded-2xl bg-black" />
          </div>
        </div>
      )}
    </div>
  );
}

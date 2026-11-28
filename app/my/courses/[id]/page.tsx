"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { BookOpen, Check, CheckCircle2, ChevronDown, Clock, Globe, LayoutList, Lock, MessageCircle, Play, PlayCircle, Signal, Star, Video } from "lucide-react";
import { api, apiCached, durationToSeconds } from "../../api";
import { subjectLogo, subjectTheme } from "../../ui";
import { useMy } from "../../MyContext";
import { downloadPdf, getOffline, offlineKey } from "../../offline";
import FinalTestCard from "@/components/my/FinalTestCard";
import PdfViewer from "@/components/my/PdfViewer";
import { isGuestSession } from "@/services/auth";

type Lesson = { id: string; title: string; duration?: string | null; isFree: boolean; hasVideo?: boolean };
type Material = { id: string; title: string; fileUrl: string; fileType?: string | null };
type Module = { id: string; title: string; lessons: Lesson[]; materials?: Material[] };
type Course = {
  id: string; title: string; subtitle?: string | null; instructor?: string | null; isFree?: boolean;
  modules: Module[]; isEnrolled: boolean; accessEndsAt?: string | null; accessExpired?: boolean;
  completedLessons: string[]; progressPercent: number; purchase?: { plan?: string; price?: number } | null;
};

const SOCIALS = [
  { label: "Instagram", href: "https://www.instagram.com/codingkida4u", color: "#f472b6",
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8.2A3.2 3.2 0 1 1 12 8.8a3.2 3.2 0 0 1 0 6.4zM17.3 5.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zM12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 4 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2z" /></svg> },
  { label: "X (Twitter)", href: "https://x.com/CodingKida4U", color: "#e2e8f0",
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><path d="M18.9 1h3.7l-8 9.1L24 23h-7.4l-5.8-7.5L4.5 23H.8l8.6-9.8L0 1h7.6l5.2 6.8L18.9 1zm-1.3 19.8h2L6.5 3.2H4.3l13.3 17.6z" /></svg> },
  { label: "YouTube", href: "https://youtube.com/@codingkida4u", color: "#f87171",
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.75 15.5v-7l6.5 3.5-6.5 3.5z" /></svg> },
  { label: "Website", href: "/", color: "#7dd3fc", icon: <Globe size={15} /> },
];

/** mm:ss, or h:mm:ss for long lessons (desktop formatDuration). */
const clock = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.round(s % 60);
  const p = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(x)}` : `${p(m)}:${p(x)}`;
};
/** "15h 34m 00s" (desktop Course Info). */
const hms = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.round(s % 60);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}h ${p(m)}m ${p(x)}s`;
};

/** Course detail — same sections as the desktop app's course page. */
export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useMy();
  const uid = user?.id || "";
  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState("");
  const [openMod, setOpenMod] = useState(0);
  const [rating, setRating] = useState<{ avg: number; reviews: number } | null>(null);
  const [viewer, setViewer] = useState<{ url: string; title: string } | null>(null);
  const [matDl, setMatDl] = useState<Record<string, "busy" | "done">>({});

  useEffect(() => {
    apiCached(`/api/courses/${encodeURIComponent(id)}?signed=true`, (d) => {
        const c: Course = d.course;
        setCourse(c);
        // Remember the last opened module per course (desktop ck_last_mod_<id>).
        const saved = parseInt(localStorage.getItem(`ck_last_mod_${id}`) || "0", 10);
        setOpenMod(Number.isFinite(saved) && saved < (c?.modules?.length || 0) ? saved : 0);
      }, { skipIfFresh: true })
      .catch((e) => setError(e.message || "Could not load this course."));
  }, [id]);

  // Rating = average of lesson ratings, Reviews = number of reviews (desktop logic).
  useEffect(() => {
    if (!course) return;
    const lessons = course.modules.flatMap((m) => m.lessons);
    if (!lessons.length) { setRating({ avg: 0, reviews: 0 }); return; }
    let dead = false;
    Promise.all(lessons.map((l) =>
      api(`/api/feedback/lesson?lessonId=${encodeURIComponent(l.id)}`)
        .then((d) => ({ avg: parseFloat(d.avgRating) || 0, n: parseInt(d.totalReviews, 10) || 0 }))
        .catch(() => ({ avg: 0, n: 0 })),
    )).then((rs) => {
      if (dead) return;
      const rated = rs.filter((r) => r.avg > 0);
      setRating({ avg: rated.length ? Math.min(rated.reduce((s, r) => s + r.avg, 0) / rated.length, 5) : 0, reviews: rs.reduce((s, r) => s + r.n, 0) });
    });
    return () => { dead = true; };
  }, [course]);

  // Which study materials are already downloaded (Download → "Downloaded").
  useEffect(() => {
    if (!course || !uid) return;
    const mats = course.modules.flatMap((m) => m.materials || []);
    Promise.all(mats.map((m) => getOffline(offlineKey(uid, `material_${m.id}`, "pdf")).then((it) => [m.id, !!it && it.expiresAt > Date.now()] as const)))
      .then((rows) => setMatDl(Object.fromEntries(rows.filter(([, ok]) => ok).map(([k]) => [k, "done" as const]))))
      .catch(() => {});
  }, [course, uid]);

  const stats = useMemo(() => {
    if (!course) return null;
    const done = new Set(course.completedLessons || []);
    const all = course.modules.flatMap((m) => m.lessons);
    const completed = Math.min(all.filter((l) => done.has(l.id)).length, all.length);
    const pct = all.length ? Math.min(100, Math.round((completed / all.length) * 100)) : 0;
    const secs = all.reduce((s, l) => s + durationToSeconds(l.duration), 0);
    const t = course.title.toLowerCase();
    const hard = ["java", "mern", "dsa", "advanced"].some((k) => t.includes(k));
    return { done, all, completed, pct, secs, level: hard ? { t: "Intermediate", c: "#f97316" } : { t: "Beginner", c: "#22c55e" } };
  }, [course]);

  if (error) return <div className="pt-10 text-center text-white/70">{error} <Link href="/my/courses" className="text-violet-300 underline">Back to courses</Link></div>;
  if (!course || !stats) return <div className="pt-10 text-center text-white/50">Loading course…</div>;

  const theme = subjectTheme(course.title);
  const logo = subjectLogo(course.title);
  const canOpen = (l: Lesson) => course.isEnrolled || l.isFree;
  const canMaterials = course.isEnrolled || !!course.isFree;
  const toggleMod = (i: number) => {
    const next = openMod === i ? -1 : i;
    setOpenMod(next);
    if (next >= 0) try { localStorage.setItem(`ck_last_mod_${course.id}`, String(next)); } catch { /* ignore */ }
  };
  const goLesson = (l: Lesson) => {
    if (canOpen(l)) { router.push(`/my/lesson/${l.id}?course=${course.id}`); return; }
    // A guest leaving for payment goes through the classroom's "Are you leaving?" check (it listens to link clicks).
    if (isGuestSession()) { const a = document.createElement("a"); a.href = "/signup"; document.body.appendChild(a); a.click(); a.remove(); return; }
    router.push(`/payment?courseId=${course.id}`);
  };

  const viewMaterial = (m: Material) => {
    const isPdf = (m.fileType || "pdf") === "pdf" || /\.pdf(\?|$)/i.test(m.fileUrl);
    if (isPdf) setViewer({ url: m.fileUrl, title: m.title });
    else window.open(m.fileUrl, "_blank", "noopener,noreferrer");
  };
  const downloadMaterial = async (m: Material, mod: Module) => {
    if (!uid) return;
    setMatDl((s) => ({ ...s, [m.id]: "busy" }));
    try {
      await downloadPdf({ userId: uid, id: `material_${m.id}`, courseId: course.id, url: m.fileUrl, title: m.title, courseTitle: course.title, moduleTitle: mod.title });
      setMatDl((s) => ({ ...s, [m.id]: "done" }));
    } catch (e) {
      setMatDl((s) => { const n = { ...s }; delete n[m.id]; return n; });
      alert(e instanceof Error ? e.message : "Download failed.");
    }
  };

  // CTA (desktop cd-price-btn)
  const verb = course.accessExpired ? "Renew" : "Unlock";
  const cta = course.isFree
    ? <span className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-6 py-3 text-sm font-extrabold text-emerald-300">Free Course</span>
    : course.isEnrolled
      ? <span className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-6 py-3 text-sm font-extrabold shadow-[0_4px_16px_rgba(34,197,94,0.35)]"><Check size={16} /> Enrolled</span>
      : <Link href={`/payment?courseId=${course.id}`} className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-3 text-sm font-extrabold text-[#431407] shadow-[0_4px_16px_rgba(245,158,11,0.35)] hover:brightness-105">
          {course.purchase?.price ? `${verb}${course.purchase.plan === "zenalpha" ? " with ZenAlpha" : ""} – ₹${course.purchase.price} · 3 months` : `${verb} Course`}
        </Link>;

  let n = 0; // running lesson number across modules
  const firstOpenIdx = stats.all.findIndex((l) => canOpen(l) && !stats.done.has(l.id)); // "In Progress" = next lesson

  return (
    <div className="space-y-5 pt-2">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-violet-400/15 bg-gradient-to-br from-[#1b1240] via-[#14112b] to-[#0f0f1a] px-6 py-7 md:px-8">
        <div className="pointer-events-none absolute -left-10 -top-16 h-64 w-64 rounded-full blur-3xl" style={{ background: `${theme.accent}30` }} />
        <div className="pointer-events-none absolute right-40 -bottom-20 h-56 w-56 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-5">
          <Link href="/my/courses" className="absolute -top-3 left-0 text-xs font-semibold text-white/50 hover:text-white">← All courses</Link>
          <div className="mt-3 flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#0f0f1a] shadow-lg" style={logo ? undefined : { background: theme.gradient }}>
            {logo ? <img src={logo} alt="" draggable={false} className="h-14 w-14 object-contain" /> : <span className="text-3xl font-black">{course.title.charAt(0)}</span>}
          </div>
          <div className="mt-3 min-w-0 flex-1">
            <h1 className="text-3xl font-extrabold leading-tight">{course.title}</h1>
            {course.instructor && <p className="text-sm text-white/60">{course.instructor}</p>}
            {course.subtitle && <p className="mt-0.5 max-w-2xl text-sm text-white/50">{course.subtitle}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
              <span className="inline-flex items-center gap-1.5"><Star size={15} className="fill-amber-400 text-amber-400" /> <b>{rating ? (rating.avg > 0 ? rating.avg.toFixed(1) : "--") : "…"}</b> <small className="text-white/50">Rating</small></span>
              <span className="inline-flex items-center gap-1.5"><MessageCircle size={15} className="text-emerald-400" /> <b>{rating ? rating.reviews : "…"}</b> <small className="text-white/50">Reviews</small></span>
              {course.isEnrolled && course.accessEndsAt && <span className="text-xs text-white/50">Access until {new Date(course.accessEndsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4">
            {cta}
            <img src="/desk/student.png" alt="" draggable={false} className="hidden h-28 w-auto object-contain drop-shadow-2xl lg:block" />
          </div>
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
        {/* Course content */}
        <div className="min-w-0 rounded-3xl border border-white/10 bg-[#161626]/75 p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-400/25 bg-violet-500/10 text-violet-300"><LayoutList size={18} /></span>
            <div><h2 className="text-xl font-extrabold">Course Content</h2><p className="text-xs text-white/50">Continue your learning journey</p></div>
          </div>

          <div className="space-y-3">
            {course.modules.map((m, mi) => {
              const open = openMod === mi;
              const mats = m.materials || [];
              const rows = m.lessons.map((l) => {
                n += 1;
                const idx = n;
                const ok = canOpen(l);
                const isDone = stats.done.has(l.id);
                const active = !isDone && ok && stats.all[firstOpenIdx]?.id === l.id;
                const secs = durationToSeconds(l.duration);
                return (
                  <button key={l.id} onClick={() => goLesson(l)}
                    className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition hover:-translate-y-px ${active ? "border-violet-400/40 bg-violet-500/10" : "border-white/[0.06] bg-white/[0.02] hover:border-violet-400/25 hover:bg-violet-500/[0.06]"} ${ok ? "" : "opacity-60"}`}>
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${!ok ? "border-red-400/40 text-red-400" : isDone ? "border-emerald-400/60 text-emerald-400" : active ? "border-violet-400 bg-violet-500/20 text-violet-200" : "border-emerald-500/40 text-emerald-400"}`}>
                      {ok ? <Play size={13} className="fill-current" /> : <Lock size={13} />}
                    </span>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-violet-400/25 bg-violet-500/10 text-[11px] font-extrabold text-violet-200">{String(idx).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1 text-sm font-bold uppercase tracking-wide">{l.title}</span>
                    {l.isFree && !course.isEnrolled && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">FREE</span>}
                    <span className="hidden rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-white/70 sm:inline">{secs > 0 ? clock(secs) : "--"}</span>
                    {isDone
                      ? <span className="flex items-center gap-1.5"><span className="rounded-md bg-emerald-500/15 px-2 py-1 text-[11px] font-bold text-emerald-300">Completed</span><CheckCircle2 size={16} className="text-emerald-400" /></span>
                      : active
                        ? <span className="flex items-center gap-1.5"><span className="rounded-md bg-violet-500/20 px-2 py-1 text-[11px] font-bold text-violet-200">In Progress</span><PlayCircle size={16} className="text-violet-300" /></span>
                        : !ok
                          ? <span className="flex items-center gap-1.5"><span className="rounded-md bg-white/5 px-2 py-1 text-[11px] font-bold text-white/50">Locked</span><Lock size={14} className="text-white/40" /></span>
                          : <span className="rounded-md bg-white/5 px-2 py-1 text-[11px] font-bold text-white/50">Not Started</span>}
                  </button>
                );
              });
              return (
                <div key={m.id} className={`overflow-hidden rounded-2xl border ${open ? "border-violet-400/25 bg-violet-500/[0.04]" : "border-white/[0.07] bg-white/[0.02]"}`}>
                  <button onClick={() => toggleMod(mi)} className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${open ? "shadow-[inset_3px_0_0_#a78bfa]" : ""}`}>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-extrabold uppercase tracking-widest text-violet-300">Module {mi + 1}</span>
                      <span className="block truncate font-bold">{m.title}</span>
                    </span>
                    <span className="text-xs text-white/50">{m.lessons.length} Lesson{m.lessons.length !== 1 ? "s" : ""}</span>
                    <ChevronDown size={16} className={`text-white/50 transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                  {/* Rows are always computed so lesson numbering stays continuous; shown only when open. */}
                  <div className={open ? "border-t border-white/[0.06] px-3 pb-3" : "hidden"}>
                    <div className="flex items-center gap-2 px-1 pb-2 pt-3">
                      <PlayCircle size={13} className="text-violet-400" />
                      <span className="text-xs font-bold uppercase tracking-wide text-violet-400">Lesson Videos</span>
                      <span className="ml-auto text-[11px] text-white/40">{m.lessons.length} lesson{m.lessons.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="space-y-2">{rows}</div>

                    {mats.length > 0 && (
                      <div className="mt-3 border-t border-white/[0.06] pt-3">
                        <div className="mb-2.5 flex items-center gap-2 px-1">
                          <BookOpen size={13} className="text-violet-400" />
                          <span className="text-xs font-bold uppercase tracking-wide text-violet-400">Study Material</span>
                          <span className="ml-auto text-[11px] text-white/40">{mats.length} file{mats.length !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="space-y-1.5">
                          {mats.map((mt) => {
                            const type = mt.fileType || "pdf";
                            const col = type === "ppt" ? "#f59e0b" : type === "image" ? "#3b82f6" : type === "doc" ? "#2563eb" : "#ef4444";
                            const state = matDl[mt.id];
                            return (
                              <div key={mt.id} className={`flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 ${canMaterials ? "hover:bg-violet-500/[0.08]" : "opacity-50"}`}>
                                <span className="w-5 text-center text-[11px] font-black" style={{ color: col }}>{type === "ppt" ? "PPT" : type === "image" ? "IMG" : type === "doc" ? "DOC" : "PDF"}</span>
                                <span className="min-w-0 flex-1 truncate text-sm">{mt.title}</span>
                                {canMaterials && mt.fileUrl ? (
                                  <>
                                    <button onClick={() => viewMaterial(mt)} className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold text-violet-300 hover:bg-violet-500/20">View</button>
                                    {state === "done"
                                      ? <Link href="/my/downloads" className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">Downloaded ✓</Link>
                                      : <button onClick={() => downloadMaterial(mt, m)} disabled={state === "busy"} className="rounded-md border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[11px] font-semibold text-green-400 hover:bg-green-500/20 disabled:opacity-60">{state === "busy" ? "Saving…" : "Download"}</button>}
                                  </>
                                ) : <Lock size={12} className="text-white/40" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Final course test + certificate — after the last module (enrolled only), like the desktop */}
          {course.isEnrolled && <div className="mt-4"><FinalTestCard courseId={course.id} /></div>}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-14">
          <div className="rounded-2xl border border-white/10 bg-[#161626]/75 p-5">
            <h3 className="mb-3 font-extrabold">Course Info</h3>
            <div className="space-y-2.5 text-sm">
              <Info icon={<BookOpen size={14} className="text-violet-400" />} label="Modules" value={course.modules.length} />
              <Info icon={<Clock size={14} className="text-sky-400" />} label="Duration" value={hms(stats.secs)} />
              <Info icon={<Video size={14} className="text-violet-400" />} label="Videos" value={`${stats.all.length} videos`} />
              <Info icon={<Signal size={14} className="text-white/40" />} label="Level" value={<span style={{ color: stats.level.c }}>{stats.level.t}</span>} />
            </div>
          </div>

          {(course.isEnrolled || stats.completed > 0) && (
            <div className="rounded-2xl border border-white/10 bg-[#161626]/75 p-5">
              <h3 className="mb-3 font-extrabold">Your Progress</h3>
              <div className="flex items-center gap-4">
                <div className="relative h-[72px] w-[72px] shrink-0">
                  <svg width="72" height="72" viewBox="0 0 72 72">
                    <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                    <circle cx="36" cy="36" r="30" fill="none" stroke="url(#cdpg)" strokeWidth="5" strokeLinecap="round" strokeDasharray="188.5" strokeDashoffset={188.5 - (188.5 * stats.pct) / 100} transform="rotate(-90 36 36)" style={{ transition: "stroke-dashoffset .5s ease" }} />
                    <defs><linearGradient id="cdpg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#6c47ff" /><stop offset="100%" stopColor="#38bdf8" /></linearGradient></defs>
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold">{stats.pct}%</span>
                </div>
                <div className="min-w-0">
                  <b className="block">{stats.pct === 0 ? "Start learning! 📚" : stats.pct === 100 ? "Completed! 🎉" : "Keep going! 🚀"}</b>
                  <span className="text-xs text-white/55">You&apos;ve completed {stats.completed} of {stats.all.length} lessons</span>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#6c47ff] to-[#38bdf8]" style={{ width: `${stats.pct}%` }} /></div>
                <span className="text-xs font-bold text-violet-300">{stats.pct}%</span>
              </div>
              <div className="mt-1.5 text-[11px] text-white/50">{stats.completed}/{stats.all.length} Lessons Completed</div>
            </div>
          )}

          {course.instructor && (
            <div className="rounded-2xl border border-white/10 bg-[#161626]/75 p-5">
              <h3 className="mb-3 font-extrabold">Instructor</h3>
              <div className="flex items-center gap-3">
                <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg font-extrabold">
                  {course.instructor.charAt(0).toUpperCase()}
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#161626] bg-emerald-500" />
                </div>
                <div>
                  <div className="font-bold">{course.instructor}</div>
                  <span className="text-[11px] font-semibold text-violet-300">Lead Instructor</span>
                </div>
              </div>
              {/* Same 4 social buttons as the desktop app — real CodingKida links (as used in the site footer) */}
              <div className="mt-4 grid grid-cols-4 gap-2">
                {SOCIALS.map((s) => (
                  <a key={s.label} href={s.href} target={s.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" title={s.label}
                    className="flex h-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition hover:-translate-y-0.5 hover:bg-white/10" style={{ color: s.color }}>
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {viewer && <PdfViewer url={viewer.url} title={viewer.title} onClose={() => setViewer(null)} />}
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-white/70">{icon} {label}</span>
      <strong>{value}</strong>
    </div>
  );
}

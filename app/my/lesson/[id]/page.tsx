"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Bookmark, BookmarkCheck, CheckCircle2, Download, Eye, FileText, Lock, PlayCircle, ThumbsDown, ThumbsUp, Trophy } from "lucide-react";
import { isSaved, toggleSaved } from "../../watchlist";
import { LessonBoardModal } from "@/components/my/Panels";
import StreakTab, { type Streak } from "@/components/my/StreakTab";
import HomeworkTab, { type Homework } from "@/components/my/HomeworkTab";
import PdfViewer from "@/components/my/PdfViewer";
import { api, durationToSeconds, prettyDuration } from "../../api";
import { useMy } from "../../MyContext";
import HlsPlayer from "@/components/learn/HlsPlayer";
import QuizTab from "@/components/my/QuizTab";
import ExerciseTab from "@/components/my/ExerciseTab";
import RateTab from "@/components/my/RateTab";
import AskTab from "@/components/my/AskTab";

type Lesson = { id: string; title: string; duration?: string | null; isFree: boolean; hasVideo?: boolean };
type Material = { id: string; title: string; fileUrl: string };
type Module = { id: string; title: string; lessons: Lesson[]; materials?: Material[] };
type Course = { id: string; title: string; modules: Module[]; isEnrolled: boolean; completedLessons: string[] };
type Play = { id: string; title: string; notes?: string; videoUrl: string; hlsStatus: string; isFree: boolean; locked: boolean; qualityUrls?: Record<string, string> };

const TABS = [
  { key: "ppt", label: "📄 PPT" },
  { key: "quiz", label: "📝 Quiz" },
  { key: "exercise", label: "💻 Exercise" },
  { key: "rate", label: "⭐ Rate" },
  { key: "ask", label: "💬 AskNow" },
] as const;
type TabKey = (typeof TABS)[number]["key"] | "streak" | "homework";
type Reactions = { likes: number; dislikes: number; views: number; userReaction: string | null };

export default function LessonPage() {
  return (
    <Suspense fallback={<div className="pt-10 text-center text-white/50">Loading lesson…</div>}>
      <LessonInner />
    </Suspense>
  );
}

function LessonInner() {
  const { id: lessonId } = useParams<{ id: string }>();
  const courseId = useSearchParams().get("course") || "";
  const router = useRouter();
  const { user, refreshCoins } = useMy();

  const [course, setCourse] = useState<Course | null>(null);
  const [play, setPlay] = useState<Play | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<TabKey>("ppt");
  const [visited, setVisited] = useState<Set<TabKey>>(new Set(["ppt"]));
  const [hlsFailed, setHlsFailed] = useState(false);
  const [ended, setEnded] = useState(false);
  const marked = useRef(false);
  const [react, setReact] = useState<Reactions>({ likes: 0, dislikes: 0, views: 0, userReaction: null });
  const [saved, setSaved] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [pdfOpen, setPdfOpen] = useState(false);
  const who = user?.email || "";

  // Views, like/dislike counts and the weekly streak for this lesson.
  useEffect(() => {
    setReact({ likes: 0, dislikes: 0, views: 0, userReaction: null });
    setStreak(null);
    api(`/api/lessons/${encodeURIComponent(lessonId)}/view`, { method: "POST" }).catch(() => {});
    api(`/api/lessons/${encodeURIComponent(lessonId)}/reaction`)
      .then((d) => setReact({ likes: d.likes || 0, dislikes: d.dislikes || 0, views: d.views || 0, userReaction: d.userReaction || null }))
      .catch(() => {});
    api(`/api/weekly-streak?lessonId=${encodeURIComponent(lessonId)}`).then((d) => setStreak(d.streak || null)).catch(() => {});
    setHomework([]);
    api(`/api/homework?lessonId=${encodeURIComponent(lessonId)}`).then((d) => setHomework(d.homeworks || [])).catch(() => {});
  }, [lessonId]);

  useEffect(() => { setSaved(isSaved(who, lessonId)); }, [who, lessonId]);

  const sendReaction = (type: "like" | "dislike") =>
    api(`/api/lessons/${encodeURIComponent(lessonId)}/reaction`, { method: "POST", json: { type } })
      .then((d) => setReact((r) => ({ ...r, likes: d.likes ?? r.likes, dislikes: d.dislikes ?? r.dislikes, userReaction: d.userReaction || null })))
      .catch(() => {});

  // Course (modules, playlist, progress)
  useEffect(() => {
    if (!courseId) { setError("This lesson link is missing its course. Open it from your course page."); return; }
    api(`/api/courses/${encodeURIComponent(courseId)}?signed=true`)
      .then((d) => { setCourse(d.course); setDone(new Set(d.course?.completedLessons || [])); })
      .catch((e) => setError(e.message || "Could not load the course."));
  }, [courseId]);

  // This lesson (signed on demand)
  useEffect(() => {
    setPlay(null); setHlsFailed(false); setEnded(false); setTab("ppt"); setVisited(new Set(["ppt"])); marked.current = false;
    api(`/api/lessons/${encodeURIComponent(lessonId)}/play`)
      .then((d) => setPlay(d.lesson))
      .catch((e) => setError(e.message || "Could not load the lesson."));
  }, [lessonId]);

  const seq = useMemo(() => (course ? course.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleId: m.id }))) : []), [course]);
  const mod = course?.modules.find((m) => m.lessons.some((l) => l.id === lessonId));
  const lesson = mod?.lessons.find((l) => l.id === lessonId);
  const idx = seq.findIndex((l) => l.id === lessonId);
  const canOpen = (l: Lesson) => !!course && (course.isEnrolled || l.isFree);
  const nextLesson = idx >= 0 ? seq.slice(idx + 1).find((l) => canOpen(l)) : undefined;

  // Remember where the student stopped (used by "Continue Learning").
  useEffect(() => {
    if (course && lesson) {
      try { localStorage.setItem("ck_last_lesson", JSON.stringify({ courseId: course.id, lessonId: lesson.id })); } catch { /* ignore */ }
    }
  }, [course, lesson]);

  const notesUrl = useMemo(() => {
    const m = (mod?.materials || []).find((x) => /ppt$/i.test(String(x.title || "").replace(/\.[^.]+$/, "").trim()));
    return m?.fileUrl || play?.notes || "";
  }, [mod, play]);

  const onTime = useCallback((cur: number, dur: number) => {
    if (!dur || !Number.isFinite(dur) || marked.current || cur / dur < 0.9) return;
    marked.current = true;
    api(`/api/lessons/${encodeURIComponent(lessonId)}/progress`, { method: "POST", json: { completed: true } })
      .then(() => { setDone((s) => new Set(s).add(lessonId)); refreshCoins(); })
      .catch(() => { marked.current = false; });
  }, [lessonId, refreshCoins]);

  const pick = (k: TabKey) => { setTab(k); setVisited((v) => new Set(v).add(k)); };
  const goNext = () => nextLesson && router.push(`/my/lesson/${nextLesson.id}?course=${courseId}`);

  if (error) {
    return <div className="mx-auto max-w-xl pt-12 text-center text-white/70">{error}<div className="mt-4"><Link href="/my/courses" className="text-violet-300 underline">Back to courses</Link></div></div>;
  }

  const total = seq.length;
  const doneCount = seq.filter((l) => done.has(l.id)).length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  const hlsOk = !!play && !play.locked && play.hlsStatus === "ready" && !hlsFailed;
  const mp4 = play && !play.locked && play.isFree && play.videoUrl && !hlsOk ? play.videoUrl : "";

  let videoArea: React.ReactNode;
  if (!play) {
    videoArea = <Center>Loading video… ⏳</Center>;
  } else if (play.locked) {
    videoArea = (
      <Center>
        <div className="text-5xl">🔒</div>
        <p className="mt-2 text-lg font-extrabold">This lesson is part of the full course</p>
        <Link href={`/payment?courseId=${courseId}`} className="mt-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-2.5 text-sm font-extrabold text-[#431407]">Unlock full course</Link>
      </Center>
    );
  } else if (hlsOk) {
    videoArea = <HlsPlayer key={lessonId} lessonId={lessonId} onTimeUpdate={onTime} onEnded={() => setEnded(true)} onFail={() => setHlsFailed(true)} />;
  } else if (mp4) {
    videoArea = <Mp4Player original={mp4} qualities={play?.qualityUrls || {}} onTime={onTime} onEnded={() => setEnded(true)} />;
  } else {
    videoArea = (
      <Center>
        <div className="text-5xl">🎬</div>
        <p className="mt-2 text-lg font-extrabold">This video is getting ready</p>
        <p className="max-w-sm text-sm text-white/60">Please try again in a little while. You can read the PPT or try the quiz meanwhile.</p>
      </Center>
    );
  }

  return (
    <div className="mx-auto max-w-7xl pt-2">
      <div className="mb-3">
        <Link href={courseId ? `/my/courses/${courseId}` : "/my/courses"} className="text-sm font-semibold text-white/60 hover:text-white">← {course?.title || "Course"}</Link>
        <h1 className="mt-1 text-xl font-extrabold md:text-2xl">{lesson?.title || play?.title || "Lesson"}</h1>
        <div className="text-xs text-white/50">{mod?.title}{lesson && durationToSeconds(lesson.duration) > 0 ? ` · ${prettyDuration(durationToSeconds(lesson.duration))}` : ""}</div>
      </div>
      <div className="mb-4 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-violet-500 to-pink-500" style={{ width: `${pct}%` }} /></div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">{videoArea}</div>

          {/* Engagement bar: like / dislike / views, then Save, Download, Leaderboard, Subscribe */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={() => sendReaction("like")} className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${react.userReaction === "like" ? "border-emerald-400 bg-emerald-400/20" : "border-white/10 bg-white/5 hover:border-emerald-400/40"}`}>
              <ThumbsUp size={14} /> {react.likes}
            </button>
            <button onClick={() => sendReaction("dislike")} className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${react.userReaction === "dislike" ? "border-red-400 bg-red-400/20" : "border-white/10 bg-white/5 hover:border-red-400/40"}`}>
              <ThumbsDown size={14} /> {react.dislikes}
            </button>
            <span className="inline-flex items-center gap-1.5 px-2 text-sm text-white/60"><Eye size={14} /> {react.views} views</span>
            <div className="flex-1" />
            <button onClick={() => setSaved(toggleSaved(who, { lessonId, courseId, title: lesson?.title || play?.title || "Lesson", courseTitle: course?.title || "" }))}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 text-sm font-semibold hover:bg-white/5">
              {saved ? <BookmarkCheck size={14} className="text-violet-300" /> : <Bookmark size={14} />} {saved ? "Saved" : "Save"}
            </button>
            <Link href="/download" title="Offline lesson downloads are protected and work in the CodingKida app"
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-pink-500 px-3.5 py-1.5 text-sm font-bold">
              <Download size={14} /> Download Lesson
            </Link>
            <button onClick={() => setBoardOpen(true)} title="Lesson leaderboard" className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3.5 py-1.5 text-sm font-semibold text-amber-300 hover:bg-amber-400/20">
              <Trophy size={14} /> Leaderboard
            </button>
            <a href="https://youtube.com/@codingkida4u" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3.5 py-1.5 text-sm font-bold hover:bg-red-500">
              <PlayCircle size={14} /> Subscribe
            </a>
          </div>
          {boardOpen && <LessonBoardModal lessonId={lessonId} onClose={() => setBoardOpen(false)} />}
          {pdfOpen && notesUrl && <PdfViewer url={notesUrl} title={`${mod?.title || "Module"} — PPT`} onClose={() => setPdfOpen(false)} />}

          {(ended || (nextLesson && done.has(lessonId))) && nextLesson && (
            <button onClick={goNext} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-extrabold hover:bg-emerald-400">
              <CheckCircle2 size={16} /> Next lesson: {nextLesson.title} →
            </button>
          )}

          <div className="mt-5 flex gap-1 overflow-x-auto border-b border-white/10">
            {[...TABS.slice(0, 3), ...(homework.length ? [{ key: "homework" as const, label: "🏠 Homework" }] : []), TABS[3], ...(streak ? [{ key: "streak" as const, label: "🔥 Streak" }] : []), TABS[4]].map((t) => (
              <button key={t.key} onClick={() => pick(t.key)} className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-bold ${tab === t.key ? "border-violet-400 text-white" : "border-transparent text-white/50 hover:text-white"}`}>{t.label}</button>
            ))}
          </div>

          <div className="mt-4">
            <div hidden={tab !== "ppt"}>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <h3 className="flex items-center gap-2 text-lg font-extrabold"><FileText size={18} className="text-red-400" /> Module PPT</h3>
                <p className="mt-1 text-sm text-white/60">Study material for this module.</p>
                {notesUrl ? (
                  <button onClick={() => setPdfOpen(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-2.5 text-sm font-bold hover:bg-white/5">
                    <FileText size={16} className="text-red-400" /> View PPT
                  </button>
                ) : (
                  <div className="py-6 text-center text-sm text-white/50">No PPT available for this module yet.</div>
                )}
              </div>
            </div>
            {visited.has("quiz") && <div hidden={tab !== "quiz"}><QuizTab lessonId={lessonId} courseId={courseId} onCoins={refreshCoins} /></div>}
            {visited.has("exercise") && <div hidden={tab !== "exercise"}><ExerciseTab lessonId={lessonId} courseId={courseId} onCoins={refreshCoins} /></div>}
            {visited.has("rate") && <div hidden={tab !== "rate"}><RateTab lessonId={lessonId} lessonTitle={lesson?.title || play?.title || ""} /></div>}
            {homework.length > 0 && visited.has("homework") && <div hidden={tab !== "homework"}><HomeworkTab items={homework} /></div>}
            {streak && visited.has("streak") && <div hidden={tab !== "streak"}><StreakTab streak={streak} /></div>}
            {visited.has("ask") && <div hidden={tab !== "ask"}><AskTab lessonId={lessonId} /></div>}
          </div>
        </div>

        {/* Right: progress + course content */}
        <aside className="lg:sticky lg:top-14 lg:max-h-[calc(100vh-5rem)] lg:self-start lg:overflow-y-auto">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-sm font-extrabold">Your Progress</div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400" style={{ width: `${pct}%` }} /></div>
            <div className="mt-1 flex justify-between text-xs text-white/60"><span>{pct}% Completed</span><span>{doneCount}/{total} Lessons</span></div>
          </div>

          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04]">
            <div className="border-b border-white/10 px-4 py-3 text-sm font-extrabold">Course Content</div>
            {course?.modules.map((m) => (
              <div key={m.id}>
                <div className="bg-white/[0.03] px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-white/50">{m.title}</div>
                {m.lessons.map((l) => {
                  const ok = canOpen(l);
                  const active = l.id === lessonId;
                  const secs = durationToSeconds(l.duration);
                  return (
                    <Link key={l.id} href={ok ? `/my/lesson/${l.id}?course=${courseId}` : `/payment?courseId=${courseId}`}
                      className={`flex items-center gap-2.5 px-4 py-2.5 text-sm ${active ? "bg-violet-500/20" : "hover:bg-white/5"} ${ok ? "" : "opacity-60"}`}>
                      {done.has(l.id) ? <CheckCircle2 size={16} className="shrink-0 text-emerald-400" /> : ok ? <PlayCircle size={16} className={`shrink-0 ${active ? "text-violet-300" : "text-white/40"}`} /> : <Lock size={14} className="shrink-0 text-red-400" />}
                      <span className="flex-1 leading-snug">{l.title}</span>
                      <span className="text-xs text-white/40">{secs > 0 ? prettyDuration(secs) : ""}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

/** MP4 player with the apps' quality menu (Auto = original upload) and speed; keeps position when switching. */
function Mp4Player({ original, qualities, onTime, onEnded }: { original: string; qualities: Record<string, string>; onTime: (c: number, d: number) => void; onEnded: () => void }) {
  // Highest first: 1080p, 720p, 480p, 360p…
  const keys = Object.keys(qualities).sort((a, b) => (parseInt(b, 10) || 0) - (parseInt(a, 10) || 0));
  const [q, setQ] = useState("auto");
  const [speed, setSpeed] = useState(1);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const resume = useRef<{ t: number; play: boolean } | null>(null);
  const src = q === "auto" ? original : qualities[q] || original;

  const pick = (k: string) => {
    const v = ref.current;
    if (v) resume.current = { t: v.currentTime, play: !v.paused };
    setQ(k); setOpen(false);
  };
  const row = "flex w-full items-center justify-between gap-6 px-4 py-2 text-left text-sm hover:bg-white/10";
  return (
    <div className="relative h-full w-full bg-black">
      <button onClick={() => setOpen((o) => !o)} className="absolute right-2 top-2 z-20 rounded-lg border border-white/20 bg-black/60 px-2.5 py-1 text-xs font-bold text-white backdrop-blur hover:bg-black/80">
        ⚙ {q === "auto" ? "Auto" : q}{speed !== 1 ? ` · ${speed}x` : ""}
      </button>
      {open && (
        <div className="absolute right-2 top-11 z-30 min-w-44 overflow-hidden rounded-xl border border-white/15 bg-[#1a1a2e]/95 py-1 text-white shadow-2xl">
          <div className="px-4 pb-1 pt-2 text-[11px] font-bold uppercase text-white/50">Quality</div>
          {["auto", ...keys].map((k) => <button key={k} className={row} onClick={() => pick(k)}><span>{k === "auto" ? "Auto" : k}</span>{q === k && <span className="text-violet-300">✓</span>}</button>)}
          <div className="px-4 pb-1 pt-2 text-[11px] font-bold uppercase text-white/50">Speed</div>
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
            <button key={s} className={row} onClick={() => { setSpeed(s); if (ref.current) ref.current.playbackRate = s; setOpen(false); }}>
              <span>{s === 1 ? "Normal" : `${s}x`}</span>{speed === s && <span className="text-violet-300">✓</span>}
            </button>
          ))}
        </div>
      )}
      <video
        key={src} ref={ref} src={src} controls playsInline controlsList="nodownload" onContextMenu={(e) => e.preventDefault()}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          v.playbackRate = speed;
          if (resume.current) { v.currentTime = resume.current.t; if (resume.current.play) v.play().catch(() => {}); resume.current = null; }
        }}
        onTimeUpdate={(e) => onTime(e.currentTarget.currentTime, e.currentTarget.duration)} onEnded={onEnded}
        className="h-full w-full object-contain"
      />
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white">{children}</div>;
}

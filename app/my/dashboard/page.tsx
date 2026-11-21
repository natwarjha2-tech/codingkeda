"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, Trophy } from "lucide-react";
import { api, prettyDuration } from "../api";
import { useMy } from "../MyContext";
import { courseBg, courseIcon } from "../ui";
import VerifyBanner from "@/components/my/VerifyBanner";

type EnrolledCourse = {
  id: string; title: string; color?: string | null; icon?: string | null;
  totalLessons: number; completedLessons: number; progressPercent: number; remainingDurationSeconds: number;
};
type Xp = { level: number; title: string; xp: number; progressPct: number; toNext: number };

export default function MyDashboard() {
  const { user } = useMy();
  const [courses, setCourses] = useState<EnrolledCourse[] | null>(null);
  const [completed, setCompleted] = useState(0);
  const [xp, setXp] = useState<Xp | null>(null);
  const [resume, setResume] = useState<string>("/my/courses");

  useEffect(() => {
    api("/api/student/dashboard")
      .then((d) => {
        setCourses(d.enrolledCourses || []);
        setCompleted(d.completedVideos || 0);
        let target = d.enrolledCourses?.[0] ? `/my/courses/${d.enrolledCourses[0].id}` : "/my/courses";
        try {
          const last = JSON.parse(localStorage.getItem("ck_last_lesson") || "null");
          if (last?.lessonId && last?.courseId) target = `/my/lesson/${last.lessonId}?course=${last.courseId}`;
        } catch { /* ignore */ }
        setResume(target);
      })
      .catch(() => setCourses([]));
    api("/api/xp").then((d) => d?.xp && setXp(d.xp)).catch(() => {});
  }, []);

  const first = (user?.name || "Learner").split(" ")[0];

  return (
    <div className="mx-auto max-w-5xl space-y-6 pt-2">
      <VerifyBanner />
      {/* Welcome banner */}
      <section className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-r from-[#03011B] via-[#0F082B] to-[#080620] p-6 md:p-8">
        <div className="pointer-events-none absolute -right-10 top-0 h-64 w-64 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-20 h-40 w-40 rounded-full bg-orange-500/15 blur-3xl" />
        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white/85">
            <span className="text-amber-300">★</span> Level {xp?.level ?? 1} · {xp?.title ?? "Beginner"}
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
            Hey <span className="bg-gradient-to-r from-violet-300 via-pink-400 to-orange-400 bg-clip-text text-transparent">{first}!</span> 👋
          </h1>
          <p className="mt-1 text-white/75">Ready for today&apos;s coding adventure?</p>
          <Link href={resume} className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-7 py-3 font-bold shadow-lg shadow-purple-500/30 transition hover:-translate-y-0.5">
            Continue Learning <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat href="/my/enrolled" icon={<BookOpen size={18} />} label="Enrolled" value={courses ? String(courses.length) : "–"} color="text-sky-300" />
        <Stat href="/my/completed" icon={<CheckCircle2 size={18} />} label="Videos done" value={String(completed)} color="text-emerald-300" />
        <Stat href="/my/streak" icon={<span>🔥</span>} label="Weekly Streak" value="View" color="text-orange-300" />
        <Stat href="/my/achievements" icon={<Trophy size={18} />} label="XP" value={xp ? String(xp.xp) : "–"} color="text-fuchsia-300" />
      </section>

      {xp && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold">Level {xp.level} · {xp.title}</span>
            <span className="text-white/60">{xp.toNext} XP to next level</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500" style={{ width: `${Math.min(100, xp.progressPct || 0)}%` }} />
          </div>
        </section>
      )}

      {/* My courses */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">My Courses</h2>
          <Link href="/my/courses" className="text-sm font-semibold text-violet-300 hover:text-white">Browse all →</Link>
        </div>

        {courses === null && <div className="text-white/50">Loading…</div>}

        {courses && courses.length === 0 && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
            <div className="text-5xl">🚀</div>
            <h3 className="mt-2 text-lg font-extrabold">Start your coding journey</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-white/60">Watch the free lessons first. Unlock every course whenever you are ready.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Link href="/my/courses" className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold hover:bg-violet-500">See free lessons</Link>
              <Link href="/pricing" className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-bold hover:bg-white/5">See plans</Link>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {courses?.map((c) => (
            <Link key={c.id} href={`/my/courses/${c.id}`} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition hover:border-violet-400/40">
              <div className="flex items-center gap-3 p-4" style={courseBg(c.color)}>
                <span className="text-3xl">{courseIcon(c.icon)}</span>
                <h3 className="font-extrabold leading-tight">{c.title}</h3>
              </div>
              <div className="p-4">
                <div className="flex justify-between text-xs text-white/60">
                  <span>{c.completedLessons}/{c.totalLessons} lessons</span>
                  <span>{c.progressPercent}%{c.remainingDurationSeconds > 0 ? ` · ${prettyDuration(c.remainingDurationSeconds)} left` : ""}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400" style={{ width: `${c.progressPercent}%` }} />
                </div>
                <div className="mt-3 text-sm font-bold text-violet-300 group-hover:text-white">Continue →</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link href="/weekly-challenge" className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 hover:bg-amber-400/10">
          <div className="font-extrabold">🏆 Weekly Challenge</div>
          <div className="text-sm text-white/60">Solve this week&apos;s problem and climb the board.</div>
        </Link>
        <Link href="/my/ai" className="rounded-2xl border border-sky-400/20 bg-sky-400/5 p-4 hover:bg-sky-400/10">
          <div className="font-extrabold">🤖 Ask Codo</div>
          <div className="text-sm text-white/60">Stuck? Your AI buddy explains it simply.</div>
        </Link>
      </section>
    </div>
  );
}

function Stat({ icon, label, value, color, href }: { icon: React.ReactNode; label: string; value: string; color: string; href: string }) {
  return (
    <Link href={href} className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:-translate-y-0.5 hover:border-violet-400/40">
      <div className={`flex items-center gap-2 text-sm font-semibold ${color}`}>{icon}{label}</div>
      <div className={`mt-1 text-3xl font-extrabold ${color}`}>{value}</div>
    </Link>
  );
}

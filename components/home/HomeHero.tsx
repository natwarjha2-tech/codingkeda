"use client";
import { useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { PlayCircle, Sparkles } from "lucide-react";
import SurveyModal from "@/components/SurveyModal";

export interface HeroStats {
  courses: number; lessons: number; freeLessons: number; students: number;
  lessonsThisWeek?: number; avgRating?: number; ratingCount?: number;
}
export interface HeroLive { id: string; title: string; scheduledAt: string | null; status: "live" | "scheduled" }

const CLASSES = [
  { label: "Class 4–6", e: "🧸", cls: "bg-[#FFE4E6] text-[#BE123C] border-[#FDA4AF]" },
  { label: "Class 7–8", e: "🎮", cls: "bg-[#E0F2FE] text-[#0369A1] border-[#7DD3FC]" },
  { label: "Class 9–10", e: "🧪", cls: "bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]" },
  { label: "Class 11–12", e: "🚀", cls: "bg-[#EDE9FE] text-[#6D28D9] border-[#C4B5FD]" },
];

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k+` : `${n}`);

/**
 * Home hero. Everything that should grab a parent or a kid is in the first
 * screen: a playable puzzle, class picker, free start, live pills and real
 * numbers (shown only when they are above zero).
 */
export default function HomeHero({ stats, nextLive, weeklyTitle }: {
  stats?: HeroStats; nextLive?: HeroLive | null; weeklyTitle?: string | null;
}) {
  const [surveyOpen, setSurveyOpen] = useState(false);
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  // Real numbers only; each one is hidden when it is zero. Max 4 tiles.
  const numbers = stats
    ? [
        { v: stats.students, l: "students learning", e: "👦", t: "" },
        { v: stats.lessonsThisWeek ?? 0, l: "lessons finished this week", e: "🔥", t: "" },
        { v: stats.ratingCount ? stats.avgRating ?? 0 : 0, l: `rating from ${stats.ratingCount ?? 0} students`, e: "⭐", t: (stats.avgRating ?? 0).toFixed(1) },
        { v: stats.lessons, l: "video lessons", e: "🎬", t: "" },
        { v: stats.courses, l: "courses", e: "📚", t: "" },
        { v: stats.freeLessons, l: "free lessons", e: "🎈", t: "" },
      ].filter((x) => x.v > 0).slice(0, 4)
    : [];

  return (
    <section id="hero" className="relative overflow-hidden pt-24 pb-10 md:pt-28 md:pb-14 px-5">
      {/* playful background shapes */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 w-80 h-80 rounded-full bg-[#FFD84D]/40 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute top-40 -right-20 w-96 h-96 rounded-full bg-[#8B5CF6]/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute bottom-0 left-1/3 w-72 h-72 rounded-full bg-[#38BDF8]/20 blur-3xl" />

      <div className="relative max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white border-2 border-[#FFD84D] px-4 py-1.5 text-sm font-extrabold text-[#B45309] shadow-sm">
            <Sparkles size={15} /> Coding for Class 4 to 12 · Free to start
          </span>

          <h1 className="mt-4 text-4xl md:text-[3.4rem] font-black leading-[1.08] text-[#1E1B4B]">
            Kids learn coding the{" "}
            <span className="relative inline-block text-[#7C3AED]">
              fun way
              <svg aria-hidden viewBox="0 0 200 12" className="absolute left-0 -bottom-2 w-full h-3 text-[#FFB020]">
                <path d="M2 9 Q 50 1 100 7 T 198 5" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
              </svg>
            </span>{" "}
            🚀
          </h1>

          <p className="mt-5 text-lg md:text-xl text-[#4B5563] max-w-xl leading-relaxed">
            Short videos, quizzes and real coding. Win <b className="text-[#B45309]">medals 🥇</b>, <b className="text-[#B45309]">coins 🪙</b> and{" "}
            <b className="text-[#7C3AED]">XP ⭐</b> while you learn.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/free-learning" className="rounded-2xl bg-[#22C55E] px-7 py-4 text-base md:text-lg font-extrabold text-white border-b-[6px] border-[#15803D] hover:brightness-110 active:translate-y-0.5 active:border-b-2 transition-all">
              Start free 🎈
            </Link>
            <Link href="/courses" className="rounded-2xl bg-[#7C3AED] px-7 py-4 text-base md:text-lg font-extrabold text-white border-b-[6px] border-[#5B21B6] hover:brightness-110 active:translate-y-0.5 active:border-b-2 transition-all">
              Explore courses 📚
            </Link>
          </div>

          {/* Class picker, right in the first screen */}
          <div className="mt-6">
            <p className="text-sm font-black text-[#6B7280]">Which class are you in?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {CLASSES.map((c) => (
                <button key={c.label} onClick={() => setSurveyOpen(true)} className={`${c.cls} rounded-full border-2 border-b-4 px-4 py-2 text-sm font-black hover:-translate-y-0.5 transition-transform`}>
                  {c.e} {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live pills */}
          <div className="mt-5 flex flex-wrap gap-2 text-sm font-extrabold">
            {nextLive && (
              <Link href={`/live-classes/${nextLive.id}`} className="inline-flex items-center gap-2 rounded-full bg-[#FFE4E6] px-4 py-2 text-[#BE123C] border-2 border-[#FDA4AF]">
                <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
                {nextLive.status === "live" ? "Live now: " : "Next live class: "}
                <span className="max-w-[12rem] truncate">{nextLive.title || "Coding class"}</span>
              </Link>
            )}
            <Link href="/weekly-challenge" className="inline-flex items-center gap-2 rounded-full bg-[#FFEDD5] px-4 py-2 text-[#C2410C] border-2 border-[#FDBA74]">
              🔥 This week: <span className="max-w-[12rem] truncate">{weeklyTitle || "Weekly challenge"}</span>
            </Link>
            <button onClick={() => scrollTo("demo-video")} className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-[#1E1B4B] border-2 border-[#E5E7EB]">
              <PlayCircle size={16} className="text-[#EF4444]" /> Watch demo
            </button>
          </div>
        </div>

        {/* Right: a puzzle kids can play straight away */}
        <HeroPuzzle onMore={() => scrollTo("play")} />
      </div>

      {/* Real numbers (only the ones above zero) */}
      {numbers.length > 0 && (
        <div className="relative max-w-7xl mx-auto mt-10 grid grid-cols-2 md:grid-cols-4 gap-3">
          {numbers.map((n) => (
            <div key={n.l} className="rounded-2xl bg-white/90 border-2 border-[#EDE9FE] px-4 py-3 text-center">
              <div className="text-2xl md:text-3xl font-black text-[#1E1B4B]">{n.e} {n.t || fmt(n.v)}</div>
              <div className="text-xs md:text-sm font-bold text-[#6B7280]">{n.l}</div>
            </div>
          ))}
          <div className="col-span-2 md:col-span-4 flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs md:text-sm font-bold text-[#6B7280]">
            <span>🛡️ Parent-verified profiles</span>
            <span>📱 Phone + 💻 computer apps</span>
            <span>🎓 Certificates</span>
            <span>🤖 AI doubt helper</span>
          </div>
        </div>
      )}

      <AnimatePresence>
        {surveyOpen && <SurveyModal onClose={() => setSurveyOpen(false)} />}
      </AnimatePresence>
    </section>
  );
}

const PUZZLES = [
  { code: ['score = 0', 'for star in range(3):', '    score += 10', 'print("Score:", score)'], options: ["Score: 10", "Score: 30", "Score: 3"], answer: 1, out: "Score: 30", why: "The loop runs 3 times and adds 10 each time." },
  { code: ['name = "Aarav"', 'print("Hi " + name + "!")'], options: ['Hi name!', 'Hi Aarav!', 'Hi + Aarav'], answer: 1, out: "Hi Aarav!", why: "+ joins the text pieces together." },
  { code: ['apples = 5', 'apples = apples - 2', 'print(apples)'], options: ["5", "2", "3"], answer: 2, out: "3", why: "5 take away 2 is 3." },
];

/** One quick "guess the output" puzzle with instant feedback and a reward. */
function HeroPuzzle({ onMore }: { onMore: () => void }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [wins, setWins] = useState(0);
  const p = PUZZLES[i % PUZZLES.length];
  const done = picked !== null;
  const right = picked === p.answer;

  const choose = (k: number) => {
    if (done) return;
    setPicked(k);
    if (k === p.answer) setWins((w) => w + 1);
  };

  return (
    <div className="relative flex flex-col items-center lg:items-end">
      {/* Codo, the CodingKida helper, talks to the child (mascot idea from Duolingo / CodeMonkey) */}
      <div className="mb-4 flex items-end gap-3 w-full max-w-md">
        <div className="floating w-16 h-16 shrink-0 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#0EA5E9] border-4 border-white shadow-lg flex items-center justify-center text-3xl" aria-hidden>🤖</div>
        <div className="relative rounded-2xl rounded-bl-none bg-white border-2 border-[#DDD6FE] px-4 py-3 shadow-sm">
          <p className="text-sm font-black text-[#1E1B4B]">
            {done ? (right ? "Yay! You think like a coder! 🎉" : "Good try! Let's see why 👇") : "Hi, I'm Codo! Can you solve this one? 🤔"}
          </p>
        </div>
      </div>
      <div className="relative w-full max-w-md">
      <div className="relative w-full rounded-[28px] bg-[#1E1B4B] p-5 shadow-[0_30px_80px_-20px_rgba(124,58,237,0.55)] border-4 border-white">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#EF4444]" />
          <span className="w-3 h-3 rounded-full bg-[#FFB020]" />
          <span className="w-3 h-3 rounded-full bg-[#22C55E]" />
          <span className="ml-auto rounded-full bg-[#FFD84D] px-3 py-1 text-[11px] font-black text-[#7C2D12]">🎮 Try it! No signup</span>
        </div>
        <p className="mt-4 text-sm font-black text-[#C4B5FD]">What will this code print?</p>
        <pre className="mt-2 font-mono text-[14px] leading-7 text-white overflow-x-auto">{p.code.join("\n")}</pre>

        <div className="mt-4 grid gap-2">
          {p.options.map((o, k) => {
            const s = !done ? "idle" : k === p.answer ? "right" : k === picked ? "wrong" : "idle";
            return (
              <button
                key={o}
                onClick={() => choose(k)}
                disabled={done}
                className={`text-left rounded-xl px-4 py-3 font-mono font-bold border-2 transition-colors ${
                  s === "right" ? "bg-[#22C55E] border-[#86EFAC] text-white"
                  : s === "wrong" ? "bg-[#F43F5E] border-[#FDA4AF] text-white"
                  : "bg-white/10 border-white/15 text-white hover:bg-white/20"
                }`}
              >
                {o}
              </button>
            );
          })}
        </div>

        {done ? (
          <div className="mt-4 rounded-2xl bg-black/30 p-4">
            <p className="font-mono text-sm text-[#86EFAC]">▶ {p.out}</p>
            <p className="mt-1 text-sm text-white/80">{right ? "🎉 Correct! " : "💪 Nearly! "}{p.why}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => { setPicked(null); setI(i + 1); }} className="rounded-xl bg-[#FFD84D] px-4 py-2 text-sm font-black text-[#7C2D12]">Next puzzle →</button>
              <button onClick={onMore} className="rounded-xl bg-white/15 px-4 py-2 text-sm font-black text-white">More games ↓</button>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-center text-xs font-bold text-white/50">Tap an answer to see the output</p>
        )}
      </div>

      {/* reward stickers */}
      <div className={`absolute -top-5 left-2 md:left-8 rotate-[-8deg] rounded-2xl bg-[#FFD84D] px-4 py-2 text-sm font-black text-[#7C2D12] border-b-4 border-[#E0A800] shadow-lg transition-transform ${done && right ? "scale-110" : ""}`}>
        {wins > 0 ? `⭐ ${wins} solved!` : "🥇 Coding Gold!"}
      </div>
      <div className={`absolute -bottom-5 right-2 md:right-6 rotate-[6deg] rounded-2xl bg-[#22C55E] px-4 py-2 text-sm font-black text-white border-b-4 border-[#15803D] shadow-lg transition-all ${done && right ? "scale-125" : ""}`}>
        +{wins * 10 || 30} XP ⭐
      </div>
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { PlayCircle, Sparkles } from "lucide-react";
import SurveyModal from "@/components/SurveyModal";

/** Bright, kid-friendly hero for the home page. */
export default function HomeHero({ courseCount }: { courseCount: number }) {
  const [surveyOpen, setSurveyOpen] = useState(false);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <section id="hero" className="relative overflow-hidden pt-28 pb-16 md:pt-32 md:pb-24 px-5">
      {/* playful background shapes */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 w-80 h-80 rounded-full bg-[#FFD84D]/40 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute top-40 -right-20 w-96 h-96 rounded-full bg-[#8B5CF6]/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute bottom-0 left-1/3 w-72 h-72 rounded-full bg-[#38BDF8]/20 blur-3xl" />

      <div className="relative max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white border-2 border-[#FFD84D] px-4 py-1.5 text-sm font-extrabold text-[#B45309] shadow-sm">
            <Sparkles size={15} /> For Class 4 to 12 · Learn in English
          </span>

          <h1 className="mt-5 text-4xl md:text-6xl font-black leading-[1.08] text-[#1E1B4B]">
            Learn coding the{" "}
            <span className="relative inline-block text-[#7C3AED]">
              fun way
              <svg aria-hidden viewBox="0 0 200 12" className="absolute left-0 -bottom-2 w-full h-3 text-[#FFB020]">
                <path d="M2 9 Q 50 1 100 7 T 198 5" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
              </svg>
            </span>{" "}
            🚀
          </h1>

          <p className="mt-6 text-lg md:text-xl text-[#4B5563] max-w-xl leading-relaxed">
            Watch short videos, answer quizzes, write real code and win <b className="text-[#B45309]">medals 🥇</b>,{" "}
            <b className="text-[#B45309]">coins 🪙</b> and <b className="text-[#7C3AED]">XP ⭐</b> as you level up.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/free-learning"
              className="rounded-2xl bg-[#22C55E] px-7 py-4 text-base md:text-lg font-extrabold text-white border-b-[6px] border-[#15803D] hover:brightness-110 active:translate-y-0.5 active:border-b-2 transition-all"
            >
              Start free 🎈
            </Link>
            <Link
              href="/courses"
              className="rounded-2xl bg-[#7C3AED] px-7 py-4 text-base md:text-lg font-extrabold text-white border-b-[6px] border-[#5B21B6] hover:brightness-110 active:translate-y-0.5 active:border-b-2 transition-all"
            >
              Explore courses 📚
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm font-extrabold">
            <button onClick={() => setSurveyOpen(true)} className="text-[#6D28D9] hover:underline">⚡ Find my course</button>
            <button onClick={() => scrollTo("play")} className="text-[#C2410C] hover:underline">🎮 Try a 30-second puzzle</button>
            <button onClick={() => scrollTo("demo-video")} className="inline-flex items-center gap-1 text-[#1E1B4B] hover:underline">
              <PlayCircle size={16} className="text-[#EF4444]" /> Watch demo
            </button>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {[
              { e: "📚", t: courseCount > 0 ? `${courseCount} courses` : "Real courses" },
              { e: "🧠", t: "Quizzes every lesson" },
              { e: "💻", t: "Real coding practice" },
              { e: "🤖", t: "AI doubt helper" },
            ].map((c) => (
              <span key={c.t} className="inline-flex items-center gap-2 rounded-full bg-white/80 border border-[#EDE9FE] px-4 py-2 text-sm font-bold text-[#374151]">
                <span>{c.e}</span> {c.t}
              </span>
            ))}
          </div>
        </div>

        {/* Right: friendly "code card" with rewards popping out */}
        <div className="relative flex justify-center lg:justify-end">
          <div className="floating relative w-full max-w-md rounded-[28px] bg-[#1E1B4B] p-5 shadow-[0_30px_80px_-20px_rgba(124,58,237,0.55)] border-4 border-white">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-3 h-3 rounded-full bg-[#EF4444]" />
              <span className="w-3 h-3 rounded-full bg-[#FFB020]" />
              <span className="w-3 h-3 rounded-full bg-[#22C55E]" />
              <span className="ml-auto rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-white/80">my_first_game.py</span>
            </div>
            <pre className="font-mono text-[13px] md:text-sm leading-7 text-white overflow-x-auto">
<span className="text-[#C4B5FD]">name</span> = <span className="text-[#86EFAC]">&quot;Aarav&quot;</span>{"\n"}
<span className="text-[#C4B5FD]">score</span> = <span className="text-[#FDE68A]">0</span>{"\n"}
<span className="text-[#F9A8D4]">for</span> star <span className="text-[#F9A8D4]">in</span> <span className="text-[#7DD3FC]">range</span>(<span className="text-[#FDE68A]">3</span>):{"\n"}
{"    "}score += <span className="text-[#FDE68A]">10</span>{"\n"}
<span className="text-[#7DD3FC]">print</span>(<span className="text-[#86EFAC]">&quot;Well done&quot;</span>, name, score){"\n"}
            </pre>
            <div className="mt-4 rounded-2xl bg-black/30 px-4 py-3 font-mono text-sm text-[#86EFAC]">
              ▶ Well done Aarav 30
            </div>
          </div>

          <div className="absolute -top-5 left-2 md:left-8 rotate-[-8deg] rounded-2xl bg-[#FFD84D] px-4 py-2 text-sm font-black text-[#7C2D12] border-b-4 border-[#E0A800] shadow-lg">
            🥇 Coding Gold!
          </div>
          <div className="absolute -bottom-5 right-2 md:right-6 rotate-[6deg] rounded-2xl bg-[#22C55E] px-4 py-2 text-sm font-black text-white border-b-4 border-[#15803D] shadow-lg">
            +30 XP ⭐
          </div>
          <div className="absolute top-1/2 -right-2 md:-right-6 rotate-[10deg] rounded-2xl bg-white px-3 py-2 text-sm font-black text-[#B45309] border-2 border-[#FDE68A] shadow-lg">
            🪙 +10
          </div>
        </div>
      </div>

      <AnimatePresence>
        {surveyOpen && <SurveyModal onClose={() => setSurveyOpen(false)} />}
      </AnimatePresence>
    </section>
  );
}

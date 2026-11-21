"use client";
import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import SurveyModal from "@/components/SurveyModal";

const CLASSES = [
  { label: "Class 4–6", emoji: "🧸", bg: "bg-[#FFE4E6]", edge: "border-[#FDA4AF]", ink: "text-[#BE123C]", text: "Start with logic puzzles, patterns and your very first programs." },
  { label: "Class 7–8", emoji: "🎮", bg: "bg-[#E0F2FE]", edge: "border-[#7DD3FC]", ink: "text-[#0369A1]", text: "Build small games and animations while learning Python basics." },
  { label: "Class 9–10", emoji: "🧪", bg: "bg-[#DCFCE7]", edge: "border-[#86EFAC]", ink: "text-[#15803D]", text: "Java, C and Python with real problems, quizzes and coding tests." },
  { label: "Class 11–12", emoji: "🚀", bg: "bg-[#EDE9FE]", edge: "border-[#C4B5FD]", ink: "text-[#6D28D9]", text: "Data structures, problem solving and project work for the future." },
];

/** "Pick your class" tiles. Each tile opens the course finder. */
export default function ClassPicker() {
  const [open, setOpen] = useState(false);

  return (
    <section id="classes" className="px-5 py-16 md:py-20">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-5xl font-black text-[#1E1B4B]">Which class are you in? 🎒</h2>
          <p className="mt-3 text-lg text-[#6B7280]">Tap your class and we will suggest the right course for you.</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {CLASSES.map((c) => (
            <button
              key={c.label}
              onClick={() => setOpen(true)}
              className={`${c.bg} ${c.edge} text-left rounded-[28px] border-2 border-b-8 p-5 md:p-6 hover:-translate-y-1 active:translate-y-0.5 transition-transform`}
            >
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white flex items-center justify-center text-4xl md:text-5xl shadow-sm">{c.emoji}</div>
              <div className={`mt-4 text-xl md:text-2xl font-black ${c.ink}`}>{c.label}</div>
              <p className="mt-2 text-sm md:text-base text-[#374151] leading-snug">{c.text}</p>
              <div className={`mt-4 text-sm font-extrabold ${c.ink}`}>Find my course →</div>
            </button>
          ))}
        </div>
      </div>
      <AnimatePresence>{open && <SurveyModal onClose={() => setOpen(false)} />}</AnimatePresence>
    </section>
  );
}

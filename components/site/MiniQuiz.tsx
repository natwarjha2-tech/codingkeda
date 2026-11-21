"use client";
import { useState } from "react";

/** One quick question at the end of a tutorial. */
export default function MiniQuiz({ q, options, answer, why }: { q: string; options: string[]; answer: number; why: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  const done = picked !== null;
  const right = picked === answer;

  return (
    <div className="rounded-[28px] bg-[#FFF7E6] border-2 border-[#FDE68A] border-b-8 p-6">
      <p className="text-sm font-black uppercase tracking-wider text-[#B45309]">🧠 Quick quiz</p>
      <h3 className="mt-2 text-xl font-black">{q}</h3>
      <div className="mt-4 grid gap-3">
        {options.map((o, i) => {
          const state = !done ? "idle" : i === answer ? "right" : i === picked ? "wrong" : "idle";
          return (
            <button
              key={o}
              disabled={done}
              onClick={() => setPicked(i)}
              className={`text-left rounded-2xl border-2 px-5 py-3 font-mono font-bold transition-colors ${
                state === "right" ? "bg-[#DCFCE7] border-[#22C55E] text-[#15803D]"
                : state === "wrong" ? "bg-[#FFE4E6] border-[#F43F5E] text-[#BE123C]"
                : "bg-white border-[#E5E7EB] hover:border-[#7C3AED]"
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
      {done && (
        <div className="mt-4">
          <p className={`text-lg font-black ${right ? "text-[#15803D]" : "text-[#BE123C]"}`}>
            {right ? "Correct! 🎉" : "Not quite. 💪"}
          </p>
          <p className="mt-1 text-[#4B5563]">{why}</p>
          {!right && (
            <button onClick={() => setPicked(null)} className="mt-3 rounded-xl bg-white px-4 py-2 font-black text-[#6D28D9] border-2 border-[#DDD6FE]">
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}

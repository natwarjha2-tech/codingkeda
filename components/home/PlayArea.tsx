"use client";
import { useState } from "react";
import Link from "next/link";

/**
 * Homepage Play Area: three tiny games that teach one idea each, with no
 * signup. A) predict the output, B) fill in the missing line, C) move sliders
 * and watch a loop draw.
 */

type Mode = "predict" | "fix" | "visual";

const PREDICT = [
  { code: 'x = 3\ny = x + 4\nprint(y)', options: ["3", "7", "x + 4"], answer: 1, why: "y = 3 + 4, so it prints 7." },
  { code: 'for i in range(3):\n    print("Hi")', options: ["Hi", "Hi Hi Hi (3 lines)", "Error"], answer: 1, why: "range(3) runs the loop 3 times, so Hi is printed 3 times." },
  { code: 'age = 12\nif age >= 13:\n    print("Teen")\nelse:\n    print("Kid")', options: ["Teen", "Kid", "Nothing"], answer: 1, why: "12 is not 13 or more, so the else part runs." },
];

const FIX = [
  {
    before: 'name = "Riya"', after: "", missing: "____",
    goal: "Make the program say: Hello Riya",
    options: ['print("Hello", name)', "print(Hello name)", 'input("Hello")'],
    answer: 0, why: "print shows text. Text goes in quotes; the variable name does not.",
  },
  {
    before: "total = 0\nfor n in [5, 10, 15]:", after: "print(total)", missing: "    ____",
    goal: "Make it print 30 (the sum of the numbers)",
    options: ["    total = n", "    total = total + n", "    print(n)"],
    answer: 1, why: "Adding each n to total gives 5 + 10 + 15 = 30.",
  },
];

const SHAPES = ["⭐", "🍎", "🚀", "🐱"];

export default function PlayArea() {
  const [mode, setMode] = useState<Mode>("predict");
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  // visual mode
  const [count, setCount] = useState(4);
  const [rows, setRows] = useState(2);
  const [shape, setShape] = useState(0);

  const list = mode === "predict" ? PREDICT : FIX;
  const item = mode === "visual" ? null : list[step % list.length];
  const done = picked !== null;
  const right = item ? picked === item.answer : false;

  const choose = (i: number) => {
    if (done || !item) return;
    setPicked(i);
    if (i === item.answer) setScore((s) => s + 1);
  };
  const next = () => { setPicked(null); setStep((s) => s + 1); };
  const switchMode = (m: Mode) => { setMode(m); setStep(0); setPicked(null); };

  return (
    <section id="play" className="px-5 py-16 md:py-20 bg-[#F5F3FF]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <span className="inline-block rounded-full bg-[#FFD84D] px-4 py-1.5 text-sm font-black text-[#7C2D12]">🎮 Play area · no signup</span>
          <h2 className="mt-3 text-3xl md:text-5xl font-black text-[#1E1B4B]">Can you think like a coder?</h2>
          <p className="mt-3 text-lg text-[#6B7280]">Try a 30-second puzzle. You will learn something new!</p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-6" role="tablist">
          {([
            ["predict", "🤔 Guess the output"],
            ["fix", "🧩 Fill the missing line"],
            ["visual", "🎨 Make it draw"],
          ] as [Mode, string][]).map(([m, label]) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => switchMode(m)}
              className={`rounded-full px-5 py-3 font-extrabold border-2 ${mode === m ? "bg-[#7C3AED] border-[#7C3AED] text-white" : "bg-white border-[#E5E7EB] text-[#374151] hover:border-[#C4B5FD]"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="rounded-[32px] bg-white border-2 border-[#DDD6FE] border-b-[10px] p-5 md:p-8">
          {mode !== "visual" && item ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <div>
                <p className="text-sm font-black uppercase tracking-wider text-[#6D28D9]">
                  {mode === "predict" ? "What will this print?" : (item as (typeof FIX)[number]).goal}
                </p>
                <pre className="mt-3 rounded-[20px] bg-[#1E1B4B] p-5 font-mono text-[15px] leading-7 text-white overflow-x-auto">
                  {mode === "predict" ? (item as (typeof PREDICT)[number]).code : (
                    <>
                      {(item as (typeof FIX)[number]).before}{"\n"}
                      <span className={done ? (right ? "text-[#86EFAC]" : "text-[#FCA5A5]") : "text-[#FFD84D]"}>
                        {done ? (item as (typeof FIX)[number]).options[picked!] : (item as (typeof FIX)[number]).missing}
                      </span>
                      {(item as (typeof FIX)[number]).after ? <>{"\n"}{(item as (typeof FIX)[number]).after}</> : null}
                    </>
                  )}
                </pre>
                <p className="mt-3 text-sm font-bold text-[#6B7280]">Score: {score} ⭐ · Puzzle {(step % list.length) + 1} of {list.length}</p>
              </div>

              <div>
                <div className="grid gap-3">
                  {item.options.map((o, i) => {
                    const state = !done ? "idle" : i === item.answer ? "right" : i === picked ? "wrong" : "idle";
                    return (
                      <button
                        key={o}
                        onClick={() => choose(i)}
                        disabled={done}
                        className={`text-left rounded-2xl border-2 px-5 py-4 font-mono font-bold text-[15px] transition-colors ${
                          state === "right" ? "bg-[#DCFCE7] border-[#22C55E] text-[#15803D]"
                          : state === "wrong" ? "bg-[#FFE4E6] border-[#F43F5E] text-[#BE123C]"
                          : "bg-[#FAFAFF] border-[#E5E7EB] hover:border-[#7C3AED]"
                        }`}
                      >
                        {o}
                      </button>
                    );
                  })}
                </div>
                {done && (
                  <div className="mt-5 rounded-2xl bg-[#FFF7E6] p-4">
                    <p className={`text-lg font-black ${right ? "text-[#15803D]" : "text-[#BE123C]"}`}>{right ? "Correct! 🎉" : "Almost! 💪"}</p>
                    <p className="text-[#4B5563]">{item.why}</p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button onClick={next} className="rounded-xl bg-[#7C3AED] px-5 py-2 font-black text-white">Next puzzle →</button>
                      <Link href="/free-learning" className="rounded-xl bg-white px-5 py-2 font-black text-[#6D28D9] border-2 border-[#DDD6FE]">Learn this properly</Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <div>
                <p className="text-sm font-black uppercase tracking-wider text-[#6D28D9]">Move the sliders. The code changes, and so does the picture!</p>
                <pre className="mt-3 rounded-[20px] bg-[#1E1B4B] p-5 font-mono text-[15px] leading-7 text-white overflow-x-auto">
<span className="text-[#F9A8D4]">for</span> row <span className="text-[#F9A8D4]">in</span> <span className="text-[#7DD3FC]">range</span>(<span className="text-[#FFD84D]">{rows}</span>):{"\n"}
{"    "}<span className="text-[#7DD3FC]">print</span>(<span className="text-[#86EFAC]">&quot;{SHAPES[shape]}&quot;</span> * <span className="text-[#FFD84D]">{count}</span>)
                </pre>
                <div className="mt-5 space-y-4">
                  <label className="block">
                    <span className="font-black">How many in a row: {count}</span>
                    <input type="range" min={1} max={8} value={count} onChange={(e) => setCount(+e.target.value)} className="mt-2 w-full accent-[#7C3AED]" />
                  </label>
                  <label className="block">
                    <span className="font-black">How many rows: {rows}</span>
                    <input type="range" min={1} max={5} value={rows} onChange={(e) => setRows(+e.target.value)} className="mt-2 w-full accent-[#F97316]" />
                  </label>
                  <div className="flex gap-2">
                    {SHAPES.map((s, i) => (
                      <button key={s} onClick={() => setShape(i)} aria-label={`Use ${s}`}
                        className={`w-12 h-12 rounded-xl text-2xl border-2 ${shape === i ? "border-[#7C3AED] bg-[#EDE9FE]" : "border-[#E5E7EB] bg-white"}`}>{s}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-wider text-[#15803D]">Output</p>
                <div className="mt-3 min-h-[220px] rounded-[20px] bg-[#0F0D2E] p-5" aria-live="polite">
                  {Array.from({ length: rows }, (_, r) => (
                    <div key={r} className="text-3xl leading-[1.4] tracking-wide">{SHAPES[shape].repeat(count)}</div>
                  ))}
                </div>
                <p className="mt-3 text-[#4B5563]">
                  🧠 You just used a <b>loop</b>: <code className="font-mono">range({rows})</code> repeats the line {rows} time{rows === 1 ? "" : "s"}, and{" "}
                  <code className="font-mono">* {count}</code> repeats the picture {count} time{count === 1 ? "" : "s"}.
                </p>
                <Link href="/learn/python/loops" className="mt-3 inline-block rounded-xl bg-[#22C55E] px-5 py-2 font-black text-white">Learn loops →</Link>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 text-center">
          <Link href="/free-learning" className="inline-block rounded-2xl bg-[#7C3AED] px-8 py-4 text-lg font-black text-white border-b-[6px] border-[#5B21B6] hover:brightness-110">
            Enjoyed it? Try a free lesson →
          </Link>
        </div>
      </div>
    </section>
  );
}

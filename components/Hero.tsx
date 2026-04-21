"use client";
import Link from "next/link";
import { ArrowRight, PlayCircle, Zap, Code2, BrainCircuit, Rocket } from "lucide-react";

export default function Hero() {
  return (
    <section className="min-h-screen flex items-center pt-20 pb-12 px-6 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row items-center gap-16 w-full">

        {/* Left */}
        <div className="flex-1">
          <div className="inline-flex items-center gap-2 bg-purple-500/15 border border-purple-500/30 text-purple-300 px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
            ⚡ Your Gateway to Tech Excellence
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-5">
            Beyond Coding<br />
            <span className="gradient-text">Into Intelligence</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-lg mb-8">
            Transform your career with <strong className="text-white">CodingKeda</strong>. Master Java, Python, Web Dev, DSA & AI through hands-on projects and expert mentorship.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-4 mb-10">
            <Link href="/signup" className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-7 py-3.5 rounded-xl transition-all hover:-translate-y-0.5">
              Start Learning Free <ArrowRight size={18} />
            </Link>
            <Link href="#free-video" scroll={true} className="inline-flex items-center gap-2 bg-white/8 hover:bg-white/14 text-white font-semibold px-7 py-3.5 rounded-xl transition-all">
              <PlayCircle size={18} /> Watch Free Lesson
            </Link>
          </div>

          {/* Value pills */}
          <div className="flex flex-wrap gap-3">
            {[
              { icon: <Code2 size={14} />, text: "Hands-on Projects" },
              { icon: <BrainCircuit size={14} />, text: "DSA + AI Focused" },
              { icon: <Zap size={14} />, text: "Learn by Doing" },
              { icon: <Rocket size={14} />, text: "Career Focused" },
            ].map((p) => (
              <span key={p.text} className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 text-slate-300 text-xs font-medium px-3 py-1.5 rounded-full">
                <span className="text-purple-400">{p.icon}</span> {p.text}
              </span>
            ))}
          </div>
        </div>

        {/* Right – Pseudo Code Card only */}
        <div className="flex-1 flex justify-center items-center">
          <div className="floating bg-[#16213e] border border-white/8 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            {/* Window dots */}
            <div className="flex gap-1.5 mb-5">
              <span className="w-3 h-3 rounded-full bg-red-400" />
              <span className="w-3 h-3 rounded-full bg-yellow-400" />
              <span className="w-3 h-3 rounded-full bg-green-400" />
              <span className="ml-auto text-slate-500 text-xs font-mono">HelloCodingKeda.java</span>
            </div>
            <pre className="font-mono text-sm leading-7 overflow-x-auto">
<span className="text-purple-400">public class </span><span className="text-cyan-300">HelloCodingKeda </span><span className="text-white">{"{"}</span>{"\n"}
{"  "}<span className="text-purple-400">public static void </span><span className="text-yellow-300">main</span><span className="text-white">(String[] args) {"{"}</span>{"\n"}
{"    "}<span className="text-slate-500">// 🚀 Your journey starts here</span>{"\n"}
{"    "}<span className="text-white">String dream = </span><span className="text-green-300">"Software Engineer"</span><span className="text-white">;</span>{"\n"}
{"    "}<span className="text-white">String path  = </span><span className="text-green-300">"CodingKeda"</span><span className="text-white">;</span>{"\n"}
{"    "}<span className="text-slate-500">// Learn → Build → Get Placed</span>{"\n"}
{"    "}<span className="text-white">System.out.println(</span><span className="text-green-300">"Welcome! 🎯"</span><span className="text-white">);</span>{"\n"}
{"  "}<span className="text-white">{"}"}</span>{"\n"}
<span className="text-white">{"}"}</span>
            </pre>
            {/* Output terminal */}
            <div className="mt-4 bg-[#0f0f1a] rounded-lg px-4 py-3 font-mono text-xs">
              <span className="text-green-400">▶ Output: </span>
              <span className="text-white">Welcome! 🎯</span>
              <span className="animate-pulse text-green-400 ml-1">|</span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

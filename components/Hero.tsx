"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Zap, CheckCircle, Users, Star, BookOpen, PlayCircle } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import SurveyModal from "./SurveyModal";

const COMPANIES = ["TCS", "Google", "Amazon", "Infosys", "Wipro", "Microsoft", "Flipkart", "Volvo"];

function TypewriterText() {
  const [companyIndex, setCompanyIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const current = COMPANIES[companyIndex];
    let timeout: ReturnType<typeof setTimeout>;

    if (!isDeleting && displayed.length < current.length) {
      timeout = setTimeout(() => setDisplayed(current.slice(0, displayed.length + 1)), 100);
    } else if (!isDeleting && displayed.length === current.length) {
      timeout = setTimeout(() => setIsDeleting(true), 1500);
    } else if (isDeleting && displayed.length > 0) {
      timeout = setTimeout(() => setDisplayed(current.slice(0, displayed.length - 1)), 60);
    } else if (isDeleting && displayed.length === 0) {
      setIsDeleting(false);
      setCompanyIndex((i) => (i + 1) % COMPANIES.length);
    }

    return () => clearTimeout(timeout);
  }, [displayed, isDeleting, companyIndex]);

  return (
    <span className="gradient-text whitespace-nowrap">
      Get Placed at{" "}
      <span className="inline-block min-w-[3ch]">
        {displayed}<span className="animate-pulse text-current">|</span>
      </span>
    </span>
  );
}

export default function Hero() {
  const [surveyOpen, setSurveyOpen] = useState(false);

  return (
    <section id="hero" className="min-h-screen flex items-start md:items-center pt-24 md:pt-16 pb-12 px-6">
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

        {/* ── LEFT: Content ── */}
        <div className="flex flex-col items-start">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-purple-500/15 border border-purple-500/30 text-purple-300 px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
            <Zap size={14} /> India&apos;s #1 Coding Platform for Students
          </div>

          {/* Heading */}
          <h1 className="text-[1.5rem] md:text-5xl lg:text-[3.2rem] font-extrabold leading-tight mb-5 md:mt-0 min-h-[8rem] md:min-h-0 overflow-hidden">
            Learn to Code.<br />
            <span className="gradient-text">Build Real Projects.</span><br />
            <TypewriterText />
          </h1>

          {/* Subtext */}
          <p className="text-slate-400 text-lg mb-8 max-w-lg">
            Get a <strong className="text-white">structured roadmap</strong> + real projects from Day 1. No confusion, no overwhelm — just clear progress.
          </p>

          {/* CTA Buttons */}
          <div className="w-full grid grid-cols-2 gap-3 md:flex md:flex-wrap md:gap-4 mb-6">
            <button
              onClick={() => setSurveyOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 md:px-8 py-3 md:py-4 rounded-xl transition-all hover:-translate-y-0.5 text-xs md:text-base shadow-lg shadow-purple-500/25 whitespace-nowrap"
            >
              <Zap size={14} className="md:hidden" /><Zap size={18} className="hidden md:block" /> Find My Course ⚡
            </button>
            <Link
              href="#free-video"
              onClick={(e) => { e.preventDefault(); document.getElementById("free-video")?.scrollIntoView({ behavior: "smooth" }); }}
              className="inline-flex items-center justify-center gap-1.5 bg-white/8 hover:bg-white/14 text-white font-semibold px-4 md:px-7 py-3 md:py-4 rounded-xl transition-all text-xs md:text-base border border-white/10 whitespace-nowrap"
            >
              <PlayCircle size={14} className="md:hidden" /><PlayCircle size={18} className="hidden md:block" /> Watch Demo
            </Link>
          </div>

          {/* Feature Chips */}
          <div className="w-full grid grid-cols-2 gap-2 md:flex md:flex-wrap mb-10">
            {[
              { icon: <CheckCircle size={13} />, text: "5,000+ Students" },
              { icon: <CheckCircle size={13} />, text: "Beginner Friendly" },
              { icon: <CheckCircle size={13} />, text: "Learn → Practice → Build" },
              { icon: <CheckCircle size={13} />, text: "Free to Start" },
            ].map((p) => (
              <span key={p.text} className="inline-flex items-center justify-center gap-1.5 bg-white/5 border border-white/10 text-slate-300 text-xs font-medium px-3 py-1.5 rounded-full">
                <span className="text-green-400">{p.icon}</span> {p.text}
              </span>
            ))}
          </div>

          {/* Stats Row */}
          <div className="w-full grid grid-cols-3 gap-2 md:flex md:items-center md:gap-8">
            {[
              { icon: <Users size={16} className="text-purple-400 md:w-[18px] md:h-[18px]" />, value: "5,000+", label: "Students" },
              { icon: <BookOpen size={16} className="text-orange-400 md:w-[18px] md:h-[18px]" />, value: "20+", label: "Courses" },
              { icon: <Star size={16} className="text-yellow-400 md:w-[18px] md:h-[18px]" />, value: "4.8★", label: "Rating" },
            ].map((s, i) => (
              <div key={s.label} className="flex flex-col items-center md:flex-row md:items-center gap-1 md:gap-2">
                {i > 0 && <div className="hidden md:block w-px h-8 bg-white/10 mr-6" />}
                <div className="text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-1 mb-0.5">{s.icon}<span className="text-sm md:text-lg font-extrabold text-white">{s.value}</span></div>
                  <div className="text-slate-500 text-[10px] md:text-xs">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* ── RIGHT: Code Editor ── */}
        <div className="flex justify-center lg:justify-end">
          <div className="floating w-full max-w-lg bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            style={{ boxShadow: "0 24px 80px rgba(124,58,237,0.2), 0 0 0 1px rgba(255,255,255,0.06)" }}>

            {/* Editor top bar */}
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/8 bg-white/3">
              <span className="w-3 h-3 rounded-full bg-red-400" />
              <span className="w-3 h-3 rounded-full bg-yellow-400" />
              <span className="w-3 h-3 rounded-full bg-green-400" />
              <span className="ml-auto text-slate-500 text-xs font-mono">HelloCodingKeda.java</span>
            </div>

            {/* Code block */}
            <div className="px-4 md:px-6 py-5">
              <pre className="font-mono text-[11px] md:text-sm leading-6 md:leading-7 overflow-x-auto">
<span className="text-purple-400">public class </span><span className="text-cyan-300">HelloCodingKeda </span><span className="text-white">{"{"}</span>{"\n"}
{"  "}<span className="text-purple-400">public static void </span><span className="text-yellow-300">main</span><span className="text-white">(String[] args) {"{"}</span>{"\n"}
{"    "}<span className="text-slate-500">// 🚀 Your journey starts here</span>{"\n"}
{"    "}<span className="text-white">String dream = </span><span className="text-green-300">"Software Engineer"</span><span className="text-white">;</span>{"\n"}
{"    "}<span className="text-cyan-400">String platform = </span><span className="text-green-300">"CodingKeda"</span><span className="text-white">;</span>{"\n"}
{"    "}<span className="text-white">System.out.println(</span><span className="text-green-300">"Welcome! 🎯"</span><span className="text-white">);</span>{"\n"}
{"    "}<span className="text-white">System.out.println(</span><span className="text-green-300">"Let's build your future!"</span><span className="text-white">);</span>{"\n"}
{"  "}<span className="text-white">{"}"}</span>{"\n"}
<span className="text-white">{"}"}</span>
              </pre>

              {/* Output terminal */}
              <div className="mt-5 bg-[#020817] rounded-xl px-4 py-3 font-mono text-xs border border-white/6">
                <div className="text-slate-500 mb-2 text-[10px] uppercase tracking-widest">Terminal</div>
                <div><span className="text-green-400">▶ </span><span className="text-white">Welcome! 🎯</span></div>
                <div><span className="text-green-400">▶ </span><span className="text-white">Let&apos;s build your future!</span><span className="animate-pulse text-green-400 ml-1">|</span></div>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="px-5 py-3 border-t border-white/6 bg-white/2 flex items-center justify-between">
              <span className="text-[10px] text-slate-600 font-mono">Java • UTF-8</span>
              <span className="text-[10px] text-green-500 font-semibold">● Compiled successfully</span>
            </div>
          </div>
        </div>

      </div>

      {/* Survey Modal */}
      <AnimatePresence>
        {surveyOpen && <SurveyModal onClose={() => setSurveyOpen(false)} />}
      </AnimatePresence>
    </section>
  );
}

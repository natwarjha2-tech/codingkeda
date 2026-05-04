"use client";
import Link from "next/link";
import { ArrowRight, PlayCircle, Zap, CheckCircle, Users, Star, BookOpen, Monitor } from "lucide-react";

export default function Hero() {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center pt-20 pb-12 px-6 max-w-7xl mx-auto">

      {/* Badge */}
      <div className="inline-flex items-center gap-2 bg-purple-500/15 border border-purple-500/30 text-purple-300 px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
        <Zap size={14} /> India&apos;s #1 Coding Platform for Students
      </div>

      {/* Headline */}
      <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-5 text-center max-w-4xl">
        Learn to Code.<br />
        <span className="gradient-text">Build Real Projects. Get Placed.</span>
      </h1>

      <p className="text-slate-400 text-lg max-w-2xl mb-8 text-center">
        Get a <strong className="text-white">structured roadmap</strong> + real projects from Day 1. No confusion, no overwhelm — just clear progress.
      </p>

      {/* CTA Buttons */}
      <div className="flex flex-wrap gap-4 mb-6 justify-center">
        <Link
          href="#survey"
          onClick={(e) => { e.preventDefault(); document.getElementById("survey")?.scrollIntoView({ behavior: "smooth" }); }}
          className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold px-8 py-4 rounded-xl transition-all hover:-translate-y-0.5 text-lg shadow-lg shadow-purple-500/25"
        >
          <Zap size={20} /> Find My Course ⚡
        </Link>
        <Link
          href="#free-video"
          onClick={(e) => { e.preventDefault(); document.getElementById("free-video")?.scrollIntoView({ behavior: "smooth" }); }}
          className="inline-flex items-center gap-2 bg-white/8 hover:bg-white/14 text-white font-semibold px-7 py-4 rounded-xl transition-all text-lg"
        >
          <PlayCircle size={20} /> Watch Demo
        </Link>
      </div>

      {/* Find My Course hint */}
      <p className="text-slate-500 text-sm mb-8">Answer 3 quick questions → Get your personalized roadmap ✨</p>

      {/* Trust Pills */}
      <div className="flex flex-wrap gap-3 justify-center mb-12">
        {[
          { icon: <CheckCircle size={14} />, text: "5,000+ Students" },
          { icon: <CheckCircle size={14} />, text: "Beginner Friendly" },
          { icon: <CheckCircle size={14} />, text: "Learn → Practice → Build" },
          { icon: <CheckCircle size={14} />, text: "Free to Start" },
        ].map((p) => (
          <span key={p.text} className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 text-slate-300 text-sm font-medium px-4 py-2 rounded-full">
            <span className="text-green-400">{p.icon}</span> {p.text}
          </span>
        ))}
      </div>

      {/* Trust Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full max-w-3xl mb-16">
        {[
          { icon: <Users size={22} className="text-purple-400" />, value: "5,000+", label: "Students" },
          { icon: <BookOpen size={22} className="text-orange-400" />, value: "20+", label: "Courses" },
          { icon: <Star size={22} className="text-yellow-400" />, value: "4.8★", label: "Rating" },
          { icon: <Monitor size={22} className="text-green-400" />, value: "Desktop", label: "App Available" },
        ].map((s) => (
          <div key={s.label} className="bg-[#16213e] border border-white/8 rounded-2xl p-5 text-center">
            <div className="flex justify-center mb-2">{s.icon}</div>
            <div className="text-2xl font-extrabold text-white">{s.value}</div>
            <div className="text-slate-400 text-sm">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Code Card */}
      <div className="floating bg-[#16213e] border border-white/8 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
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
{"    "}<span className="text-white">System.out.println(</span><span className="text-green-300">"Welcome! 🎯"</span><span className="text-white">);</span>{"\n"}
{"  "}<span className="text-white">{"}"}</span>{"\n"}
<span className="text-white">{"}"}</span>
        </pre>
        <div className="mt-4 bg-[#0f0f1a] rounded-lg px-4 py-3 font-mono text-xs">
          <span className="text-green-400">▶ Output: </span>
          <span className="text-white">Welcome! 🎯</span>
          <span className="animate-pulse text-green-400 ml-1">|</span>
        </div>
      </div>

    </section>
  );
}

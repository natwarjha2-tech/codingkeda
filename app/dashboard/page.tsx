"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpen, Zap, ArrowRight, Lock, Compass } from "lucide-react";
import Navbar from "@/components/Navbar";
import { getToken } from "@/services/auth";

const COURSE_INFO: Record<string, { emoji: string; tag: string; desc: string }> = {
  "ZenZ Package":    { emoji: "🌟", tag: "Class 4–8",  desc: "Scratch & Python basics, games, animations, and more." },
  "ZenAlpha Package":{ emoji: "⚡", tag: "Class 9–12", desc: "DSA, web & app development, career-ready skills." },
};

const EXPLORE_CARDS = [
  { icon: "📚", title: "Intro to Coding",   desc: "Start your first lesson today" },
  { icon: "🎮", title: "Mini Projects",      desc: "Build something fun right away" },
  { icon: "🧠", title: "Concept Quizzes",   desc: "Test what you've learned" },
  { icon: "🔍", title: "Explore Courses",   desc: "Browse all available programs" },
];

const PREMIUM_FEATURES = [
  { title: "Advanced Projects", desc: "Real-world builds" },
  { title: "AI Labs",           desc: "Hands-on AI experiments" },
  { title: "Mentor Access",     desc: "1-on-1 guidance sessions" },
];

export default function Dashboard() {
  const router = useRouter();
  const [course, setCourse] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setCourse(localStorage.getItem("recommendedCourse") || null);
    setReady(true);
  }, [router]);

  if (!ready) return null;

  const isPersonalized = !!course;
  const info = course ? COURSE_INFO[course] : null;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0f0f1a] px-6 py-10 pt-24">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }} className="mb-10">
          {isPersonalized ? (
            <>
              <h1 className="text-3xl font-extrabold text-white mb-1">Welcome back 👋</h1>
              <p className="text-slate-400 text-sm">Your personalized learning journey starts here.</p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-extrabold text-white mb-1">Start Your Coding Journey 🚀</h1>
              <p className="text-slate-400 text-sm">Explore coding, projects, quizzes and fun learning paths.</p>
            </>
          )}
        </motion.div>

        {/* Hero card — Start Free users only */}
        {!isPersonalized && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl p-7 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
            style={{ background: "linear-gradient(135deg,rgba(124,58,237,0.18),rgba(236,72,153,0.08))", border: "1px solid rgba(124,58,237,0.25)" }}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-2">✦ Get Started</p>
              <h2 className="text-xl font-extrabold text-white mb-1">Explore Courses 😎</h2>
              <p className="text-slate-400 text-sm">Discover coding, AI, web development and more.</p>
            </div>
            <Link href="/"
              onClick={() => setTimeout(() => document.getElementById("survey")?.scrollIntoView({ behavior: "smooth" }), 100)}
              className="flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white text-sm"
              style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)", boxShadow: "0 4px 16px rgba(124,58,237,0.35)" }}>
              Find My Course 🚀
            </Link>
          </motion.div>
        )}

        {/* Personalized path — Find My Course users only */}
        {isPersonalized && info && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl p-6 mb-6 border border-purple-500/20"
            style={{ background: "rgba(124,58,237,0.12)", backdropFilter: "blur(12px)" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-3">
              ✦ Your Recommended Path
            </p>
            <div className="flex items-center gap-4">
              <span className="text-4xl">{info.emoji}</span>
              <div className="flex-1">
                <h2 className="text-xl font-extrabold text-white">{course}</h2>
                <p className="text-slate-400 text-xs mt-0.5">{info.tag} · {info.desc}</p>
              </div>
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-white text-xs"
                style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}>
                Continue <ArrowRight size={13} />
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Explore section — shown to all, heading differs */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: isPersonalized ? 0.2 : 0.1 }} className="mb-6">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2">
            {isPersonalized
              ? <><BookOpen size={16} className="text-purple-400" /> Continue Exploring</>
              : <><Compass size={16} className="text-purple-400" /> Start Your Learning Adventure 😎</>
            }
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {EXPLORE_CARDS.map((f, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.06 }}
                whileHover={{ scale: 1.03, y: -2 }}
                className="bg-[#16213e] border border-white/8 rounded-2xl p-5 cursor-pointer transition-all duration-200">
                <span className="text-2xl mb-3 block">{f.icon}</span>
                <p className="text-white font-semibold text-sm">{f.title}</p>
                <p className="text-slate-500 text-xs mt-1">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Find My Course CTA — only for Start Free users */}
        {!isPersonalized && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="rounded-2xl p-6 mb-6 border border-purple-500/20 flex items-center justify-between"
            style={{ background: "rgba(124,58,237,0.08)" }}>
            <div>
              <p className="text-white font-bold mb-1">Not sure where to start?</p>
              <p className="text-slate-400 text-sm">Take a quick survey and get a personalized course recommendation.</p>
            </div>
            <Link href="/"
              onClick={() => setTimeout(() => document.getElementById("survey")?.scrollIntoView({ behavior: "smooth" }), 100)}
              className="flex-shrink-0 ml-4 flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-white text-sm"
              style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}>
              Find My Course <ArrowRight size={14} />
            </Link>
          </motion.div>
        )}

        {/* Premium locked features */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: isPersonalized ? 0.3 : 0.45 }}
          className="rounded-2xl p-6 border border-white/8"
          style={{ background: "rgba(124,58,237,0.06)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold flex items-center gap-2">
              <Zap size={16} className="text-yellow-400" /> Upgrade to Pro
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded-full">
              Coming Soon
            </span>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {PREMIUM_FEATURES.map((f, i) => (
              <div key={i} className="bg-white/3 border border-white/6 rounded-xl p-4 opacity-60">
                <div className="flex items-center gap-2 mb-1">
                  <Lock size={13} className="text-slate-500" />
                  <p className="font-semibold text-sm text-slate-300">{f.title}</p>
                </div>
                <p className="text-slate-600 text-xs">{f.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-slate-500 text-xs mt-4 text-center">
            Premium features coming soon. Keep learning to unlock them! 🚀
          </p>
        </motion.div>

      </div>
      </main>
    </>
  );
}

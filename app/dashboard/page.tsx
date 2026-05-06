"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Zap, Lock, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import { getToken } from "@/services/auth";

const COURSES = [
  {
    key: "ZenZ Package",
    name: "ZenZ", tag: "For Class 4–8", emoji: "🌟",
    desc: "A fun, beginner-friendly coding journey designed for young learners.",
    features: ["Scratch & Python basics", "Build games & animations", "Live mentor support", "Certificate on completion", "Lifetime access", "Mobile-friendly content"],
    price: "₹499", original: "₹2,499",
    glow: "rgba(168,85,247,0.35)",
    border: "rgba(168,85,247,0.3)",
  },
  {
    key: "ZenAlpha Package",
    name: "ZenAlpha", tag: "For Class 9–12", emoji: "⚡",
    desc: "Advanced coding curriculum for high schoolers ready to go deep.",
    features: ["DSA & real-world projects", "Web & App development", "Career-ready skills", "Industry certificate", "Lifetime access", "1-on-1 doubt sessions"],
    price: "₹599", original: "₹2,999",
    glow: "rgba(99,102,241,0.35)",
    border: "rgba(99,102,241,0.3)",
  },
];

const PREMIUM_FEATURES = [
  { title: "Advanced Projects", desc: "Real-world builds" },
  { title: "AI Labs",           desc: "Hands-on AI experiments" },
  { title: "Mentor Access",     desc: "1-on-1 guidance sessions" },
];

export default function Dashboard() {
  const router = useRouter();
  const [recommendedCourse, setRecommendedCourse] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setRecommendedCourse(localStorage.getItem("recommendedCourse") || null);
    setReady(true);
  }, [router]);

  if (!ready) return null;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0f0f1a] px-6 py-10 pt-24">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }} className="mb-10">
            <h1 className="text-3xl font-extrabold text-white mb-1">
              {recommendedCourse ? "Welcome back 👋" : "Start Your Coding Journey 🚀"}
            </h1>
            <p className="text-slate-400 text-sm">
              {recommendedCourse
                ? "Your recommended course is highlighted below."
                : "Choose a course that fits you best."}
            </p>
          </motion.div>

          {/* Course Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-10">
            {COURSES.map((course, i) => {
              const isRecommended = recommendedCourse === course.key;
              return (
                <motion.div key={course.key}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.1 }}
                  className="rounded-3xl p-6 flex flex-col relative"
                  style={{
                    background: "linear-gradient(135deg,rgba(124,58,237,0.18),rgba(236,72,153,0.08))",
                    border: `1px solid ${isRecommended ? "rgba(124,58,237,0.6)" : course.border}`,
                    boxShadow: isRecommended ? `0 0 30px ${course.glow}` : "none",
                  }}
                >
                  {/* Recommended badge */}
                  {isRecommended && (
                    <span className="absolute -top-3 left-5 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                      style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)", color: "white" }}>
                      ✦ Recommended for You
                    </span>
                  )}

                  {/* Course header */}
                  <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/8">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)" }}>
                      {course.emoji}
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-extrabold text-white">{course.name}</h2>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(124,58,237,0.2)", color: "#c4b5fd" }}>
                        {course.tag}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-extrabold text-white">{course.price}</p>
                      <p className="text-xs text-slate-500 line-through">{course.original}</p>
                      <span className="text-[10px] font-bold text-green-400">80% OFF</span>
                    </div>
                  </div>

                  <p className="text-slate-300 text-sm mb-4">{course.desc}</p>

                  {/* Features */}
                  <ul className="space-y-2 mb-6 flex-1">
                    {course.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm text-slate-300">
                        <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: "rgba(124,58,237,0.25)" }}>
                          <Check size={8} strokeWidth={3} className="text-purple-300" />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <motion.button
                    whileHover={{ scale: 1.03, boxShadow: "0 12px 36px rgba(124,58,237,0.5)" }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => router.push(`/payment?package=${encodeURIComponent(course.name)}`)}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white text-sm"
                    style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)", boxShadow: "0 6px 24px rgba(124,58,237,0.35)" }}
                  >
                    Subscribe Now {course.price} <ArrowRight size={14} />
                  </motion.button>
                </motion.div>
              );
            })}
          </div>

          {/* Premium locked features */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
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

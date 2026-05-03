"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Sparkles, ArrowRight } from "lucide-react";

const COURSES = {
  zenz: {
    name: "ZenZ Package", tag: "For Class 4–8", emoji: "🌟",
    desc: "A fun, beginner-friendly coding journey designed for young learners.",
    features: ["Scratch & Python basics", "Build games & animations", "Live mentor support", "Certificate on completion", "Lifetime access", "Mobile-friendly content"],
    price: "₹499", original: "₹2,499",
    glow: "rgba(168,85,247,0.35)",
  },
  zenalpha: {
    name: "ZenAlpha Package", tag: "For Class 9–12", emoji: "⚡",
    desc: "Advanced coding curriculum for high schoolers ready to go deep.",
    features: ["DSA & real-world projects", "Web & App development", "Career-ready skills", "Industry certificate", "Lifetime access", "1-on-1 doubt sessions"],
    price: "₹599", original: "₹2,999",
    glow: "rgba(99,102,241,0.35)",
  },
};

export default function RecommendationPage() {
  const router = useRouter();
  const [course, setCourse] = useState<typeof COURSES.zenz | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("surveyAnswers");
    if (raw) {
      const answers = JSON.parse(raw);
      setCourse(answers.classGroup === "4-8" ? COURSES.zenz : COURSES.zenalpha);
    } else {
      // No survey answers — redirect back to homepage survey
      router.replace("/");
      setTimeout(() => document.getElementById("survey")?.scrollIntoView({ behavior: "smooth" }), 400);
    }
    setLoaded(true);
  }, [router]);

  if (!loaded || !course) return null;

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg,#0a0118 0%,#0d0221 60%,#0f0f1a 100%)" }}>

      {/* Blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle,rgba(124,58,237,0.12) 0%,transparent 70%)", filter: "blur(60px)" }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle,rgba(236,72,153,0.08) 0%,transparent 70%)", filter: "blur(60px)" }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <Sparkles size={16} className="text-purple-400" />
          <p className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "rgba(167,139,250,0.8)" }}>
            Your Personalized Recommendation 🎯
          </p>
        </div>

        {/* Course card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-3xl p-7 mb-5"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(124,58,237,0.25)",
            backdropFilter: "blur(20px)",
            boxShadow: `0 24px 80px rgba(0,0,0,0.5), 0 0 40px ${course.glow}`,
          }}
        >
          {/* Course header */}
          <div className="flex items-center gap-4 mb-4 pb-4 border-b border-white/8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
              style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)" }}>
              {course.emoji}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-extrabold text-white">{course.name}</h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(124,58,237,0.2)", color: "#c4b5fd" }}>
                {course.tag}
              </span>
            </div>
            <div className="text-right">
              <p className="text-xl font-extrabold text-white">{course.price}</p>
              <p className="text-xs text-slate-500 line-through">{course.original}</p>
              <span className="text-[10px] font-bold text-green-400">80% OFF</span>
            </div>
          </div>

          <p className="text-slate-300 text-sm mb-5">{course.desc}</p>

          {/* Features */}
          <ul className="space-y-2.5 mb-6">
            {course.features.map((f, i) => (
              <motion.li key={i}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.06 }}
                className="flex items-center gap-3 text-sm text-slate-300"
              >
                <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(124,58,237,0.25)" }}>
                  <Check size={10} strokeWidth={3} className="text-purple-300" />
                </span>
                {f}
              </motion.li>
            ))}
          </ul>

          {/* Subscribe button */}
          <motion.button
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            whileHover={{ scale: 1.03, boxShadow: "0 12px 36px rgba(124,58,237,0.5)" }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push(`/payment?package=${encodeURIComponent(course.name)}`)}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-white text-sm"
            style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)", boxShadow: "0 6px 24px rgba(124,58,237,0.35)" }}
          >
            Subscribe Now {course.price} <ArrowRight size={15} />
          </motion.button>
        </motion.div>

        {/* Retake */}
        <p className="text-center text-slate-600 text-xs">
          Not the right fit?{" "}
          <button
            onClick={() => {
              localStorage.removeItem("surveyAnswers");
              router.replace("/");
              setTimeout(() => document.getElementById("survey")?.scrollIntoView({ behavior: "smooth" }), 400);
            }}
            className="text-purple-400 hover:underline"
          >
            Retake the survey
          </button>
        </p>
      </motion.div>
    </main>
  );
}

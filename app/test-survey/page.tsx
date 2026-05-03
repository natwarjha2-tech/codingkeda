"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight, X, Sparkles, Loader2 } from "lucide-react";

/* ── Constants ── */
const STEPS = 3;

const CLASS_OPTIONS = [
  { value: "4-8",  label: "Class 4–8",  emoji: "📚", desc: "Primary & Middle School" },
  { value: "9-12", label: "Class 9–12", emoji: "🎓", desc: "High School" },
];
const LANGUAGES = [
  { label: "C",      emoji: "⚙️" },
  { label: "C++",    emoji: "🔧" },
  { label: "Java",   emoji: "☕" },
  { label: "Python", emoji: "🐍" },
];
const LEVELS = [
  { label: "Beginner",     emoji: "🌱", desc: "Just starting out" },
  { label: "Intermediate", emoji: "⚡", desc: "Know some concepts" },
];

const COURSES = {
  zenz: {
    name: "ZenZ",
    tag: "For Class 4–8",
    emoji: "🌟",
    desc: "A fun, beginner-friendly coding journey designed for young learners. Build games, animations, and more!",
    color: "from-purple-600 to-pink-500",
    glow: "rgba(168,85,247,0.4)",
  },
  zenalpha: {
    name: "ZenAlpha",
    tag: "For Class 9–12",
    emoji: "⚡",
    desc: "Advanced coding curriculum for high schoolers. Master real-world projects, DSA, and career-ready skills.",
    color: "from-blue-600 to-purple-600",
    glow: "rgba(99,102,241,0.4)",
  },
};

/* ── Option Card ── */
function OptionCard({ selected, onClick, emoji, label, desc }: {
  selected: boolean; onClick: () => void; emoji: string; label: string; desc?: string;
}) {
  return (
    <motion.button type="button"
      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="relative w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all duration-200"
      style={{
        background: selected ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)",
        border: selected ? "1.5px solid rgba(124,58,237,0.7)" : "1.5px solid rgba(255,255,255,0.08)",
        boxShadow: selected ? "0 0 16px rgba(124,58,237,0.2)" : "none",
      }}
    >
      {selected && (
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
          className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}>
          <Check size={8} strokeWidth={3} className="text-white" />
        </motion.span>
      )}
      <span className="text-xl">{emoji}</span>
      <div>
        <p className="font-semibold text-sm" style={{ color: selected ? "#e9d5ff" : "#e2e8f0" }}>{label}</p>
        {desc && <p className="text-xs mt-0.5" style={{ color: "rgba(148,163,184,0.7)" }}>{desc}</p>}
      </div>
    </motion.button>
  );
}

/* ── Modal ── */
function SurveyModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ classGroup: "", languages: [] as string[], level: "" });
  const [done, setDone] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const showResult = () => {
    setAnalyzing(true);
    setTimeout(() => { setAnalyzing(false); setDone(true); }, 2000);
  };

  const toggleLang = (lang: string) =>
    setForm(prev => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter(l => l !== lang)
        : [...prev.languages, lang],
    }));

  const canNext = () => {
    if (step === 1) return !!form.classGroup;
    if (step === 2) return form.languages.length > 0;
    if (step === 3) return !!form.level;
    return false;
  };

  const recommended = form.classGroup === "4-8" ? COURSES.zenz : COURSES.zenalpha;

  const headings = [
    { q: "What best describes you?",          sub: "We'll tailor your learning path" },
    { q: "Languages you've explored?",         sub: "Select all that apply" },
    { q: "What's your coding level?",          sub: "Be honest — we'll match you perfectly!" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="w-full max-w-md rounded-3xl px-7 py-8 relative"
        style={{
          background: "linear-gradient(145deg,#0f0a1e,#130d28)",
          border: "1px solid rgba(124,58,237,0.25)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(124,58,237,0.1)",
        }}
      >
        {/* Close */}
        <button onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
          <X size={14} />
        </button>

        <AnimatePresence mode="wait" initial={false}>

          {/* Survey steps */}
          {!done && !analyzing && (
            <motion.div key="survey"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Label */}
              <p className="text-[10px] font-bold uppercase tracking-widest mb-5"
                style={{ color: "rgba(167,139,250,0.8)" }}>✦ Course Finder</p>

              {/* Progress */}
              <div className="mb-6">
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-purple-400 font-semibold">Step {step} of {STEPS}</span>
                  <span className="text-xs text-slate-500">{Math.round((step / STEPS) * 100)}%</span>
                </div>
                <div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <motion.div className="h-full rounded-full"
                    style={{ background: "linear-gradient(to right,#7c3aed,#ec4899)" }}
                    initial={false}
                    animate={{ width: `${(step / STEPS) * 100}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* Heading */}
              <div className="mb-5">
                <h2 className="text-xl font-extrabold text-white mb-1">{headings[step - 1].q}</h2>
                <p className="text-slate-400 text-xs">{headings[step - 1].sub}</p>
              </div>

              {/* Content */}
              <div style={{ minHeight: 160 }}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={step}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.16 }}
                  >
                    {step === 1 && (
                      <div className="flex flex-col gap-2.5">
                        {CLASS_OPTIONS.map(opt => (
                          <OptionCard key={opt.value}
                            selected={form.classGroup === opt.value}
                            onClick={() => setForm({ ...form, classGroup: opt.value })}
                            emoji={opt.emoji} label={opt.label} desc={opt.desc} />
                        ))}
                      </div>
                    )}
                    {step === 2 && (
                      <div className="grid grid-cols-2 gap-2.5">
                        {LANGUAGES.map(lang => (
                          <OptionCard key={lang.label}
                            selected={form.languages.includes(lang.label)}
                            onClick={() => toggleLang(lang.label)}
                            emoji={lang.emoji} label={lang.label} />
                        ))}
                      </div>
                    )}
                    {step === 3 && (
                      <div className="flex flex-col gap-2.5">
                        {LEVELS.map(lvl => (
                          <OptionCard key={lvl.label}
                            selected={form.level === lvl.label}
                            onClick={() => setForm({ ...form, level: lvl.label })}
                            emoji={lvl.emoji} label={lvl.label} desc={lvl.desc} />
                        ))}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Nav */}
              <div className="flex items-center justify-between mt-6 pt-5 border-t border-white/8">
                <button onClick={() => setStep(s => s - 1)}
                  className={`px-4 py-2 rounded-xl text-slate-400 hover:text-white text-sm font-semibold transition-all hover:bg-white/5 ${step === 1 ? "invisible" : ""}`}>
                  ← Back
                </button>
                <motion.button
                  whileHover={canNext() ? { scale: 1.05, boxShadow: "0 6px 20px rgba(124,58,237,0.5)" } : {}}
                  whileTap={canNext() ? { scale: 0.96 } : {}}
                  onClick={() => canNext() && (step < STEPS ? setStep(s => s + 1) : showResult())}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-200"
                  style={{
                    background: canNext() ? "linear-gradient(135deg,#7c3aed,#ec4899)" : "rgba(255,255,255,0.06)",
                    color: canNext() ? "white" : "#475569",
                    cursor: canNext() ? "pointer" : "not-allowed",
                    boxShadow: canNext() ? "0 4px 14px rgba(124,58,237,0.35)" : "none",
                  }}>
                  {step < STEPS ? <><span>Continue</span><ArrowRight size={14} /></> : <span>See My Course ✨</span>}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Analyzing screen */}
          {analyzing && (
            <motion.div key="analyzing"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center justify-center py-10 text-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="mb-5"
              >
                <Loader2 size={40} className="text-purple-400" />
              </motion.div>
              <motion.p
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-white font-bold text-base mb-1"
              >
                Analyzing your learning profile...
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-slate-400 text-xs"
              >
                Finding your perfect coding path 🎯
              </motion.p>
              {/* Animated dots */}
              <div className="flex gap-1.5 mt-6">
                {[0, 1, 2].map(i => (
                  <motion.div key={i}
                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                    className="w-2 h-2 rounded-full"
                    style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Result screen */}
          {done && (
            <motion.div key="result"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
              className="text-center"
            >
              <div className="flex items-center justify-center gap-2 mb-5">
                <Sparkles size={16} className="text-purple-400" />
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(167,139,250,0.8)" }}>
                  Recommended Program 🚀
                </p>
              </div>

              {/* Course card */}
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="rounded-2xl p-6 mb-6 text-left"
                style={{
                  background: `linear-gradient(135deg,rgba(124,58,237,0.2),rgba(236,72,153,0.1))`,
                  border: "1px solid rgba(124,58,237,0.35)",
                  boxShadow: `0 0 30px ${recommended.glow}`,
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-4xl">{recommended.emoji}</span>
                  <div>
                    <h3 className="text-2xl font-extrabold text-white">{recommended.name}</h3>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(124,58,237,0.25)", color: "#c4b5fd" }}>
                      {recommended.tag}
                    </span>
                  </div>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">{recommended.desc}</p>
              </motion.div>

              <motion.button
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                whileHover={{ scale: 1.05, boxShadow: "0 8px 28px rgba(124,58,237,0.5)" }}
                whileTap={{ scale: 0.96 }}
                onClick={() => router.push("/login")}
                className="w-full py-3.5 rounded-xl font-bold text-white text-sm"
                style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)", boxShadow: "0 4px 16px rgba(124,58,237,0.35)" }}
              >
                Subscribe Now 🚀
              </motion.button>

              <button onClick={() => { setDone(false); setStep(1); setForm({ classGroup: "", languages: [], level: "" }); }}
                className="mt-3 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                ← Retake survey
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/* ── Main Page ── */
export default function TestSurveyPage() {
  const [open, setOpen] = useState(false);

  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg,#0a0118 0%,#0d0221 50%,#000000 100%)" }}>

      {/* Blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle,rgba(124,58,237,0.15) 0%,transparent 70%)", filter: "blur(50px)" }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle,rgba(236,72,153,0.1) 0%,transparent 70%)", filter: "blur(50px)" }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center relative z-10"
      >
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6"
          style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)", boxShadow: "0 0 30px rgba(124,58,237,0.4)" }}>
          🚀
        </div>
        <h1 className="text-4xl font-extrabold text-white mb-3">Find Your Coding Path</h1>
        <p className="text-slate-400 text-sm mb-8 max-w-xs mx-auto">
          Answer 3 quick questions and get a personalized course recommendation.
        </p>
        <motion.button
          whileHover={{ scale: 1.06, boxShadow: "0 12px 36px rgba(124,58,237,0.55)" }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setOpen(true)}
          className="px-8 py-4 rounded-2xl font-bold text-white text-base"
          style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)", boxShadow: "0 6px 24px rgba(124,58,237,0.4)" }}
        >
          Find My Program 🚀
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {open && <SurveyModal onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </main>
  );
}

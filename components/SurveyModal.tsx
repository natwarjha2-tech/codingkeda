"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight, X, Sparkles, Loader2 } from "lucide-react";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

const STEPS = 4;

function PremiumInput({ type = "text", placeholder, value, onChange, autoFocus }: {
  type?: string; placeholder: string; value: string;
  onChange: (v: string) => void; autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type} placeholder={placeholder} value={value} autoFocus={autoFocus}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      className="w-full px-5 py-4 rounded-2xl text-white text-sm font-medium outline-none transition-all duration-200 placeholder:text-slate-600"
      style={{
        background: "rgba(255,255,255,0.05)",
        border: focused ? "1.5px solid rgba(124,58,237,0.8)" : "1.5px solid rgba(255,255,255,0.08)",
        boxShadow: focused ? "0 0 20px rgba(124,58,237,0.2)" : "none",
      }}
    />
  );
}

const CLASS_OPTIONS = [
  { value: "4-8", label: "Class 4–8", emoji: "📚", desc: "Primary & Middle School" },
  { value: "9-12", label: "Class 9–12", emoji: "🎓", desc: "High School" },
];
const EXPERIENCE_OPTIONS = [
  { label: "Just Starting", emoji: "🚀", desc: "Never written code before" },
  { label: "I Know Basics", emoji: "💻", desc: "Familiar with some concepts" },
  { label: "Ready for Advanced", emoji: "⚡", desc: "Comfortable, want to go deeper" },
];
const INTERESTS = [
  { label: "AI", type: "emoji" as const, icon: "🤖", desc: "Artificial Intelligence" },
  { label: "Web Development", type: "emoji" as const, icon: "🌐", desc: "Build Websites & Apps" },
  { label: "Java", type: "svg" as const, desc: "Programming Language" },
  { label: "Python", type: "svg" as const, desc: "Programming Language" },
  { label: "C++", type: "svg" as const, desc: "Programming Language" },
  { label: "Others", type: "emoji" as const, icon: "⚡", desc: "Other Technologies" },
];

function LangIcon({ label }: { label: string }) {
  if (label === "Java") return (<svg width="28" height="36" viewBox="0 0 48 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 42s-2.5 1.5 1.8 2c5.2.6 7.8.5 13.5-.6 0 0 1.5 1 3.6 1.8-12.8 5.5-29-.3-18.9-3.2z" fill="#0074BD"/><path d="M16 36.5s-2.8 2.1 3 2.8c4.5.5 10 .6 17.6-.8 0 0 1 1 2.7 1.6-15.6 4.6-33 .4-23.3-3.6z" fill="#0074BD"/><path d="M28.5 24.5c3.2 3.7-0.8 7-0.8 7s8-4.1 4.3-9.3c-3.4-4.8-6-7.2 8.1-15.4 0 0-22.1 5.5-11.6 17.7z" fill="#EA2D2E"/><path d="M40 46.5s1.8 1.5-2 2.7c-7.3 2.2-30.3 2.9-36.7.1-2.3-1 2-2.4 3.4-2.7 1.4-.3 2.2-.2 2.2-.2-2.5-1.8-16.4 3.5-7 5 25.5 4.1 46.5-1.9 40.1-4.9z" fill="#0074BD"/><path d="M19 30s-11.5 2.7-4.1 3.7c3.2.4 9.5.3 15.4-.2 4.8-.4 9.7-1.3 9.7-1.3s-1.7.7-2.9 1.5c-11.8 3.1-34.6 1.7-28-1.5 5.5-2.7 9.9-2.2 9.9-2.2z" fill="#0074BD"/><path d="M35 39.5c12-6.2 6.4-12.2 2.6-11.4-.9.2-1.4.4-1.4.4s.4-.6 1.1-.8c8.1-2.8 14.3 8.4-2.5 12.9 0 0 .2-.2.2-.1z" fill="#EA2D2E"/><path d="M31 0s6.6 6.6-6.2 16.7c-10.3 8.1-2.3 12.7 0 18-6-5.4-10.4-10.1-7.4-14.5C21.5 13.6 33.5 10.7 31 0z" fill="#EA2D2E"/><path d="M20.5 54.5c11.5.7 29.2-.4 29.6-5.5 0 0-.8 2-9.5 3.6-9.8 1.8-21.9 1.6-29.1.4 0 0 1.5 1.2 9 1.5z" fill="#0074BD"/></svg>);
  if (label === "Python") return (<svg width="32" height="32" viewBox="0 0 256 255" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="pyB" x1="12%" y1="12%" x2="75%" y2="88%"><stop offset="0" stopColor="#387EB8"/><stop offset="1" stopColor="#366994"/></linearGradient><linearGradient id="pyY" x1="15%" y1="15%" x2="80%" y2="85%"><stop offset="0" stopColor="#FFE052"/><stop offset="1" stopColor="#FFC331"/></linearGradient></defs><path d="M126.9 0C62.4 0 66.3 27.3 66.3 27.3l.1 28.3h61.8v8.5H41.6S0 59.4 0 124.6s37.5 62.9 37.5 62.9h22.4v-30.3s-1.2-37.5 36.9-37.5h63.6s35.7.6 35.7-34.5V35.7S201.6 0 126.9 0zm-35.3 20.6c6.4 0 11.5 5.2 11.5 11.5s-5.2 11.5-11.5 11.5-11.5-5.2-11.5-11.5 5.1-11.5 11.5-11.5z" fill="url(#pyB)"/><path d="M129.1 255c64.5 0 60.6-27.3 60.6-27.3l-.1-28.3H127.8v-8.5h86.6s41.6 4.7 41.6-60.5-37.5-62.9-37.5-62.9h-22.4v30.3s1.2 37.5-36.9 37.5H95.6s-35.7-.6-35.7 34.5v57.5S54.4 255 129.1 255zm35.3-20.6c-6.4 0-11.5-5.2-11.5-11.5s5.2-11.5 11.5-11.5 11.5 5.2 11.5 11.5-5.1 11.5-11.5 11.5z" fill="url(#pyY)"/></svg>);
  if (label === "C++") return (<svg width="36" height="36" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg"><path d="M64 4L8 36v56l56 32 56-32V36L64 4z" fill="#00599C"/><path d="M64 4L8 36l56 32 56-32L64 4z" fill="#004482"/><path d="M8 36v56l56 32V68L8 36z" fill="#659AD2"/><text x="34" y="76" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="38" fill="white" letterSpacing="-2">C++</text></svg>);
  return null;
}

const COURSES = {
  zenz: { name: "ZenZ Package", tag: "For Class 4–8", emoji: "🌟", desc: "A fun, beginner-friendly coding journey designed for young learners.", features: ["Scratch & Python basics", "Build games & animations", "Live mentor support", "Certificate on completion"], glow: "rgba(168,85,247,0.35)" },
  zenalpha: { name: "ZenAlpha Package", tag: "For Class 9–12", emoji: "⚡", desc: "Advanced coding curriculum for high schoolers ready to go deep.", features: ["DSA & real-world projects", "Web & App development", "Career-ready skills", "Industry certificate"], glow: "rgba(99,102,241,0.35)" },
};

function OptionCard({ selected, onClick, emoji, label, desc }: { selected: boolean; onClick: () => void; emoji: string; label: string; desc?: string; }) {
  return (
    <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={onClick}
      className="relative w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all duration-200"
      style={{ background: selected ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)", border: selected ? "1.5px solid rgba(124,58,237,0.7)" : "1.5px solid rgba(255,255,255,0.08)", boxShadow: selected ? "0 0 16px rgba(124,58,237,0.2)" : "none" }}>
      {selected && (<motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 20 }} className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}><Check size={8} strokeWidth={3} className="text-white" /></motion.span>)}
      <span className="text-xl">{emoji}</span>
      <div><p className="font-semibold text-sm" style={{ color: selected ? "#e9d5ff" : "#e2e8f0" }}>{label}</p>{desc && <p className="text-xs mt-0.5" style={{ color: "rgba(148,163,184,0.6)" }}>{desc}</p>}</div>
    </motion.button>
  );
}

export default function SurveyModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const triggerLogin = useAuthRedirect();
  const [step, setStep] = useState(1);
  const [analyzing, setAnalyzing] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", classGroup: "", experience: "", interest: "" });
  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const canNext = () => { if (step === 1) return form.name.trim().length >= 2 && isValidEmail(form.email); if (step === 2) return !!form.classGroup; if (step === 3) return !!form.experience; if (step === 4) return !!form.interest; return false; };
  const showResult = () => { setAnalyzing(true); setTimeout(async () => { await fetch("/api/survey/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.email, name: form.name, classGroup: form.classGroup, experience: form.experience, interest: form.interest }) }).catch(() => {}); localStorage.setItem("surveyCompleted", "true"); setAnalyzing(false); setDone(true); }, 2000); };
  const recommended = form.classGroup === "4-8" ? COURSES.zenz : COURSES.zenalpha;
  const headings = [
    { q: "Let's get to know you 👋", sub: "We'll personalize your learning path" },
    { q: "What best describes you?", sub: "Helps us match the right curriculum" },
    { q: "How comfortable are you with coding?", sub: "Be honest — we'll match you perfectly!" },
    { q: "What excites you most? 🚀", sub: "Pick your primary area of interest" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)" }} onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ opacity: 0, scale: 0.85, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85, y: 40 }} transition={{ type: "spring", stiffness: 300, damping: 28 }} className="w-full max-w-md rounded-3xl px-7 py-8 relative" style={{ background: "linear-gradient(145deg,#0f0a1e,#130d28)", border: "1px solid rgba(124,58,237,0.25)", boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 50px rgba(124,58,237,0.08)" }}>
        <button onClick={onClose} className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"><X size={14} /></button>
        <AnimatePresence mode="wait" initial={false}>
          {!analyzing && !done && (
            <motion.div key="survey" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-5" style={{ color: "rgba(167,139,250,0.8)" }}>✦ Course Finder</p>
              <div className="mb-6"><div className="flex justify-between mb-1.5"><span className="text-xs text-purple-400 font-semibold">Step {step} of {STEPS}</span><span className="text-xs text-slate-500">{Math.round((step / STEPS) * 100)}%</span></div><div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}><motion.div className="h-full rounded-full" style={{ background: "linear-gradient(to right,#7c3aed,#ec4899)" }} initial={false} animate={{ width: `${(step / STEPS) * 100}%` }} transition={{ duration: 0.4, ease: "easeOut" }} /></div></div>
              <div className="mb-5"><h2 className="text-xl font-extrabold text-white mb-1">{step > 1 && form.name ? `Hi ${form.name.split(" ")[0]}! 👋` : headings[step - 1].q}</h2><p className="text-slate-400 text-xs">{headings[step - 1].sub}</p></div>
              <div style={{ minHeight: 160 }}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.16 }}>
                    {step === 1 && (<div className="flex flex-col gap-3"><PremiumInput placeholder="Your full name" value={form.name} onChange={v => setForm({ ...form, name: v })} autoFocus /><div><PremiumInput type="email" placeholder="you@example.com" value={form.email} onChange={v => setForm({ ...form, email: v })} />{form.email && !isValidEmail(form.email) && <p className="text-xs text-red-400 mt-1.5 ml-1">Please enter a valid email address</p>}</div></div>)}
                    {step === 2 && (<div className="flex flex-col gap-2.5">{CLASS_OPTIONS.map(opt => <OptionCard key={opt.value} selected={form.classGroup === opt.value} onClick={() => setForm({ ...form, classGroup: opt.value })} emoji={opt.emoji} label={opt.label} desc={opt.desc} />)}</div>)}
                    {step === 3 && (<div className="flex flex-col gap-2.5">{EXPERIENCE_OPTIONS.map(opt => <OptionCard key={opt.label} selected={form.experience === opt.label} onClick={() => setForm({ ...form, experience: opt.label })} emoji={opt.emoji} label={opt.label} desc={opt.desc} />)}</div>)}
                    {step === 4 && (<div className="grid grid-cols-2 gap-2 mx-auto" style={{ maxWidth: 320 }}>{INTERESTS.map(item => { const sel = form.interest === item.label; return (<motion.button key={item.label} type="button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }} onClick={() => setForm({ ...form, interest: item.label })} className="relative flex flex-col items-center justify-center gap-2 rounded-xl transition-all duration-200" style={{ padding: "14px 8px", background: sel ? "rgba(124,58,237,0.22)" : "rgba(255,255,255,0.04)", border: sel ? "1.5px solid rgba(124,58,237,0.7)" : "1.5px solid rgba(255,255,255,0.08)", boxShadow: sel ? "0 0 18px rgba(124,58,237,0.25)" : "none" }}>{sel && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 20 }} className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}><Check size={7} strokeWidth={3} className="text-white" /></motion.span>}{item.type === "emoji" ? <span className="text-2xl leading-none">{item.icon}</span> : <LangIcon label={item.label} />}<div className="text-center"><p className="font-semibold text-xs leading-tight" style={{ color: sel ? "#e9d5ff" : "#e2e8f0" }}>{item.label}</p><p className="text-[9px] mt-0.5 leading-tight" style={{ color: "rgba(148,163,184,0.55)" }}>{item.desc}</p></div></motion.button>); })}</div>)}
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="flex items-center justify-between mt-6 pt-5 border-t border-white/8">
                <button onClick={() => setStep(s => s - 1)} className={`px-4 py-2 rounded-xl text-slate-400 hover:text-white text-sm font-semibold transition-all hover:bg-white/5 ${step === 1 ? "invisible" : ""}`}>← Back</button>
                <motion.button whileHover={canNext() ? { scale: 1.05, boxShadow: "0 6px 20px rgba(124,58,237,0.5)" } : {}} whileTap={canNext() ? { scale: 0.96 } : {}} onClick={() => canNext() && (step < STEPS ? setStep(s => s + 1) : showResult())} className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-200" style={{ background: canNext() ? "linear-gradient(135deg,#7c3aed,#ec4899)" : "rgba(255,255,255,0.06)", color: canNext() ? "white" : "#475569", cursor: canNext() ? "pointer" : "not-allowed", boxShadow: canNext() ? "0 4px 14px rgba(124,58,237,0.35)" : "none" }}>{step < STEPS ? <><span>Continue</span><ArrowRight size={14} /></> : <span>Get My Recommendation ✨</span>}</motion.button>
              </div>
            </motion.div>
          )}

          {analyzing && (
            <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-12 text-center">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="mb-5"><Loader2 size={40} className="text-purple-400" /></motion.div>
              <p className="text-white font-bold text-base mb-1">Analyzing your profile...</p>
              <p className="text-slate-400 text-xs mb-6">Finding your perfect package 🎯</p>
              <div className="flex gap-1.5">{[0, 1, 2].map(i => (<motion.div key={i} animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} className="w-2 h-2 rounded-full" style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }} />))}</div>
            </motion.div>
          )}
          {done && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <div className="flex items-center gap-2 mb-4"><Sparkles size={14} className="text-purple-400" /><p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(167,139,250,0.8)" }}>Your Recommendation, {form.name.split(" ")[0]} 🎯</p></div>
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl p-5 mb-5" style={{ background: "linear-gradient(135deg,rgba(124,58,237,0.18),rgba(236,72,153,0.08))", border: "1px solid rgba(124,58,237,0.3)", boxShadow: `0 0 30px ${recommended.glow}` }}>
                <div className="flex items-center gap-3 mb-3"><span className="text-3xl">{recommended.emoji}</span><div><h3 className="text-xl font-extrabold text-white">{recommended.name}</h3><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(124,58,237,0.25)", color: "#c4b5fd" }}>{recommended.tag}</span></div></div>
                <p className="text-slate-300 text-sm mb-4">{recommended.desc}</p>
                <ul className="space-y-1.5">{recommended.features.map((f, i) => (<li key={i} className="flex items-center gap-2 text-xs text-slate-300"><span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(124,58,237,0.3)" }}><Check size={8} strokeWidth={3} className="text-purple-300" /></span>{f}</li>))}</ul>
              </motion.div>
              <motion.div className="flex flex-col gap-2.5">
                <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} whileHover={{ scale: 1.05, boxShadow: "0 8px 28px rgba(124,58,237,0.5)" }} whileTap={{ scale: 0.96 }} onClick={() => { localStorage.setItem("surveyCompleted", "true"); localStorage.setItem("recommendedCourse", recommended.name); onClose(); triggerLogin(); }} className="w-full py-3.5 rounded-xl font-bold text-white text-sm" style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)", boxShadow: "0 4px 16px rgba(124,58,237,0.35)" }}>Buy Now 🚀</motion.button>
                <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => { localStorage.setItem("surveyCompleted", "true"); localStorage.setItem("recommendedCourse", recommended.name); onClose(); }} className="w-full py-3 rounded-xl font-semibold text-sm transition-colors" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}>Skip for now</motion.button>
              </motion.div>
              <button onClick={() => { setDone(false); setStep(1); setForm({ name: "", email: "", classGroup: "", experience: "", interest: "" }); }} className="w-full text-xs text-slate-500 hover:text-slate-300 transition-colors mt-3">← Retake survey</button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

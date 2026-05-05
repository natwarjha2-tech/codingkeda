"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Shield, Loader2, CheckCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

const PACKAGES: Record<string, {
  name: string; tag: string; emoji: string; price: string; original: string;
  discount: string; desc: string; features: string[]; glow: string;
}> = {
  "ZenZ Package": {
    name: "ZenZ Package", tag: "For Class 4–8", emoji: "🌟",
    price: "₹499", original: "₹2,499", discount: "80% OFF",
    desc: "A fun, beginner-friendly coding journey designed for young learners.",
    features: ["Scratch & Python basics", "Build games & animations", "Live mentor support", "Certificate on completion", "Lifetime access", "Mobile-friendly content"],
    glow: "rgba(168,85,247,0.3)",
  },
  "ZenAlpha Package": {
    name: "ZenAlpha Package", tag: "For Class 9–12", emoji: "⚡",
    price: "₹599", original: "₹2,999", discount: "80% OFF",
    desc: "Advanced coding curriculum for high schoolers ready to go deep.",
    features: ["DSA & real-world projects", "Web & App development", "Career-ready skills", "Industry certificate", "Lifetime access", "1-on-1 doubt sessions"],
    glow: "rgba(99,102,241,0.3)",
  },
};

const DEFAULT_PKG = "ZenAlpha Package";

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pkgName = searchParams.get("package") || DEFAULT_PKG;
  const pkg = PACKAGES[pkgName] ?? PACKAGES[DEFAULT_PKG];

  const [paying, setPaying] = useState(false);
  const [success, setSuccess] = useState(false);

  const handlePayment = async () => {
    setPaying(true);
    // Mock payment — replace with Razorpay/Stripe integration
    await new Promise(r => setTimeout(r, 2000));
    setPaying(false);
    setSuccess(true);
    setTimeout(() => router.replace("/dashboard"), 2500);
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg,#0a0118 0%,#0d0221 60%,#0f0f1a 100%)" }}>

      {/* Blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle,rgba(124,58,237,0.12) 0%,transparent 70%)", filter: "blur(60px)" }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle,rgba(236,72,153,0.08) 0%,transparent 70%)", filter: "blur(60px)" }} />

      <AnimatePresence mode="wait">
        {success ? (
          /* ── Success Screen ── */
          <motion.div key="success"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="text-center relative z-10"
          >
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: "rgba(34,197,94,0.15)", border: "2px solid rgba(34,197,94,0.4)", boxShadow: "0 0 30px rgba(34,197,94,0.2)" }}
            >
              <CheckCircle size={40} className="text-green-400" />
            </motion.div>
            <h2 className="text-3xl font-extrabold text-white mb-2">Payment Successful! 🎉</h2>
            <p className="text-slate-400 text-sm mb-2">Welcome to <span className="text-purple-300 font-semibold">{pkg.name}</span></p>
            <p className="text-slate-500 text-xs">Redirecting to your dashboard...</p>
            <div className="flex justify-center gap-1.5 mt-6">
              {[0,1,2].map(i => (
                <motion.div key={i}
                  animate={{ opacity: [0.3,1,0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  className="w-2 h-2 rounded-full bg-purple-400"
                />
              ))}
            </div>
          </motion.div>
        ) : (
          /* ── Payment Page ── */
          <motion.div key="payment"
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md relative z-10"
          >
            {/* Header — matches recommendation page */}
            <div className="flex items-center gap-2 mb-6">
              <Shield size={16} className="text-purple-400" />
              <p className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "rgba(167,139,250,0.8)" }}>
                Your Personalized Recommendation 🎯
              </p>
            </div>

            {/* Package card — same structure as recommendation page */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-3xl p-7 mb-5"
              style={{
                background: "linear-gradient(135deg,rgba(124,58,237,0.18),rgba(236,72,153,0.08))",
                border: "1px solid rgba(124,58,237,0.3)",
                backdropFilter: "blur(20px)",
                boxShadow: `0 24px 80px rgba(0,0,0,0.5), 0 0 40px ${pkg.glow}`,
              }}
            >
              {/* Course header */}
              <div className="flex items-center gap-4 mb-4 pb-4 border-b border-white/8">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                  style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)" }}>
                  {pkg.emoji}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-extrabold text-white">{pkg.name}</h2>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(124,58,237,0.2)", color: "#c4b5fd" }}>
                    {pkg.tag}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xl font-extrabold text-white">{pkg.price}</p>
                  <p className="text-xs text-slate-500 line-through">{pkg.original}</p>
                  <span className="text-[10px] font-bold text-green-400">{pkg.discount}</span>
                </div>
              </div>

              <p className="text-slate-300 text-sm mb-5">{pkg.desc}</p>

              {/* Features */}
              <ul className="space-y-2.5 mb-6">
                {pkg.features.map((f, i) => (
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

              {/* Pay button */}
              <motion.button
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                whileHover={!paying ? { scale: 1.03, boxShadow: "0 12px 36px rgba(124,58,237,0.5)" } : {}}
                whileTap={!paying ? { scale: 0.97 } : {}}
                onClick={handlePayment}
                disabled={paying}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-white text-sm transition-all duration-200 disabled:opacity-70"
                style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)", boxShadow: "0 6px 24px rgba(124,58,237,0.35)" }}
              >
                {paying ? (
                  <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Loader2 size={16} />
                  </motion.div> Processing...</>
                ) : (
                  <>Proceed to Payment {pkg.price} <ArrowRight size={15} /></>
                )}
              </motion.button>
            </motion.div>

            {/* Footer — matches recommendation page */}
            <p className="text-center text-slate-600 text-xs">
              Not the right fit?{" "}
              <span onClick={() => router.back()} className="text-purple-400 cursor-pointer hover:underline">Go back</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

export default function PaymentPage() {
  return (
    <Suspense>
      <PaymentContent />
    </Suspense>
  );
}

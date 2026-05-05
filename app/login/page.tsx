"use client";
import { useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, CheckCircle, Mail } from "lucide-react";
import Navbar from "@/components/Navbar";
import { loginUser, saveToken } from "@/services/auth";

/* ── Forgot Password Modal ── */
function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) return setError("Please enter your email address.");
    if (!isValidEmail(email)) return setError("Please enter a valid email address.");

    setLoading(true);
    // Mock API — replace with real call when backend is ready
    await new Promise(r => setTimeout(r, 1500));
    setLoading(false);
    setSuccess(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="w-full max-w-sm rounded-2xl p-7 relative"
        style={{
          background: "linear-gradient(145deg,#0f0a1e,#16213e)",
          border: "1px solid rgba(124,58,237,0.25)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(124,58,237,0.08)",
        }}
      >
        <button onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
          <X size={14} />
        </button>

        <AnimatePresence mode="wait" initial={false}>
          {!success ? (
            <motion.div key="form"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)" }}>
                <Mail size={18} className="text-purple-400" />
              </div>
              <h3 className="text-xl font-extrabold text-white mb-1">Forgot Password?</h3>
              <p className="text-slate-400 text-sm mb-6">
                Enter your registered email and we'll send you a reset link.
              </p>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-xl mb-4">
                  ⚠️ {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">Email Address</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(""); }}
                    className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors placeholder:text-slate-500"
                    style={{ boxShadow: email && isValidEmail(email) ? "0 0 0 3px rgba(124,58,237,0.1)" : "none" }}
                  />
                </div>
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={!loading ? { scale: 1.02, boxShadow: "0 6px 20px rgba(124,58,237,0.4)" } : {}}
                  whileTap={!loading ? { scale: 0.97 } : {}}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white text-sm transition-all duration-200 disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}
                >
                  {loading ? (
                    <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                      <Loader2 size={16} />
                    </motion.div> Sending...</>
                  ) : "Send Reset Link"}
                </motion.button>
              </form>

              <button onClick={onClose}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors mt-4">
                ← Back to Login
              </button>
            </motion.div>
          ) : (
            <motion.div key="success"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
              className="text-center py-4"
            >
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}
              >
                <CheckCircle size={28} className="text-green-400" />
              </motion.div>
              <h3 className="text-xl font-extrabold text-white mb-2">Check Your Email</h3>
              <p className="text-slate-400 text-sm mb-1">
                Password reset link sent to:
              </p>
              <p className="text-purple-300 text-sm font-semibold mb-6">{email}</p>
              <p className="text-slate-500 text-xs mb-6">
                Didn't receive it? Check your spam folder or try again.
              </p>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={onClose}
                className="w-full py-3 rounded-xl font-semibold text-white text-sm"
                style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}
              >
                Back to Login
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/* ── Login Page ── */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pkg = searchParams.get("package") || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) return setError("Please fill all fields!");
    if (!email.includes("@")) return setError("Please enter a valid email!");
    if (password.length < 8) return setError("Password must be at least 8 characters!");
    setLoading(true);
    try {
      const data = await loginUser({ email, password });
      saveToken(data.token);

      const isNewUser = localStorage.getItem("isNewUser");
      const surveyDone = localStorage.getItem("surveyCompleted");
      const flow = searchParams.get("flow");

      if (flow === "free") {
        localStorage.removeItem("isNewUser");
        router.replace("/dashboard");
      } else if (flow === "survey") {
        localStorage.removeItem("isNewUser");
        router.replace("/recommendation");
      } else if (isNewUser && !surveyDone) {
        localStorage.removeItem("isNewUser");
        router.replace("/");
        setTimeout(() => {
          document.getElementById("survey")?.scrollIntoView({ behavior: "smooth" });
        }, 400);
      } else {
        router.replace("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,#1a0533_0%,#0f0f1a_60%)] px-6 py-12 pt-28">
        <div className="w-full max-w-md">
          <div className="bg-[#16213e] border border-white/8 rounded-2xl p-8">
            <h2 className="text-2xl font-extrabold text-white mb-1">Welcome back</h2>
            <p className="text-slate-400 text-sm mb-6">Log in to continue your learning journey</p>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl mb-4">
                ⚠️ {error}
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="text-sm font-semibold text-slate-300 block mb-1.5">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={`w-full bg-white/5 border ${error && !email ? "border-red-500" : "border-white/10"} focus:border-purple-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors placeholder:text-slate-500`}
                />
              </div>
              <div>
                <label className="flex justify-between text-sm font-semibold text-slate-300 mb-1.5">
                  Password
                  <button type="button" onClick={() => setShowForgot(true)}
                    className="text-purple-400 font-medium hover:text-purple-300 transition-colors">
                    Forgot password?
                  </button>
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={`w-full bg-white/5 border ${error && !password ? "border-red-500" : "border-white/10"} focus:border-purple-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors placeholder:text-slate-500`}
                />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
                {loading ? "Logging in..." : "Log In"}
              </button>
            </form>

            <p className="text-center text-slate-400 text-sm mt-5">
              New user?{" "}
              <Link href="/signup" className="text-purple-400 font-semibold hover:underline">Sign up</Link>
            </p>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
      </AnimatePresence>
    </>
  );
}

export default function Login() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
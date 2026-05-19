"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, CheckCircle, Mail, Eye, EyeOff, Code, Users, BookOpen, TrendingUp } from "lucide-react";
import { loginUser, saveToken } from "@/services/auth";

/* ── Forgot Password Modal (inner) ── */
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
    await new Promise(r => setTimeout(r, 1500));
    setLoading(false);
    setSuccess(true);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="w-full max-w-sm rounded-2xl p-7 relative bg-white shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"><X size={14} /></button>
        <AnimatePresence mode="wait" initial={false}>
          {!success ? (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-purple-100"><Mail size={18} className="text-purple-600" /></div>
              <h3 className="text-xl font-extrabold text-slate-900 mb-1">Forgot Password?</h3>
              <p className="text-slate-500 text-sm mb-6">Enter your registered email and we&apos;ll send you a reset link.</p>
              {error && <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-4 py-3 rounded-xl mb-4">⚠️ {error}</div>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Email Address</label>
                  <input type="email" placeholder="you@example.com" value={email} onChange={e => { setEmail(e.target.value); setError(""); }}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-4 py-3 text-slate-900 text-sm outline-none transition-colors placeholder:text-slate-400" />
                </div>
                <motion.button type="submit" disabled={loading} whileHover={!loading ? { scale: 1.02 } : {}} whileTap={!loading ? { scale: 0.97 } : {}}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white text-sm transition-all duration-200 disabled:opacity-60 bg-purple-600 hover:bg-purple-700">
                  {loading ? <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Loader2 size={16} /></motion.div> Sending...</> : "Send Reset Link"}
                </motion.button>
              </form>
              <button onClick={onClose} className="w-full text-center text-xs text-slate-500 hover:text-slate-700 transition-colors mt-4">← Back to Login</button>
            </motion.div>
          ) : (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="text-center py-4">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }} className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-green-100"><CheckCircle size={28} className="text-green-600" /></motion.div>
              <h3 className="text-xl font-extrabold text-slate-900 mb-2">Check Your Email</h3>
              <p className="text-slate-500 text-sm mb-1">Password reset link sent to:</p>
              <p className="text-purple-600 text-sm font-semibold mb-6">{email}</p>
              <p className="text-slate-400 text-xs mb-6">Didn&apos;t receive it? Check your spam folder or try again.</p>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={onClose} className="w-full py-3 rounded-xl font-semibold text-white text-sm bg-purple-600 hover:bg-purple-700">Back to Login</motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/* ── Desktop Auth Modal ── */
interface DesktopAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DesktopAuthModal({ isOpen, onClose }: DesktopAuthModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Signup state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupMobile, setSignupMobile] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

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
      localStorage.setItem("userEmail", email);
      localStorage.setItem("user", JSON.stringify({ email, role: "user" }));
      localStorage.setItem("ck_token", data.token);
      onClose();
      router.replace("/dashboard");
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong!"); }
    finally { setLoading(false); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError("");
    if (!signupName || !signupEmail || !signupMobile || !signupPassword) return setSignupError("Please fill all fields!");
    if (!signupEmail.includes("@")) return setSignupError("Please enter a valid email!");
    if (signupMobile.length < 10) return setSignupError("Please enter a valid mobile number!");
    if (signupPassword.length < 8) return setSignupError("Password must be at least 8 characters!");
    setSignupLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: signupName, email: signupEmail, password: signupPassword }),
      });
      const data = await res.json();
      if (!res.ok) return setSignupError(data.message || "Signup failed.");
      setIsSignup(false);
    } catch { setSignupError("Something went wrong!"); }
    finally { setSignupLoading(false); }
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="hidden md:block fixed inset-0 z-50">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="relative w-full max-w-5xl max-h-[90vh] rounded-2xl overflow-hidden bg-white shadow-2xl"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-30 w-8 h-8 rounded-full flex items-center justify-center bg-white/80 hover:bg-white text-slate-500 hover:text-slate-800 shadow-md transition-all"
          >
            <X size={16} />
          </button>

          {/* Content - Same layout as login page */}
          <div className="flex h-[85vh]">

            {/* LEFT SIDE — Branding */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col p-10 bg-gradient-to-br from-slate-50 to-purple-50">
              {/* Decorative dots */}
              <div className="absolute top-20 left-20 flex gap-2 opacity-40">
                <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                <div className="w-2 h-2 rounded-full bg-purple-300"></div>
                <div className="w-2 h-2 rounded-full bg-purple-200"></div>
              </div>
              <div className="absolute top-16 right-32">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 0L12 8L20 10L12 12L10 20L8 12L0 10L8 8L10 0Z" fill="rgba(124,58,237,0.3)"/></svg>
              </div>

              {/* Content */}
              <div className="relative z-10">
                <h1 className="text-3xl font-extrabold text-slate-900 leading-tight mb-2">
                  Learn. Code.<br />
                  <span className="text-purple-600">Build the Future.</span>
                </h1>
                <p className="text-slate-600 text-xs mt-2 max-w-sm leading-relaxed">
                  Join thousands of learners and master in-demand skills with expert-led courses and real-world projects.
                </p>

                {/* Features */}
                <div className="mt-6 space-y-3">
                  {[
                    { icon: <Users size={16} />, color: "bg-purple-100 text-purple-600", title: "Expert Instructors", desc: "Learn from industry professionals and top developers." },
                    { icon: <Code size={16} />, color: "bg-blue-100 text-blue-600", title: "Hands-on Projects", desc: "Build real projects and strengthen your portfolio." },
                    { icon: <TrendingUp size={16} />, color: "bg-orange-100 text-orange-600", title: "Track Progress", desc: "Track your learning and achieve your goals effectively." },
                  ].map(item => (
                    <div key={item.title} className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item.color}`}>{item.icon}</div>
                      <div>
                        <p className="text-slate-900 font-bold text-xs">{item.title}</p>
                        <p className="text-slate-500 text-[11px]">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3D Student Illustration + Stats Card overlapping */}
              <div className="flex-1 flex flex-col items-start justify-end relative mt-2">
                <img src="/student.png" alt="Student learning" className="max-h-[320px] object-contain drop-shadow-xl relative z-10 -ml-4" />
                {/* Stats Card - overlapping image bottom */}
                <div className="relative z-20 -mt-6 bg-white rounded-2xl shadow-lg border border-slate-100 px-6 py-4 flex items-center justify-between w-full max-w-sm">
                {[
                  { icon: <Users size={16} className="text-purple-500" />, value: "5,000+", label: "Happy Students" },
                  { icon: <BookOpen size={16} className="text-purple-500" />, value: "20+", label: "Courses" },
                  { icon: <TrendingUp size={16} className="text-yellow-500" />, value: "4.8/5", label: "Average Rating" },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">{s.icon}<span className="text-lg font-extrabold text-slate-900">{s.value}</span></div>
                    <p className="text-slate-400 text-[10px]">{s.label}</p>
                  </div>
                ))}
                </div>
              </div>
            </div>

            {/* RIGHT SIDE — Login/Signup Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-8 bg-white overflow-y-auto scrollbar-hide">
              <div className="w-full max-w-md">
                <AnimatePresence mode="wait" initial={false}>
                  {!isSignup ? (
                    /* LOGIN FORM */
                    <motion.div key="login" initial={{ opacity: 0, rotateY: -90 }} animate={{ opacity: 1, rotateY: 0 }} exit={{ opacity: 0, rotateY: 90 }} transition={{ duration: 0.4, ease: "easeInOut" }}>
                      <div className="bg-white rounded-2xl p-8 lg:p-10 shadow-xl border border-slate-100">
                        <div className="text-center mb-8">
                          <h2 className="text-2xl font-extrabold text-slate-900 mb-1">Welcome back! 👋</h2>
                          <p className="text-slate-500 text-sm">Log in to continue your learning journey</p>
                        </div>

                        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">⚠️ {error}</div>}

                        <form className="space-y-5" onSubmit={handleSubmit}>
                          <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Email</label>
                            <div className="relative">
                              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input type="email" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)}
                                className={`w-full bg-slate-50 border ${error && !email ? "border-red-400" : "border-slate-200"} focus:border-purple-500 rounded-xl pl-11 pr-4 py-3.5 text-slate-900 text-sm outline-none transition-colors placeholder:text-slate-400`} />
                            </div>
                          </div>
                          <div>
                            <label className="flex justify-between text-sm font-semibold text-slate-700 mb-1.5">
                              Password
                              <button type="button" onClick={() => setShowForgot(true)} className="text-purple-600 font-medium hover:text-purple-700 transition-colors text-xs">Forgot password?</button>
                            </label>
                            <div className="relative">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                              <input type={showPassword ? "text" : "password"} placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)}
                                className={`w-full bg-slate-50 border ${error && !password ? "border-red-400" : "border-slate-200"} focus:border-purple-500 rounded-xl pl-11 pr-11 py-3.5 text-slate-900 text-sm outline-none transition-colors placeholder:text-slate-400`} />
                              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-600 transition-colors">
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                          </div>
                          <motion.button type="submit" disabled={loading}
                            whileHover={!loading ? { scale: 1.02 } : {}} whileTap={!loading ? { scale: 0.97 } : {}}
                            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white text-sm transition-all duration-200 disabled:opacity-50 bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-200">
                            {loading ? <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Loader2 size={16} /></motion.div> Logging in...</> : <>Log In <span className="ml-1">→</span></>}
                          </motion.button>
                        </form>

                        <p className="text-center text-slate-500 text-sm mt-6">
                          New user?{" "}<button onClick={() => { setIsSignup(true); setError(""); }} className="text-purple-600 font-semibold hover:underline">Sign up</button>
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    /* SIGNUP FORM */
                    <motion.div key="signup" initial={{ opacity: 0, rotateY: 90 }} animate={{ opacity: 1, rotateY: 0 }} exit={{ opacity: 0, rotateY: -90 }} transition={{ duration: 0.4, ease: "easeInOut" }}>
                      <div className="bg-white rounded-2xl p-8 lg:p-10 shadow-xl border border-slate-100">
                        <div className="text-center mb-6">
                          <h2 className="text-2xl font-extrabold text-slate-900 mb-1">Start learning free 🚀</h2>
                          <p className="text-slate-500 text-sm">Join 5,00,000+ learners today</p>
                        </div>

                        {signupError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">⚠️ {signupError}</div>}

                        <form className="space-y-4" onSubmit={handleSignup}>
                          <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Full Name</label>
                            <input type="text" placeholder="Rahul Sharma" value={signupName} onChange={e => setSignupName(e.target.value)}
                              className={`w-full bg-slate-50 border ${signupError && !signupName ? "border-red-400" : "border-slate-200"} focus:border-purple-500 rounded-xl px-4 py-3 text-slate-900 text-sm outline-none transition-colors placeholder:text-slate-400`} />
                          </div>
                          <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Email</label>
                            <input type="email" placeholder="you@example.com" value={signupEmail} onChange={e => setSignupEmail(e.target.value)}
                              className={`w-full bg-slate-50 border ${signupError && !signupEmail ? "border-red-400" : "border-slate-200"} focus:border-purple-500 rounded-xl px-4 py-3 text-slate-900 text-sm outline-none transition-colors placeholder:text-slate-400`} />
                          </div>
                          <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Mobile Number</label>
                            <input type="tel" placeholder="+91 98765 43210" value={signupMobile} onChange={e => setSignupMobile(e.target.value)}
                              className={`w-full bg-slate-50 border ${signupError && !signupMobile ? "border-red-400" : "border-slate-200"} focus:border-purple-500 rounded-xl px-4 py-3 text-slate-900 text-sm outline-none transition-colors placeholder:text-slate-400`} />
                          </div>
                          <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Password</label>
                            <div className="relative">
                              <input type={showSignupPassword ? "text" : "password"} placeholder="Min. 8 characters" value={signupPassword} onChange={e => setSignupPassword(e.target.value)}
                                className={`w-full bg-slate-50 border ${signupError && !signupPassword ? "border-red-400" : "border-slate-200"} focus:border-purple-500 rounded-xl px-4 pr-11 py-3 text-slate-900 text-sm outline-none transition-colors placeholder:text-slate-400`} />
                              <button type="button" onClick={() => setShowSignupPassword(!showSignupPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-600 transition-colors">
                                {showSignupPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                          </div>
                          <motion.button type="submit" disabled={signupLoading}
                            whileHover={!signupLoading ? { scale: 1.02 } : {}} whileTap={!signupLoading ? { scale: 0.97 } : {}}
                            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white text-sm transition-all duration-200 disabled:opacity-50 bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-200">
                            {signupLoading ? <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Loader2 size={16} /></motion.div> Creating account...</> : "Create Free Account"}
                          </motion.button>
                          <p className="text-xs text-slate-400 text-center">
                            By signing up, you agree to our{" "}<a href="#" className="text-purple-600 hover:underline">Terms</a> and{" "}<a href="#" className="text-purple-600 hover:underline">Privacy Policy</a>
                          </p>
                        </form>

                        <p className="text-center text-slate-500 text-sm mt-5">
                          Already have account?{" "}<button onClick={() => { setIsSignup(false); setSignupError(""); }} className="text-purple-600 font-semibold hover:underline">Log in</button>
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

          </div>
        </motion.div>
      </div>

      {/* Forgot Password Sub-Modal */}
      <AnimatePresence>
        {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
      </AnimatePresence>
    </div>,
    document.body
  );
}

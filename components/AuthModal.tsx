"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { X, Loader2, Mail, Eye, EyeOff, User, Lock } from "lucide-react";
import { loginUser, saveToken } from "@/services/auth";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");

  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Signup state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupMobile, setSignupMobile] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState("");

  const resetState = () => {
    setEmail(""); setPassword(""); setError(""); setMode("login");
    setSignupName(""); setSignupEmail(""); setSignupMobile(""); setSignupPassword(""); setSignupError("");
  };

  const handleClose = () => { resetState(); onClose(); };

  const handleLogin = async (e: React.FormEvent) => {
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
      handleClose();
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong!");
    } finally { setLoading(false); }
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
      setMode("login");
      setEmail(signupEmail);
      setSignupName(""); setSignupEmail(""); setSignupMobile(""); setSignupPassword(""); setSignupError("");
    } catch { setSignupError("Something went wrong!"); }
    finally { setSignupLoading(false); }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="md:hidden fixed inset-0 z-[99999]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Bottom Sheet */}
      <div className="absolute inset-x-0 bottom-0 bg-[#0f0f1a] border-t border-white/10 rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto animate-[slideUp_0.3s_ease-out]">
        {/* Handle bar */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        {/* Close */}
        <button onClick={handleClose} className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10">
          <X size={18} />
        </button>

        {mode === "login" ? (
          <div>
            <h2 className="text-xl font-extrabold text-white mb-1">Welcome back! 👋</h2>
            <p className="text-slate-400 text-sm mb-5">Log in to continue your learning journey</p>

            {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2 rounded-xl mb-4">⚠️ {error}</div>}

            <form className="space-y-4" onSubmit={handleLogin}>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="email" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl pl-10 pr-4 py-3 text-white text-sm outline-none placeholder:text-slate-500" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type={showPassword ? "text" : "password"} placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl pl-10 pr-10 py-3 text-white text-sm outline-none placeholder:text-slate-500" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-60">
                {loading ? <><Loader2 size={15} className="animate-spin" /> Logging in...</> : <>Log In →</>}
              </button>
            </form>

            <p className="text-center text-slate-400 text-sm mt-4">
              New here?{" "}<button onClick={() => { setMode("signup"); setError(""); }} className="text-purple-400 font-semibold">Sign up</button>
            </p>
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-extrabold text-white mb-1">Start learning free 🚀</h2>
            <p className="text-slate-400 text-sm mb-5">Join 5,00,000+ learners today</p>

            {signupError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2 rounded-xl mb-4">⚠️ {signupError}</div>}

            <form className="space-y-3.5" onSubmit={handleSignup}>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Full Name</label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="text" placeholder="Rahul Sharma" value={signupName} onChange={e => setSignupName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl pl-10 pr-4 py-3 text-white text-sm outline-none placeholder:text-slate-500" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="email" placeholder="you@example.com" value={signupEmail} onChange={e => setSignupEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl pl-10 pr-4 py-3 text-white text-sm outline-none placeholder:text-slate-500" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Mobile Number</label>
                <input type="tel" placeholder="+91 98765 43210" value={signupMobile} onChange={e => setSignupMobile(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder:text-slate-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type={showSignupPassword ? "text" : "password"} placeholder="Min. 8 characters" value={signupPassword} onChange={e => setSignupPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl pl-10 pr-10 py-3 text-white text-sm outline-none placeholder:text-slate-500" />
                  <button type="button" onClick={() => setShowSignupPassword(!showSignupPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                    {showSignupPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={signupLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-60">
                {signupLoading ? <><Loader2 size={15} className="animate-spin" /> Creating...</> : "Create Free Account"}
              </button>
            </form>

            <p className="text-center text-slate-400 text-sm mt-4">
              Already have account?{" "}<button onClick={() => { setMode("login"); setSignupError(""); }} className="text-purple-400 font-semibold">Log in</button>
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

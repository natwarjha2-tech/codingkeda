"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { X, Eye, EyeOff, Loader2 } from "lucide-react";

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminAuthModal({ isOpen, onClose }: AdminAuthModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (isOpen) { document.body.style.overflow = "hidden"; }
    else { document.body.style.overflow = ""; }
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
      const response = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) return setError(data.message || "Login failed!");
      if (data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("userEmail", data.user?.email || email);
      }
      onClose();
      router.push("/admin/dashboard");
    } catch {
      setError("Something went wrong! Please try again.");
    } finally { setLoading(false); }
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: "radial-gradient(ellipse at top, #1a0533 0%, #0f0f1a 60%)" }}
        >
          {/* Close Button */}
          <button onClick={onClose}
            className="absolute top-4 right-4 z-30 w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white transition-all">
            <X size={16} />
          </button>

          <div className="p-8">
            {/* Badge */}
            <div className="flex justify-center mb-6">
              <span className="bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-semibold px-4 py-1.5 rounded-full">
                🔐 Admin Portal
              </span>
            </div>

            {/* Form Card */}
            <div className="bg-[#16213e] border border-red-500/20 rounded-2xl p-8">
              <h2 className="text-2xl font-extrabold text-white mb-1">Admin Login</h2>
              <p className="text-slate-400 text-sm mb-6">Access the admin dashboard</p>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl mb-4">
                  ⚠️ {error}
                </div>
              )}

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="text-sm font-semibold text-slate-300 block mb-1.5">Email</label>
                  <input type="email" placeholder="admin@codingkeda.com" value={email} onChange={e => setEmail(e.target.value)}
                    className={`w-full bg-white/5 border ${error && !email ? "border-red-500" : "border-white/10"} focus:border-red-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors placeholder:text-slate-500`} />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-300 block mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                      className={`w-full bg-white/5 border ${error && !password ? "border-red-500" : "border-white/10"} focus:border-red-500 rounded-xl px-4 py-3 pr-11 text-white text-sm outline-none transition-colors placeholder:text-slate-500`} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-300 transition-colors">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Logging in...</> : "Login as Admin"}
                </button>
              </form>

              <p className="text-center text-slate-500 text-xs mt-5">
                Not an admin?{" "}
                <button onClick={onClose} className="text-purple-400 hover:underline">Close</button>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>,
    document.body
  );
}

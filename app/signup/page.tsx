"use client"; // ← REQUIRED: this page uses useState, so it must be a Client Component

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Signup() {
  // These hold what the user types
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // These control UI feedback
  const [error, setError] = useState("");       // shows red error message
  const [loading, setLoading] = useState(false); // disables button while waiting

  const router = useRouter(); // used to redirect after success

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // stop page from refreshing
    setError("");        // clear old errors
    setLoading(true);    // show loading state

    try {
      // ── CALL THE BACKEND ──────────────────────────────────────────
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      // ─────────────────────────────────────────────────────────────

      if (!data.success) {
        // Backend sent back an error (e.g. "Email already registered.")
        setError(data.message);
        return;
      }

      // ✅ Success — save the token so the user stays logged in
      localStorage.setItem("token", data.token);

      // Redirect to home page (or /dashboard when you build it)
      router.push("/");

    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false); // always re-enable the button
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,#1a0533_0%,#0f0f1a_60%)] px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 font-extrabold text-xl text-white mb-8">
          <Image src="/logo.jpg" alt="CodingKeda" width={36} height={36} className="rounded-md" />
          CodingKeda
        </Link>
        <div className="bg-[#16213e] border border-white/8 rounded-2xl p-8">
          <h2 className="text-2xl font-extrabold text-white mb-1">Start learning free</h2>
          <p className="text-slate-400 text-sm mb-6">Join 5,00,000+ learners today</p>

          <div className="flex flex-col gap-3 mb-5">
            {[{ icon: "G", label: "Continue with Google" }, { icon: "⌥", label: "Continue with GitHub" }].map(b => (
              <button key={b.label} className="flex items-center justify-center gap-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm font-medium py-3 rounded-xl transition-all">
                <span className="font-bold">{b.icon}</span> {b.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-slate-500 text-xs">or</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          {/* ── ERROR MESSAGE — shown when backend returns an error ── */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-4">
              {error}
            </div>
          )}

          {/* ── FORM — now connected to handleSubmit ── */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="text-sm font-semibold text-slate-300 block mb-1.5">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)} // ← update state on every keystroke
                required
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-300 block mb-1.5">Password</label>
              <input
                type="password"
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)} // ← update state on every keystroke
                required
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors placeholder:text-slate-500"
              />
            </div>

            {/* ── SUBMIT BUTTON — disabled while loading ── */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? "Creating account..." : "Create Free Account"}
            </button>

            <p className="text-xs text-slate-400 text-center">
              By signing up, you agree to our <a href="#" className="text-purple-400 hover:underline">Terms</a> and <a href="#" className="text-purple-400 hover:underline">Privacy Policy</a>
            </p>
          </form>

          <p className="text-center text-slate-400 text-sm mt-5">
            Already have an account? <Link href="/login" className="text-purple-400 font-semibold hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}

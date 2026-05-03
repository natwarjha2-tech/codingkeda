"use client";
import { useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const flow = searchParams.get("flow") || "";
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!fullName || !email || !mobile || !password) return setError("Please fill all fields!");
    if (!email.includes("@")) return setError("Please enter a valid email!");
    if (mobile.length < 10) return setError("Please enter a valid mobile number!");
    if (password.length < 8) return setError("Password must be at least 8 characters!");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fullName, email, password }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.message || "Signup failed.");

      if (flow === "free") {
        router.replace("/login?flow=free");
      } else if (flow === "survey") {
        router.replace("/login?flow=survey");
      } else {
        localStorage.setItem("isNewUser", "true");
        router.replace("/login");
      }
    } catch {
      setError("Something went wrong!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,#1a0533_0%,#0f0f1a_60%)] px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 font-extrabold text-xl text-white mb-8">
          <Image src="/logo.jpg" alt="CodingKeda" width={36} height={36} className="rounded-md" />
          CodingKeda
        </Link>

        <div className="bg-[#16213e] border border-white/8 rounded-2xl p-8">
          <h2 className="text-2xl font-extrabold text-white mb-1">Start learning free 🚀</h2>
          <p className="text-slate-400 text-sm mb-6">Join 5,00,000+ learners today</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl mb-4">
              ⚠️ {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="text-sm font-semibold text-slate-300 block mb-1.5">Full Name</label>
              <input
                type="text"
                placeholder="Rahul Sharma"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={w-full bg-white/5 border ${error && !fullName ? "border-red-500" : "border-white/10"} focus:border-purple-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors placeholder:text-slate-500}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-300 block mb-1.5">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={w-full bg-white/5 border ${error && !email ? "border-red-500" : "border-white/10"} focus:border-purple-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors placeholder:text-slate-500}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-300 block mb-1.5">Mobile Number</label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className={w-full bg-white/5 border ${error && !mobile ? "border-red-500" : "border-white/10"} focus:border-purple-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors placeholder:text-slate-500}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-300 block mb-1.5">Password</label>
              <input
                type="password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={w-full bg-white/5 border ${error && !password ? "border-red-500" : "border-white/10"} focus:border-purple-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors placeholder:text-slate-500}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? "Creating account..." : "Create Free Account"}
            </button>
            <p className="text-xs text-slate-400 text-center">
              By signing up, you agree to our{" "}
              <a href="#" className="text-purple-400 hover:underline">Terms</a> and{" "}
              <a href="#" className="text-purple-400 hover:underline">Privacy Policy</a>
            </p>
          </form>

          <p className="text-center text-slate-400 text-sm mt-5">
            Already have an account?{" "}
            <Link href="/login" className="text-purple-400 font-semibold hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function Signup() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
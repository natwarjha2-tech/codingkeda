"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!email || !password) {
      return setError("Please fill all fields!");
    }
    if (!email.includes("@")) {
      return setError("Please enter a valid email!");
    }
    if (password.length < 8) {
      return setError("Password must be at least 8 characters!");
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return setError(data.message || "Login failed!");
      }

      // Store token in localStorage
      if (data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
      }

      // Redirect to admin dashboard
      router.push("/admin/dashboard");
    } catch (err) {
      setError("Something went wrong! Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,#1a0533_0%,#0f0f1a_60%)] px-6 py-12 pt-28">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-6">
          <span className="bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-semibold px-4 py-1.5 rounded-full">
            🔐 Admin Portal
          </span>
        </div>

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
              <input
                type="email"
                placeholder="admin@codingkeda.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full bg-white/5 border ${error && !email ? "border-red-500" : "border-white/10"} focus:border-red-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors placeholder:text-slate-500`}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-300 block mb-1.5">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full bg-white/5 border ${error && !password ? "border-red-500" : "border-white/10"} focus:border-red-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors placeholder:text-slate-500`}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? "Logging in..." : "Login as Admin"}
            </button>
          </form>

          <p className="text-center text-slate-500 text-xs mt-5">
            Not an admin?{" "}
            <Link href="/login" className="text-purple-400 hover:underline">Go to User Login</Link>
          </p>
        </div>
        </div>
      </main>
    </>
  );
}
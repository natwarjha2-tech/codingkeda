import Image from "next/image";
import Link from "next/link";

export default function Login() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,#1a0533_0%,#0f0f1a_60%)] px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 font-extrabold text-xl text-white mb-8">
          <Image src="/logo.jpg" alt="CodingKeda" width={36} height={36} className="rounded-md" />
          CodingKeda
        </Link>
        <div className="bg-[#16213e] border border-white/8 rounded-2xl p-8">
          <h2 className="text-2xl font-extrabold text-white mb-1">Welcome back</h2>
          <p className="text-slate-400 text-sm mb-6">Log in to continue your learning journey</p>

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

          <form className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-300 block mb-1.5">Email</label>
              <input type="email" placeholder="you@example.com" className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors placeholder:text-slate-500" />
            </div>
            <div>
              <label className="flex justify-between text-sm font-semibold text-slate-300 mb-1.5">
                Password <a href="#" className="text-purple-400 font-medium">Forgot password?</a>
              </label>
              <input type="password" placeholder="••••••••" className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors placeholder:text-slate-500" />
            </div>
            <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl transition-colors">
              Log In
            </button>
          </form>

          <p className="text-center text-slate-400 text-sm mt-5">
            Don&apos;t have an account? <Link href="/signup" className="text-purple-400 font-semibold hover:underline">Sign up free</Link>
          </p>
        </div>
      </div>
    </main>
  );
}

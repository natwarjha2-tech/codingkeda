"use client";
import { useState, useEffect } from "react";

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface Release {
  tag_name: string;
  name: string;
  published_at: string;
  assets: ReleaseAsset[];
}

// GitHub repo details — update owner/repo to match your actual GitHub
const GITHUB_OWNER = "natwarjha2-tech";
const GITHUB_REPO = "codingkidadesktop";

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb.toFixed(1) + " MB";
}

function getPlatformAsset(assets: ReleaseAsset[], platform: "win" | "mac" | "linux") {
  const matchers: Record<string, string[]> = {
    win: [".exe", "Setup"],
    mac: [".dmg"],
    linux: [".AppImage"],
  };
  return assets.find(a =>
    matchers[platform].some(m => a.name.includes(m))
  );
}

export default function DownloadPage() {
  const [release, setRelease] = useState<Release | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`)
      .then(r => r.json())
      .then(data => {
        if (data.tag_name) setRelease(data);
        else setError("No releases found yet.");
      })
      .catch(() => setError("Failed to fetch latest release."))
      .finally(() => setLoading(false));
  }, []);

  const winAsset = release ? getPlatformAsset(release.assets, "win") : null;
  const macAsset = release ? getPlatformAsset(release.assets, "mac") : null;
  const linuxAsset = release ? getPlatformAsset(release.assets, "linux") : null;

  const version = release?.tag_name || "v1.0.0";
  const releaseDate = release?.published_at
    ? new Date(release.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <main className="min-h-screen bg-[#0f0f1a] text-white px-6 py-20">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
            style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}>
            <span className="text-2xl">{"</>"}</span>
          </div>
          <h1 className="text-4xl font-extrabold mb-4">Download CodingKida</h1>
          <p className="text-slate-400 text-lg">
            Learn offline. Access courses, quizzes, AI mentor & more — right from your desktop.
          </p>
          {loading && (
            <div className="mt-4 flex items-center justify-center gap-2 text-slate-500 text-sm">
              <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              Fetching latest version...
            </div>
          )}
          {!loading && release && (
            <div className="mt-4 inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              Latest: <strong className="text-white ml-1">{version}</strong>
              <span className="text-slate-500 ml-2">· {releaseDate}</span>
            </div>
          )}
          {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
        </div>

        {/* Download Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {/* Windows */}
          <div className="bg-[#16213e] border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center hover:border-purple-500/40 transition-colors">
            <div className="text-5xl mb-4">🪟</div>
            <h3 className="font-bold text-lg mb-1">Windows</h3>
            <p className="text-slate-500 text-xs mb-4">Windows 10 / 11 (64-bit)</p>
            {loading ? (
              <div className="w-full py-3 rounded-xl bg-white/5 text-slate-500 text-sm">Loading...</div>
            ) : winAsset ? (
              <a href={winAsset.browser_download_url}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white text-center block transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}>
                Download .exe
                <span className="block text-xs opacity-70 mt-0.5">{formatBytes(winAsset.size)}</span>
              </a>
            ) : (
              <div className="w-full py-3 rounded-xl bg-white/5 text-slate-500 text-sm">Coming Soon</div>
            )}
          </div>

          {/* macOS */}
          <div className="bg-[#16213e] border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center hover:border-purple-500/40 transition-colors">
            <div className="text-5xl mb-4">🍎</div>
            <h3 className="font-bold text-lg mb-1">macOS</h3>
            <p className="text-slate-500 text-xs mb-4">macOS 11+ (Intel & Apple Silicon)</p>
            {loading ? (
              <div className="w-full py-3 rounded-xl bg-white/5 text-slate-500 text-sm">Loading...</div>
            ) : macAsset ? (
              <a href={macAsset.browser_download_url}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white text-center block transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}>
                Download .dmg
                <span className="block text-xs opacity-70 mt-0.5">{formatBytes(macAsset.size)}</span>
              </a>
            ) : (
              <div className="w-full py-3 rounded-xl bg-white/5 text-slate-500 text-sm">Coming Soon</div>
            )}
          </div>

          {/* Linux */}
          <div className="bg-[#16213e] border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center hover:border-purple-500/40 transition-colors">
            <div className="text-5xl mb-4">🐧</div>
            <h3 className="font-bold text-lg mb-1">Linux</h3>
            <p className="text-slate-500 text-xs mb-4">Ubuntu / Debian / Fedora</p>
            {loading ? (
              <div className="w-full py-3 rounded-xl bg-white/5 text-slate-500 text-sm">Loading...</div>
            ) : linuxAsset ? (
              <a href={linuxAsset.browser_download_url}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white text-center block transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}>
                Download .AppImage
                <span className="block text-xs opacity-70 mt-0.5">{formatBytes(linuxAsset.size)}</span>
              </a>
            ) : (
              <div className="w-full py-3 rounded-xl bg-white/5 text-slate-500 text-sm">Coming Soon</div>
            )}
          </div>
        </div>

        {/* Features */}
        <div className="bg-[#16213e] border border-white/10 rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-6 text-center">What you get with the Desktop App</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { icon: "📥", text: "Download lessons for offline viewing" },
              { icon: "🤖", text: "AI Mentor — ask coding questions anytime" },
              { icon: "⚡", text: "Quiz & Exercise — practice per lesson" },
              { icon: "🏆", text: "Leaderboard & Coins rewards" },
              { icon: "🔄", text: "Auto-updates — always get the latest version" },
              { icon: "🔐", text: "Secure — encrypted offline content" },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="text-xl">{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Note */}
        <p className="text-center text-slate-600 text-xs mt-8">
          The app auto-updates when a new version is released. You&apos;ll be notified on next launch.
        </p>
      </div>
    </main>
  );
}

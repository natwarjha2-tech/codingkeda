"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bookmark, BookOpen, Bot, Code2, Globe, Home, LogOut, Menu, RefreshCw, Trophy, User, Video, X } from "lucide-react";
import { CoinsModal, LeaderboardModal, NotificationBell } from "@/components/my/Panels";
import { getToken, logoutUser } from "@/services/auth";
import { api } from "./api";
import { MyContext, type MyUser } from "./MyContext";
import { useLearningTime } from "./useLearningTime";

/**
 * Logged-in student area (/my/*). Mirrors the desktop app: left sidebar,
 * top bar with coins + profile, dark purple theme. Anyone without a login is
 * sent to /login and returned here afterwards.
 */
const NAV = [
  { href: "/my/dashboard", label: "Dashboard", icon: Home },
  { href: "/my/courses", label: "Courses", icon: BookOpen },
  { href: "/my/code", label: "Code Editor", icon: Code2 },
  { href: "/my/live", label: "Live Classes", icon: Video },
  { href: "/my/ai", label: "AI Assistant", icon: Bot },
  { href: "/my/watchlist", label: "Watchlist", icon: Bookmark },
  { href: "/my/profile", label: "Profile", icon: User },
];

export default function MyLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<MyUser | null>(null);
  const [coins, setCoins] = useState(0);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [panel, setPanel] = useState<null | "coins" | "board">(null);

  const refreshCoins = useCallback(() => {
    api("/api/coins").then((d) => setCoins(Number(d?.totalCoins) || 0)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    api("/api/student")
      .then((d) => {
        const s = d?.student;
        setUser({ id: s?.id || "", name: s?.studentName || s?.name || "Learner", email: s?.email || "" });
        setReady(true);
        refreshCoins();
      })
      .catch(() => setReady(true));
  }, [router, refreshCoins]);

  useEffect(() => { setOpen(false); setMenu(false); }, [pathname]);
  useLearningTime(user?.id || "", pathname);

  const logout = () => {
    logoutUser();
    localStorage.removeItem("ck_token");
    localStorage.removeItem("user");
    localStorage.removeItem("userEmail");
    router.replace("/login");
  };

  if (!ready) {
    return <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center text-white/60 font-semibold">Loading your classroom…</div>;
  }

  const initial = (user?.name || "?").trim().charAt(0).toUpperCase();

  const sidebar = (
    <aside className="flex h-full w-60 flex-col bg-[#0B0E14] border-r border-white/10">
      <Link href="/my/dashboard" className="flex items-center gap-2 px-5 py-5 text-lg font-extrabold text-white">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 text-xs">&lt;/&gt;</span>
        CodingKida
      </Link>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((n) => {
          const active = pathname === n.href || (n.href.startsWith("/my/") && pathname.startsWith(n.href));
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                active ? "bg-violet-500/20 text-white border border-violet-400/30" : "text-white/60 hover:bg-white/5 hover:text-white border border-transparent"
              }`}
            >
              <Icon size={18} className={active ? "text-violet-300" : ""} /> {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="m-3 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-rose-500 font-extrabold text-white">
            {initial}
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0B0E14] bg-emerald-500" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-white">{user?.name}</div>
            <div className="text-xs font-bold text-emerald-400">Online</div>
          </div>
        </div>
        <button onClick={logout} title="Logout" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/50 transition hover:border-red-500 hover:bg-red-500 hover:text-white">
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );

  return (
    <MyContext.Provider value={{ user, coins, refreshCoins }}>
      <div className="flex min-h-screen bg-[#0f0f1a] text-white">
        <div className="sticky top-0 hidden h-screen md:block">{sidebar}</div>

        {open && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="h-full">{sidebar}</div>
            <button className="flex-1 bg-black/60" onClick={() => setOpen(false)} aria-label="Close menu" />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center gap-3 bg-[#0f0f1a]/95 px-4 py-2 backdrop-blur md:px-6">
            <button className="rounded-lg p-2 text-white/80 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            <Link href="/" title="Go to the CodingKida website"
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80 hover:bg-violet-500/20 hover:text-white">
              <Globe size={13} /> <span className="hidden sm:inline">CodingKida Website</span>
            </Link>
            <div className="flex-1" />
            <button onClick={() => setPanel("coins")} className="flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 hover:bg-amber-400/20" title="Your coins">
              <span>🪙</span>
              <span className="text-sm font-bold text-amber-300">{coins}</span>
            </button>
            <button onClick={() => setPanel("board")} title="Leaderboard" className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-amber-400/15">
              <Trophy size={15} className="text-amber-400" />
            </button>
            <button onClick={() => window.location.reload()} title="Refresh" className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-emerald-400/15">
              <RefreshCw size={14} className="text-white/75" />
            </button>
            <NotificationBell />
            <div className="relative">
              <button onClick={() => setMenu((m) => !m)} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/20 bg-gradient-to-br from-fuchsia-500 to-pink-500 text-xs font-extrabold">
                {initial}
              </button>
              {menu && (
                <div className="absolute right-0 top-10 z-40 min-w-44 rounded-xl border border-white/10 bg-[#1a1a2e] py-2 shadow-2xl">
                  <Link href="/" className="flex items-center gap-2 px-4 py-2 text-sm font-semibold hover:bg-white/5"><Globe size={14} className="text-sky-300" /> Go to CodingKida Website</Link>
                  <div className="my-1 h-px bg-white/10" />
                  <Link href="/my/profile" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-white/5"><User size={14} className="text-violet-300" /> My Profile</Link>
                  <Link href="/my/report" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-white/5"><BookOpen size={14} className="text-violet-300" /> My Report</Link>
                  <Link href="/my/achievements" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-white/5"><Trophy size={14} className="text-amber-400" /> My Achievements</Link>
                  <Link href="/account/subscription" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-white/5"><BookOpen size={14} className="text-violet-300" /> My Plan</Link>
                  <div className="my-1 h-px bg-white/10" />
                  <button onClick={logout} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-400 hover:bg-white/5"><LogOut size={14} /> Logout</button>
                </div>
              )}
            </div>
          </header>
          <main className={`min-w-0 flex-1 px-4 md:px-6 ${pathname.startsWith("/my/code") || /^\/my\/live\/.+/.test(pathname) ? "" : "pb-10"}`}>{children}</main>
        </div>
        {panel === "coins" && <CoinsModal onClose={() => setPanel(null)} />}
        {panel === "board" && <LeaderboardModal onClose={() => setPanel(null)} />}
      </div>
    </MyContext.Provider>
  );
}

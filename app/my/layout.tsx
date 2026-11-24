"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Bookmark, BookOpen, Code2, Download, Globe, Gift, GraduationCap, Home, Info, Receipt, Star, Store, LogOut, Menu, RefreshCw, Trophy, User, Video, X } from "lucide-react";
import { CoinsModal, LeaderboardModal, NotificationBell } from "@/components/my/Panels";
import { getToken, logoutUser } from "@/services/auth";
import { apiCached, cacheClearUser, cacheDetectUserChange, cachePrefetchAll, cacheSet, tokenTag } from "./api";
import { MyContext, type MyUser } from "./MyContext";
import { useLearningTime } from "./useLearningTime";

/**
 * Logged-in student area (/my/*). Mirrors the desktop app: left sidebar,
 * top bar with coins + profile, dark purple theme. Anyone without a login is
 * sent to /login and returned here afterwards.
 */
/** Each item has its own colour (icon tile + active glow) so kids can find pages by colour. */
const NAV_GROUPS = [
  {
    title: "Learn",
    emoji: "🚀",
    items: [
      { href: "/my/dashboard", label: "Dashboard", icon: Home, color: "#8b5cf6" },
      { href: "/my/courses", label: "Courses", icon: BookOpen, color: "#3b82f6" },
      { href: "/my/code", label: "Code Editor", icon: Code2, color: "#10b981" },
      { href: "/my/live", label: "Live Classes", icon: Video, color: "#ef4444" },
    ],
  },
  {
    title: "My Learning",
    emoji: "🎒",
    items: [
      { href: "/my/report", label: "My Report", icon: BarChart3, color: "#f59e0b" },
      { href: "/my/progress", label: "Student Progress", icon: GraduationCap, color: "#06b6d4" },
      { href: "/my/downloads", label: "Downloads", icon: Download, color: "#22c55e" },
      { href: "/my/watchlist", label: "Watchlist", icon: Bookmark, color: "#a855f7" },
    ],
  },
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
  const [drop, setDrop] = useState<string | null>(null);
  const [xp, setXp] = useState<{ level: number; title: string; xp: number; progressPct: number } | null>(null);

  const refreshCoins = useCallback(() => {
    // After a reward the coins entry was just invalidated, so this fetches fresh.
    apiCached("/api/coins", (d) => setCoins(Number(d?.totalCoins) || 0)).catch(() => {});
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    let prefetched = false;
    // Cached profile → classroom opens instantly; the fresh copy follows silently.
    apiCached("/api/student", (d) => {
      const s = d?.student;
      if (!s?.id) return;
      const u = { id: s.id, name: s.studentName || s.name || "Learner", email: s.email || "" };
      setUser(u);
      // Remembered for offline Downloads + as the cache owner (tied to this login token).
      try { localStorage.setItem("ck_my_user", JSON.stringify({ ...u, t: tokenTag(token) })); } catch { /* ignore */ }
      cacheDetectUserChange(u.id);
      setReady(true);
      if (!prefetched) {
        prefetched = true;
        // The profile is only stored once the owner is known — store it now, then warm every screen.
        cacheSet("/api/student", d);
        refreshCoins();
        cachePrefetchAll();
      }
    }).catch(() => {
      // Offline / server unreachable: fall back to the last signed-in student on this device.
      try { const u = JSON.parse(localStorage.getItem("ck_my_user") || "null"); if (u?.id) setUser(u); } catch { /* ignore */ }
      setReady(true);
    });
  }, [router, refreshCoins]);

  useEffect(() => { setOpen(false); setMenu(false); setDrop(null); }, [pathname]);
  useEffect(() => { if (user?.id) apiCached("/api/xp", (d) => { if (d?.xp) setXp(d.xp); }).catch(() => {}); }, [user?.id, pathname]);

  // Refresh button (desktop refreshAllData): clear this student's cache, then reload fresh.
  const refreshAll = () => { cacheClearUser(); window.location.reload(); };
  useLearningTime(user?.id || "", pathname);

  const logout = () => {
    cacheClearUser();
    logoutUser();
    localStorage.removeItem("ck_token");
    localStorage.removeItem("user");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("ck_my_user");
    router.replace("/login");
  };

  if (!ready) {
    return <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center text-white/60 font-semibold">Loading your classroom…</div>;
  }

  const initial = (user?.name || "?").trim().charAt(0).toUpperCase();

  const sidebar = (
    <aside className="flex h-full w-60 flex-col border-r border-white/[0.07] bg-[#1a1a2e]">
      <Link href="/my/dashboard" className="group flex items-center gap-2.5 border-b border-white/[0.07] px-5 py-5 text-[1.1rem] font-extrabold text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-xs shadow-[0_4px_14px_rgba(168,85,247,0.45)] transition group-hover:rotate-6 group-hover:scale-110">&lt;/&gt;</span>
        <span>Coding<span className="bg-gradient-to-r from-amber-300 to-pink-400 bg-clip-text text-transparent">Kida</span></span>
      </Link>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((g, gi) => (
          <div key={g.title} className={gi ? "mt-5" : ""}>
            <div className="mb-2 flex items-center gap-1.5 px-3 text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-500">
              <span>{g.emoji}</span>{g.title}
            </div>
            <div className="space-y-1">
              {g.items.map((n) => {
                const active = pathname === n.href || (n.href.startsWith("/my/") && pathname.startsWith(n.href));
                const Icon = n.icon;
                return (
                  <Link key={n.href} href={n.href}
                    className={`group relative flex items-center gap-3 rounded-2xl px-2.5 py-2 text-[0.92rem] font-bold transition-all duration-200 ${active ? "text-white" : "text-slate-400 hover:translate-x-1 hover:bg-white/[0.05] hover:text-white"}`}
                    style={active ? { background: `linear-gradient(90deg, ${n.color}33, ${n.color}0d)`, boxShadow: `inset 3px 0 0 ${n.color}, 0 4px 18px ${n.color}22` } : undefined}>
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 ${active ? "scale-105" : "group-hover:-translate-y-0.5 group-hover:rotate-[-6deg] group-hover:scale-110"}`}
                      style={active ? { background: `linear-gradient(135deg, ${n.color}, ${n.color}aa)`, color: "#fff", boxShadow: `0 4px 12px ${n.color}66` } : { background: `${n.color}1f`, color: n.color }}>
                      <Icon size={18} strokeWidth={2.3} />
                    </span>
                    <span className="flex-1 truncate">{n.label}</span>
                    {active && <span className="h-1.5 w-1.5 rounded-full" style={{ background: n.color, boxShadow: `0 0 8px ${n.color}` }} />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Ask Codo — friendly mascot card (opens the AI Assistant) */}
      <Link href="/my/ai" className={`group m-3 flex items-center gap-3 overflow-hidden rounded-2xl border bg-gradient-to-br from-violet-600/30 via-fuchsia-600/15 to-transparent p-3 transition hover:-translate-y-0.5 hover:border-violet-400/50 ${pathname === "/my/ai" ? "border-pink-400/70 shadow-[0_0_18px_rgba(236,72,153,0.35)]" : "border-violet-400/25"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/codo.jpg" alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover ring-2 ring-white/15 transition group-hover:scale-110 group-hover:rotate-3" />
        <span className="min-w-0">
          <span className="block text-sm font-extrabold text-white">Stuck? Ask Codo!</span>
          <span className="block text-[11px] leading-snug text-violet-200/80">Your AI coding buddy 🤖</span>
        </span>
      </Link>
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
            {/* Pages can portal a title here (e.g. the lesson page) so no extra row is needed. */}
            <div id="my-topbar-slot" className="flex min-w-0 items-center gap-3 empty:hidden" />
            <div className="flex-1" />

            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Level / XP (Duolingo style) */}
              {xp && (
                <Link href="/my/achievements" title={`${xp.title} · ${xp.xp} XP`}
                  className="hidden items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 py-1 pl-1 pr-3 transition hover:bg-violet-500/20 lg:flex">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-[11px] font-black text-[#431407]">{xp.level}</span>
                  <span className="flex flex-col leading-none">
                    <span className="text-[11px] font-extrabold text-violet-100">{xp.title}</span>
                    <span className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-gradient-to-r from-amber-400 to-pink-500" style={{ width: `${Math.max(4, Math.min(100, xp.progressPct || 0))}%` }} /></span>
                  </span>
                </Link>
              )}
              <button onClick={() => setPanel("coins")} title="Your coins"
                className="flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-gradient-to-r from-amber-400/15 to-orange-500/10 px-3 py-1.5 transition hover:-translate-y-px hover:from-amber-400/25">
                <span className="text-base leading-none">🪙</span>
                <span className="text-sm font-extrabold text-amber-300">{coins}</span>
              </button>

              {/* Rewards: Refer & Earn + CK Mall — next to coins, where kids spend/earn them */}
              <Drop id="rewards" open={drop} setOpen={setDrop} title="Rewards"
                trigger={<Gift size={16} className="text-pink-300" />} triggerCls="hover:bg-pink-500/15"
                head={<><b className="text-sm">🎁 Rewards</b><span className="text-[11px] text-slate-400">Earn and spend your coins</span></>}>
                <MenuItem href="/my/mall" icon={<Store size={16} />} tint="#fbbf24" label="CK Mall" sub="Spend coins on cool stuff" />
                <MenuItem href="/my/referral" icon={<Gift size={16} />} tint="#f472b6" label="Refer & Earn" sub="Invite friends, win coins" />
              </Drop>

              <button onClick={() => setPanel("board")} title="Leaderboard" className={iconBtn + " hover:bg-amber-400/15"}>
                <Trophy size={16} className="text-amber-400" />
              </button>
              <button onClick={refreshAll} title="Refresh" className={iconBtn + " hidden hover:bg-emerald-400/15 sm:flex"}>
                <RefreshCw size={15} className="text-emerald-300" />
              </button>

              {/* Help — one click straight to Help & Support (no menu needed) */}
              <Link href="/my/help" title="Need help? Ask us!"
                className={`flex h-9 items-center justify-center gap-1.5 rounded-full border border-sky-400/40 bg-gradient-to-r from-sky-500/20 to-cyan-500/10 px-2.5 transition hover:-translate-y-px hover:from-sky-500/30 md:px-3 ${pathname.startsWith("/my/help") ? "ring-2 ring-sky-400/40" : ""}`}>
                <span className="text-base leading-none">🙋</span><span className="hidden text-[13px] font-extrabold text-sky-200 md:inline">Help</span>
              </Link>

              <NotificationBell />

              {/* Profile: account things only */}
              <div className="relative">
                <button onClick={() => { setMenu((m) => !m); setDrop(null); }} title="Your account"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 text-sm font-extrabold ring-2 ring-violet-400/40 ring-offset-2 ring-offset-[#0f0f1a] transition hover:scale-105">
                  {initial}
                </button>
                {menu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
                    <div className="absolute right-0 top-12 z-40 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a2e] shadow-2xl">
                      {/* Profile card */}
                      <div className="relative overflow-hidden bg-gradient-to-br from-violet-600/40 via-fuchsia-600/20 to-transparent p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 text-lg font-extrabold ring-2 ring-white/20">{initial}</div>
                          <div className="min-w-0">
                            <div className="truncate font-extrabold">{user?.name}</div>
                            <div className="truncate text-xs text-slate-300">{user?.email}</div>
                          </div>
                        </div>
                        {xp && (
                          <div className="mt-3 rounded-xl bg-black/25 px-3 py-2">
                            <div className="flex justify-between text-[11px]"><b className="text-amber-300">⭐ Level {xp.level} · {xp.title}</b><span className="text-slate-400">{xp.xp} XP</span></div>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-pink-500" style={{ width: `${Math.max(4, Math.min(100, xp.progressPct || 0))}%` }} /></div>
                          </div>
                        )}
                      </div>
                      <div className="p-1.5">
                        <MenuItem href="/my/profile" icon={<User size={16} />} tint="#a78bfa" label="My Profile" />
                        <MenuItem href="/my/orders" icon={<Receipt size={16} />} tint="#2dd4bf" label="My Orders" />
                        <MenuItem href="/my/rate" icon={<Star size={16} />} tint="#22c55e" label="Rate Us" />
                        <MenuItem href="/my/about" icon={<Info size={16} />} tint="#22d3ee" label="About CodingKida" />
                      </div>
                      <div className="border-t border-white/10 p-1.5">
                        <MenuItem href="/" icon={<Globe size={16} />} tint="#60a5fa" label="Go to CodingKida Website" />
                        <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-400 hover:bg-red-500/10">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10"><LogOut size={16} /></span> Logout
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>
          <main className={`min-w-0 flex-1 px-4 md:px-6 ${pathname.startsWith("/my/code") || /^\/my\/live\/.+/.test(pathname) || pathname === "/my/ai" ? "" : "pb-10"}`}>{children}</main>
        </div>
        {panel === "coins" && <CoinsModal onClose={() => setPanel(null)} />}
        {panel === "board" && <LeaderboardModal onClose={() => setPanel(null)} />}
      </div>
    </MyContext.Provider>
  );
}

const iconBtn = "flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:-translate-y-px";

/** Small top-bar dropdown (Rewards / Help). Only one open at a time via `open` id. */
function Drop({ id, open, setOpen, title, trigger, triggerCls, head, children, wide }: {
  id: string; open: string | null; setOpen: (v: string | null) => void; title: string; wide?: boolean;
  trigger: React.ReactNode; triggerCls: string; head: React.ReactNode; children: React.ReactNode;
}) {
  const isOpen = open === id;
  return (
    <div className="relative">
      <button onClick={() => setOpen(isOpen ? null : id)} title={title}
        className={`${wide ? "flex h-9 items-center justify-center rounded-full border transition hover:-translate-y-px" : iconBtn} ${triggerCls} ${isOpen ? "ring-2 ring-white/15" : ""}`}>{trigger}</button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(null)} />
          <div className="absolute right-0 top-12 z-40 w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a2e] shadow-2xl">
            <div className="flex flex-col gap-0.5 border-b border-white/10 bg-white/[0.03] px-4 py-3">{head}</div>
            <div className="p-1.5" onClick={() => setOpen(null)}>{children}</div>
          </div>
        </>
      )}
    </div>
  );
}

/** Menu row with a coloured icon tile (kid-friendly, easy to scan). */
function MenuItem({ href, icon, tint, label, sub }: { href: string; icon: React.ReactNode; tint: string; label: string; sub?: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition hover:bg-white/[0.06]">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition group-hover:scale-110" style={{ background: `${tint}22`, color: tint }}>{icon}</span>
      <span className="min-w-0">
        <span className="block font-semibold text-white">{label}</span>
        {sub && <span className="block truncate text-[11px] text-slate-400">{sub}</span>}
      </span>
    </Link>
  );
}

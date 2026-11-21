"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Trash2, X } from "lucide-react";
import { api } from "@/app/my/api";

/* ───────────── Modal shell ───────────── */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-violet-400/25 bg-[#16162a] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

/* ───────────── Coins ───────────── */
type Tx = { id: string; type: string; coins: number; reason?: string | null; createdAt: string; courseTitle?: string | null; moduleTitle?: string | null; lessonTitle?: string | null };
type Ach = { id: string; title: string; badgeType?: string | null };

export function CoinsModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<{ totalCoins: number; transactions: Tx[]; achievements: Ach[] } | null>(null);
  useEffect(() => { api("/api/coins").then(setData).catch(() => setData({ totalCoins: 0, transactions: [], achievements: [] })); }, []);
  return (
    <Modal title="My Coins" onClose={onClose}>
      {!data ? <div className="text-white/50">Loading…</div> : (
        <>
          <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-5 text-center">
            <div className="text-4xl">🪙</div>
            <div className="text-4xl font-extrabold text-amber-300">{data.totalCoins}</div>
            <div className="text-sm text-white/60">Earn coins from quizzes, coding and challenges.</div>
          </div>
          {data.achievements.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-sm font-bold">Recent medals</div>
              <div className="flex flex-wrap gap-2">
                {data.achievements.map((a) => <span key={a.id} className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-bold">🏅 {a.title}</span>)}
              </div>
            </div>
          )}
          <div className="mt-4 text-sm font-bold">History</div>
          {data.transactions.length === 0 && <div className="mt-2 text-sm text-white/50">No coins yet. Take a quiz to earn your first coins!</div>}
          <ul className="mt-2 space-y-2">
            {data.transactions.map((t) => {
              const where = [t.courseTitle, t.moduleTitle, t.lessonTitle].filter(Boolean).join(" › ");
              return (
                <li key={t.id} className="flex items-start justify-between gap-3 rounded-xl bg-white/5 p-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-semibold">{t.reason || t.type}</div>
                    {where && <div className="truncate text-xs text-white/50">{where}</div>}
                    <div className="text-[11px] text-white/40">{new Date(t.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className={`shrink-0 font-extrabold ${t.coins >= 0 ? "text-emerald-300" : "text-red-300"}`}>{t.coins >= 0 ? "+" : ""}{t.coins}</div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Modal>
  );
}

/* ───────────── Leaderboards ───────────── */
type Entry = { rank: number; name: string; score: number; isCurrentUser: boolean; [k: string]: unknown };
type Board = { leaderboard: Entry[]; currentUserRank: { rank: number; score: number; totalStudents: number } | null; totalStudents: number };

function BoardList({ board, unit = "%" }: { board: Board | null; unit?: string }) {
  if (!board) return <div className="text-white/50">Loading…</div>;
  if (board.leaderboard.length === 0) return <div className="py-6 text-center text-sm text-white/50">No one is on the board yet. Be the first!</div>;
  const medal = (r: number) => (r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : `#${r}`);
  return (
    <div>
      {board.currentUserRank && (
        <div className="mb-3 rounded-xl border border-violet-400/30 bg-violet-500/15 p-3 text-center text-sm">
          Your rank <b className="text-lg text-violet-200">#{board.currentUserRank.rank}</b> of {board.currentUserRank.totalStudents} · score {board.currentUserRank.score}{unit}
        </div>
      )}
      <ul className="space-y-1.5">
        {board.leaderboard.map((e) => (
          <li key={e.rank} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${e.isCurrentUser ? "border border-violet-400/40 bg-violet-500/20" : "bg-white/5"}`}>
            <span className="w-9 text-center font-extrabold">{medal(e.rank)}</span>
            <span className="flex-1 truncate font-semibold">{e.name}{e.isCurrentUser ? " (You)" : ""}</span>
            <span className="font-bold text-amber-300">{e.score}{unit}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Top-bar leaderboard: pick one of your courses and see how everyone ranks. */
export function LeaderboardModal({ onClose }: { onClose: () => void }) {
  const [courses, setCourses] = useState<{ id: string; title: string }[] | null>(null);
  const [courseId, setCourseId] = useState("");
  const [board, setBoard] = useState<Board | null>(null);

  useEffect(() => {
    api("/api/student/dashboard")
      .then((d) => { const c = d.enrolledCourses || []; setCourses(c); if (c[0]) setCourseId(c[0].id); })
      .catch(() => setCourses([]));
  }, []);
  useEffect(() => {
    if (!courseId) return;
    setBoard(null);
    api(`/api/leaderboard?courseId=${encodeURIComponent(courseId)}`).then(setBoard).catch(() => setBoard({ leaderboard: [], currentUserRank: null, totalStudents: 0 }));
  }, [courseId]);

  return (
    <Modal title="🏆 Leaderboard" onClose={onClose}>
      {courses && courses.length === 0 && <div className="py-6 text-center text-sm text-white/50">Enrol in a course to join its leaderboard.</div>}
      {courses && courses.length > 0 && (
        <>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="mb-3 w-full rounded-xl border border-white/15 bg-[#1a1a2e] px-3 py-2.5 text-sm font-semibold">
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <BoardList board={board} />
        </>
      )}
      {!courses && <div className="text-white/50">Loading…</div>}
    </Modal>
  );
}

/** 🏆 under a lesson video: who did best in THIS lesson's quiz or coding exercise. */
export function LessonBoardModal({ lessonId, onClose }: { lessonId: string; onClose: () => void }) {
  const [type, setType] = useState<"quiz" | "exercise">("quiz");
  const [board, setBoard] = useState<Board | null>(null);
  useEffect(() => {
    setBoard(null);
    api(`/api/leaderboard/lesson?lessonId=${encodeURIComponent(lessonId)}&type=${type}`).then(setBoard).catch(() => setBoard({ leaderboard: [], currentUserRank: null, totalStudents: 0 }));
  }, [lessonId, type]);
  return (
    <Modal title="🏆 Lesson Leaderboard" onClose={onClose}>
      <div className="mb-3 flex gap-2">
        {(["quiz", "exercise"] as const).map((t) => (
          <button key={t} onClick={() => setType(t)} className={`rounded-full border px-4 py-1.5 text-xs font-bold ${type === t ? "border-violet-400 bg-violet-500/25" : "border-white/10 bg-white/5 text-white/60"}`}>
            {t === "quiz" ? "📝 Quiz" : "💻 Coding"}
          </button>
        ))}
      </div>
      <BoardList board={board} />
    </Modal>
  );
}

/* ───────────── Notifications ───────────── */
type Notif = { id: string; type: string; title: string; body: string; read: boolean; createdAt: string; action?: { type?: string; target?: string } | null; metadata?: Record<string, unknown> | null };

/** Turn a notification's app deeplink into the matching classroom page. */
function notifHref(n: Notif): string | null {
  const a = n.action;
  if (!a?.target) return null;
  if (a.type === "external") return /^https:\/\//.test(a.target) ? a.target : null;
  const t = a.target;
  const meta = n.metadata || {};
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^\/courses\/([^/?#]+)/))) return `/my/courses/${m[1]}`;
  if ((m = t.match(/^\/lesson\/([^/?#]+)/))) return meta.courseId ? `/my/lesson/${m[1]}?course=${meta.courseId}` : "/my/courses";
  if (t.startsWith("/certificate")) return "/my/certificates";
  const map: Record<string, string> = { "/courses": "/my/courses", "/achievements": "/my/achievements", "/coding": "/my/code", "/coins": "/my/mall", "/mall": "/my/mall", "/live": "/my/live" };
  return map[t] || null;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(() => {
    api("/api/notifications", { method: "POST", json: { action: "sync", limit: 30 } })
      .then((d) => { setItems(d.items || []); setUnread(d.unreadCount || 0); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const act = (action: string, id?: string) =>
    api("/api/notifications", { method: "POST", json: { action, id } }).then(load).catch(() => {});

  return (
    <div className="relative">
      <button onClick={() => { setOpen((o) => !o); if (!open) load(); }} title="Notifications"
        className="relative flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-violet-500/20">
        <Bell size={15} className="text-white/80" />
        {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-[22rem] max-w-[92vw] overflow-hidden rounded-2xl border border-violet-400/25 bg-[#16213e] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <b>Notifications</b>
              <div className="flex gap-3 text-xs">
                <button onClick={() => act("mark-all-read")} className="font-semibold text-violet-300 hover:text-white">Mark all read</button>
                <button onClick={() => act("clear-all")} className="flex items-center gap-1 text-white/50 hover:text-red-300"><Trash2 size={12} /> Clear</button>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 && <div className="p-8 text-center text-sm text-white/50">You&apos;re all caught up 🎉</div>}
              {items.map((n) => (
                <div key={n.id} onClick={() => {
                  if (!n.read) act("mark-read", n.id);
                  const href = notifHref(n);
                  if (href) { setOpen(false); if (href.startsWith("http")) window.open(href, "_blank", "noopener"); else router.push(href); }
                }} className={`cursor-pointer border-b border-white/5 px-4 py-3 hover:bg-white/5 ${n.read ? "opacity-60" : "bg-violet-500/10"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-bold">{!n.read && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-violet-400" />}{n.title}</div>
                    <button onClick={(e) => { e.stopPropagation(); act("delete", n.id); }} className="text-white/30 hover:text-red-300" aria-label="Delete"><X size={13} /></button>
                  </div>
                  <div className="mt-0.5 whitespace-pre-line text-xs text-white/70">{n.body}</div>
                  <div className="mt-1 text-[10px] text-white/40">{new Date(n.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

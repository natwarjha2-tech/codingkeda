"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookmarkCheck, Play, Trash2 } from "lucide-react";
import { useMy } from "../MyContext";
import { readWatchlist, removeSaved, type SavedLesson } from "../watchlist";
import { subjectTheme } from "../ui";

/** Watchlist — bookmarked lessons, full kids-friendly layout */
export default function Watchlist() {
  const { user } = useMy();
  const who = user?.email || "";
  const [items, setItems] = useState<SavedLesson[] | null>(null);

  useEffect(() => { setItems(readWatchlist(who)); }, [who]);

  const remove = (lessonId: string) => {
    removeSaved(who, lessonId);
    setItems(readWatchlist(who));
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] pt-2">
      {/* Header */}
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-violet-400/15 bg-gradient-to-br from-[#0d0b2a] to-[#1a0a3e] px-7 py-7">
        <div className="pointer-events-none absolute -right-10 -top-10 h-72 w-72 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/20 text-3xl">🔖</div>
            <div>
              <h1 className="text-2xl font-extrabold md:text-3xl">Watchlist</h1>
              <p className="text-slate-400">Lessons you saved to watch later</p>
            </div>
          </div>
          {items && items.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-violet-400/25 bg-violet-500/10 px-4 py-2">
              <BookmarkCheck size={16} className="text-violet-300" />
              <span className="text-sm font-bold text-violet-200">{items.length} saved lesson{items.length > 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      </section>

      {/* Empty state */}
      {items && items.length === 0 && (
        <div className="relative overflow-hidden rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-600/8 to-pink-500/5 py-20 text-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_80%,rgba(139,92,246,0.06),transparent_60%)]" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-3xl border border-violet-400/25 bg-violet-500/15 text-5xl">🔖</div>
            <h3 className="text-xl font-extrabold">Your watchlist is empty</h3>
            <p className="mx-auto mt-2 max-w-sm text-slate-400">Open any lesson and tap <b>Save</b> under the video to bookmark it here for later.</p>
            <Link href="/my/courses" className="mt-6 inline-block rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-7 py-3 text-sm font-bold shadow-[0_3px_14px_rgba(139,92,246,0.4)]">
              Browse courses →
            </Link>
          </div>
        </div>
      )}

      {/* Grid */}
      {items && items.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((s) => {
            const th = subjectTheme(s.courseTitle);
            return (
              <div key={s.lessonId} className="group overflow-hidden rounded-2xl border border-white/[0.07] bg-[#161B22] shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition hover:-translate-y-1">
                {/* Top colour strip */}
                <div className="relative flex h-16 items-center justify-center overflow-hidden" style={{ background: th.gradient }}>
                  <div className="absolute inset-0 opacity-50 bg-black/20" />
                  <BookmarkCheck size={22} className="relative z-10 text-white/80" />
                </div>
                <div className="p-4">
                  <div className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">{s.courseTitle}</div>
                  <h4 className="mb-3 text-sm font-extrabold leading-snug">{s.title}</h4>
                  <div className="flex items-center gap-2">
                    <Link href={`/my/lesson/${s.lessonId}?course=${s.courseId}`}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-white transition hover:brightness-110"
                      style={{ background: `linear-gradient(135deg,${th.accent},${th.accent}bb)`, boxShadow: `0 3px 10px ${th.accent}44` }}>
                      <Play size={12} fill="#fff" /> Watch
                    </Link>
                    <button onClick={() => remove(s.lessonId)} title="Remove from watchlist"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-slate-500 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="mt-2.5 text-[10px] text-slate-600">{new Date(s.savedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

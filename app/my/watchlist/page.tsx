"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useMy } from "../MyContext";
import { readWatchlist, removeSaved, type SavedLesson } from "../watchlist";

export default function Watchlist() {
  const { user } = useMy();
  const who = user?.email || "";
  const [items, setItems] = useState<SavedLesson[] | null>(null);

  useEffect(() => { setItems(readWatchlist(who)); }, [who]);

  return (
    <div className="mx-auto max-w-3xl space-y-4 pt-2">
      <div>
        <h1 className="text-3xl font-extrabold">Watchlist</h1>
        <p className="text-white/60">Lessons you saved to watch again.</p>
      </div>
      {items && items.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-10 text-center">
          <div className="text-5xl">🔖</div>
          <p className="mt-2 text-white/60">Nothing saved yet. Tap <b>Save</b> under any lesson video.</p>
          <Link href="/my/courses" className="mt-4 inline-block rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold hover:bg-violet-500">Browse courses</Link>
        </div>
      )}
      <ul className="space-y-2">
        {items?.map((s) => (
          <li key={s.lessonId} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <Link href={`/my/lesson/${s.lessonId}?course=${s.courseId}`} className="min-w-0 flex-1">
              <div className="truncate font-bold">{s.title}</div>
              <div className="truncate text-xs text-white/50">{s.courseTitle}</div>
            </Link>
            <button onClick={() => { removeSaved(who, s.lessonId); setItems(readWatchlist(who)); }} className="rounded-lg p-2 text-white/40 hover:bg-red-500/15 hover:text-red-300" aria-label="Remove"><Trash2 size={16} /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}

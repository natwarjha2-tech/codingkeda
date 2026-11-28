"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { clearLocalSession, getToken, isExpiredGuest, saveToken } from "@/services/auth";

/**
 * /try/<lessonId>?course=<courseId>
 * Entry from the public free-lesson list. Logged-in students go straight to the
 * lesson in My Classroom. Visitors get a temporary guest account (no form) and
 * land in the same classroom, where quizzes, coins and badges work normally.
 */
export default function TryLessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const [err, setErr] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const course = q.get("course") || "";
    // ?exercise=<id> → a free coding question: open it in the classroom code editor.
    const exercise = q.get("exercise") || "";
    const go = (courseId: string) =>
      window.location.replace(exercise
        ? `/my/code?exercise=${encodeURIComponent(exercise)}&lesson=${encodeURIComponent(lessonId)}&course=${encodeURIComponent(courseId)}`
        : `/my/lesson/${encodeURIComponent(lessonId)}?course=${encodeURIComponent(courseId)}`);

    // An old guest login whose 4 hours are over can't be used: start a new guest.
    if (isExpiredGuest()) clearLocalSession();
    // Signed in (or a guest still in their session): open the lesson directly.
    if (getToken() && course) { go(course); return; }

    (async () => {
      try {
        const res = await fetch("/api/guest/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || !d.token) throw new Error(d.message || "Could not open the lesson.");
        // A signed-in student without a course id in the link: keep their login.
        if (getToken()) { go(d.courseId); return; }
        saveToken(d.token);
        go(d.courseId);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not open the lesson.");
      }
    })();
  }, [lessonId]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0f1a] px-5 text-white">
      {err ? (
        <div className="max-w-md rounded-3xl border border-white/10 bg-[#1a1a2e] p-7 text-center">
          <div className="text-5xl">😕</div>
          <h1 className="mt-3 text-xl font-extrabold">{err}</h1>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href={`/free-learning/${lessonId}`} className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-bold hover:bg-white/5">▶ Watch the video here</Link>
            <Link href="/signup" className="rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-5 py-2.5 text-sm font-bold">Sign up free</Link>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-violet-400/30 border-t-violet-400" />
          <p className="mt-4 font-semibold text-white/70">Opening your free lesson in My Classroom…</p>
        </div>
      )}
    </div>
  );
}

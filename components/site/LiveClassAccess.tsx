"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getToken } from "@/services/auth";

/**
 * Shows what the student can do for a live class: log in, subscribe, or join
 * in the app. The real access check happens on the server when joining
 * (/api/live/classes/[id]/join); this only guides the student.
 */
export default function LiveClassAccess({ courseId, live }: { courseId: string; live: boolean }) {
  const [state, setState] = useState<"loading" | "guest" | "enrolled" | "not-enrolled">("loading");

  useEffect(() => {
    const token = getToken();
    if (!token) { setState("guest"); return; }
    fetch("/api/student/subscription", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list: { courseId: string; accessEndsAt: string | null }[] = d?.subscription?.enrolledCourses ?? [];
        const ok = list.some((e) => e.courseId === courseId && (!e.accessEndsAt || new Date(e.accessEndsAt) > new Date()));
        setState(d ? (ok ? "enrolled" : "not-enrolled") : "guest");
      })
      .catch(() => setState("guest"));
  }, [courseId]);

  if (state === "loading") return <div className="h-14 rounded-2xl bg-[#F3F4F6] animate-pulse" />;

  if (state === "guest") {
    const back = typeof window !== "undefined" ? window.location.pathname : "/live-classes";
    return (
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href={`/login?redirect=${encodeURIComponent(back)}`} className="rounded-2xl bg-[#7C3AED] px-6 py-4 text-center text-lg font-black text-white border-b-[6px] border-[#5B21B6]">
          🔐 Log in to join
        </Link>
        <Link href="/login?mode=signup" className="rounded-2xl bg-white px-6 py-4 text-center font-black text-[#6D28D9] border-2 border-[#DDD6FE]">Create free account</Link>
      </div>
    );
  }

  if (state === "enrolled") {
    return (
      <div className="rounded-[24px] bg-[#DCFCE7] border-2 border-[#86EFAC] p-5">
        <p className="text-lg font-black text-[#15803D]">✅ You can join this class</p>
        <p className="mt-1 text-[#374151]">
          {live ? "The class is live now. Open the CodingKida app and go to Live Classes to join." : "Open the CodingKida app at class time and go to Live Classes to join."}
        </p>
        <Link href="/download" className="mt-3 inline-block rounded-xl bg-[#22C55E] px-5 py-2 font-black text-white">Open / get the app</Link>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] bg-[#FFF7E6] border-2 border-[#FDE68A] p-5">
      <p className="text-lg font-black">🎟️ This class is for students of this course</p>
      <p className="mt-1 text-[#4B5563]">Get the course plan to join this and every other live class in the course.</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Link href={`/pricing?course=${encodeURIComponent(courseId)}`} className="rounded-xl bg-[#7C3AED] px-5 py-2 font-black text-white">See plans</Link>
        <Link href={`/courses/${encodeURIComponent(courseId)}`} className="rounded-xl bg-white px-5 py-2 font-black text-[#6D28D9] border-2 border-[#DDD6FE]">About the course</Link>
      </div>
    </div>
  );
}

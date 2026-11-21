"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Plays a free sample lesson. Uses the existing GET /api/lessons/[id]/play,
 * which returns a signed MP4 link for free lessons without login.
 */
export default function FreeLessonPlayer({ lessonId, nextHref, nextTitle }: { lessonId: string; nextHref: string | null; nextTitle: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "locked" | "error">("loading");
  const [ended, setEnded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/lessons/${encodeURIComponent(lessonId)}/play`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const l = d?.lesson;
        if (!d?.success || !l) return setState("error");
        if (l.locked) return setState("locked");
        const q = l.qualityUrls && typeof l.qualityUrls === "object" ? (l.qualityUrls["480p"] || l.qualityUrls["720p"] || Object.values(l.qualityUrls)[0]) : null;
        const src = (q as string | null) || l.videoUrl || null;
        if (!src) return setState("error");
        setUrl(src);
        setState("ready");
      })
      .catch(() => !cancelled && setState("error"));
    return () => { cancelled = true; };
  }, [lessonId]);

  return (
    <div>
      <div className="relative aspect-video rounded-[28px] overflow-hidden bg-[#0F0D2E] border-4 border-white shadow-xl">
        {state === "loading" && <div className="absolute inset-0 flex items-center justify-center text-white/70 font-bold">Loading video… ⏳</div>}
        {state === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <div className="text-5xl">📺</div>
            <p className="font-black">This video could not load right now.</p>
            <p className="text-white/70">Please try again in a minute, or watch it in the CodingKida app.</p>
          </div>
        )}
        {state === "locked" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <div className="text-5xl">🔒</div>
            <p className="font-black">This lesson is no longer free.</p>
            <Link href="/pricing" className="rounded-xl bg-[#FFD84D] px-5 py-2 font-black text-[#7C2D12]">See plans</Link>
          </div>
        )}
        {state === "ready" && url && (
          <video
            ref={videoRef}
            src={url}
            controls
            playsInline
            controlsList="nodownload"
            onEnded={() => setEnded(true)}
            className="w-full h-full object-contain bg-black"
          />
        )}
      </div>

      {/* Upgrade prompt after the free sample ends (blueprint: "upgrade prompt when free content ends"). */}
      {ended && (
        <div className="mt-6 rounded-[28px] bg-[#FFF7E6] border-2 border-[#FDE68A] border-b-8 p-6 text-center">
          <div className="text-5xl">🎉</div>
          <h3 className="mt-2 text-2xl font-black">Great job finishing the lesson!</h3>
          <p className="mt-1 text-[#4B5563]">The full course has the quiz, a coding exercise and medals for this lesson.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {nextHref && <Link href={nextHref} className="rounded-2xl bg-[#22C55E] px-6 py-3 font-black text-white border-b-[5px] border-[#15803D]">Next free lesson: {nextTitle} →</Link>}
            <Link href="/pricing" className="rounded-2xl bg-[#7C3AED] px-6 py-3 font-black text-white border-b-[5px] border-[#5B21B6]">Unlock the full course</Link>
            <Link href="/login?mode=signup" className="rounded-2xl bg-white px-6 py-3 font-black text-[#6D28D9] border-2 border-[#DDD6FE]">Save my progress (sign up)</Link>
          </div>
        </div>
      )}
    </div>
  );
}

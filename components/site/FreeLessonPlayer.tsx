"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import HlsPlayer from "@/components/learn/HlsPlayer";

/**
 * Plays a free sample lesson. Uses the existing GET /api/lessons/[id]/play,
 * which returns signed video links for free lessons without login.
 *
 * Source order: the original uploaded MP4 first, then any quality MP4s. If a
 * source errors or does not start within 15 s, the next one is tried. If none
 * work, a clear message replaces the endless spinner.
 */
const STALL_MS = 15_000;

export default function FreeLessonPlayer({ lessonId, nextHref, nextTitle }: { lessonId: string; nextHref: string | null; nextTitle: string | null }) {
  const [sources, setSources] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "playing" | "locked" | "error">("loading");
  const [ended, setEnded] = useState(false);
  // HLS through CloudFront first; the MP4 chain below is only the fallback.
  const [mode, setMode] = useState<"hls" | "mp4">("hls");
  const videoRef = useRef<HTMLVideoElement>(null);
  const stallTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/lessons/${encodeURIComponent(lessonId)}/play`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const l = d?.lesson;
        if (!d?.success || !l) return setState("error");
        if (l.locked) return setState("locked");
        const q: Record<string, string> = l.qualityUrls && typeof l.qualityUrls === "object" ? l.qualityUrls : {};
        const list = [l.videoUrl, q["720p"], q["480p"], q["360p"], ...Object.values(q)]
          .filter((u): u is string => typeof u === "string" && u.length > 0);
        const unique = Array.from(new Set(list));
        if (!unique.length) return setState("error");
        setSources(unique);
        setIndex(0);
        setState("ready");
      })
      .catch(() => !cancelled && setState("error"));
    return () => { cancelled = true; };
  }, [lessonId]);

  const clearStall = () => { if (stallTimer.current) { clearTimeout(stallTimer.current); stallTimer.current = null; } };

  // Move to the next source, or give up with a clear message.
  const tryNext = useCallback(() => {
    clearStall();
    setIndex((i) => {
      if (i + 1 < sources.length) return i + 1;
      setState("error");
      return i;
    });
  }, [sources.length]);

  // Each time a source is loaded, give it 15 s to become playable.
  useEffect(() => {
    if (mode !== "mp4" || state !== "ready" || !sources[index]) return;
    clearStall();
    stallTimer.current = setTimeout(tryNext, STALL_MS);
    return clearStall;
  }, [mode, state, index, sources, tryNext]);

  const src = sources[index];

  return (
    <div>
      <div className="relative aspect-video rounded-[28px] overflow-hidden bg-[#0F0D2E] border-4 border-white shadow-xl">
        {state === "loading" && <div className="absolute inset-0 flex items-center justify-center text-white/70 font-bold">Loading video… ⏳</div>}
        {state === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <div className="text-5xl">📺</div>
            <p className="font-black text-lg">This video plays best in the CodingKida app.</p>
            <p className="text-white/70">The free lesson is also free in the app, no payment needed.</p>
            <Link href="/download" className="rounded-xl bg-[#FFD84D] px-5 py-2 font-black text-[#7C2D12]">Get the free app</Link>
          </div>
        )}
        {state === "locked" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <div className="text-5xl">🔒</div>
            <p className="font-black">This lesson is no longer free.</p>
            <Link href="/pricing" className="rounded-xl bg-[#FFD84D] px-5 py-2 font-black text-[#7C2D12]">See plans</Link>
          </div>
        )}
        {(state === "ready" || state === "playing") && mode === "hls" && (
          <HlsPlayer
            lessonId={lessonId}
            onPlaying={() => setState("playing")}
            onEnded={() => setEnded(true)}
            onFail={() => setMode("mp4")}
          />
        )}
        {(state === "ready" || state === "playing") && mode === "mp4" && src && (
          <video
            key={src}
            ref={videoRef}
            src={src}
            controls
            playsInline
            preload="metadata"
            controlsList="nodownload"
            onLoadedData={clearStall}
            onCanPlay={clearStall}
            onPlaying={() => { clearStall(); setState("playing"); }}
            onError={tryNext}
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

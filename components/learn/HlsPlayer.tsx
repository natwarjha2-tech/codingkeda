"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Settings2 } from "lucide-react";
import { getToken } from "@/services/auth";

/**
 * Streams a lesson with HLS through CloudFront (no MP4), using
 * GET /api/lessons/[id]/web-hls. hls.js is served from /vendor/hls.min.js and
 * loaded on demand.
 *
 * - The playlist request carries the login token (same-origin only). Segment
 *   requests go to CloudFront with a signed query already inside the playlist,
 *   so no token is sent to a third-party domain.
 * - A name watermark drifts over the picture to discourage screen recording.
 * - If HLS is unavailable or fails fatally, onFail() is called so the caller
 *   can decide what to do (free lessons may fall back to MP4, paid never do).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { Hls?: any }
}

type Level = { index: number; label: string };

let hlsLoader: Promise<any> | null = null;
function loadHls(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Hls) return Promise.resolve(window.Hls);
  if (!hlsLoader) {
    hlsLoader = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "/vendor/hls.min.js";
      s.async = true;
      s.onload = () => (window.Hls ? resolve(window.Hls) : reject(new Error("hls.js missing")));
      s.onerror = () => { hlsLoader = null; reject(new Error("hls.js failed to load")); };
      document.head.appendChild(s);
    });
  }
  return hlsLoader;
}

export default function HlsPlayer({
  lessonId,
  watermark,
  autoPlay = false,
  onPlaying,
  onEnded,
  onFail,
  onTimeUpdate,
  src,
  onQualityChange,
  settingsSlot,
}: {
  /** If given, the quality/speed control renders here (outside the video) and the video uses its own fullscreen button. */
  settingsSlot?: HTMLElement | null;
  lessonId: string;
  /** Offline playback: a blob: playlist URL from app/my/offline.ts (no network, no auth). */
  src?: string;
  /** Reports the chosen quality label ("720p"), or null for Auto. */
  onQualityChange?: (label: string | null) => void;
  watermark?: string;
  autoPlay?: boolean;
  onPlaying?: () => void;
  onEnded?: () => void;
  onFail?: (reason: string) => void;
  onTimeUpdate?: (currentSeconds: number, durationSeconds: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<any>(null);
  const [pos, setPos] = useState({ top: 12, left: 12 });
  const failRef = useRef(onFail);
  failRef.current = onFail;

  // Quality (like the apps): Auto by default + every rendition in the stream.
  const [levels, setLevels] = useState<Level[]>([]);
  const [chosen, setChosen] = useState<number>(-1);     // -1 = Auto
  const [playingLevel, setPlayingLevel] = useState<number>(-1);
  const [speed, setSpeed] = useState(1);
  const [menu, setMenu] = useState<null | "main" | "quality" | "speed">(null);
  const [fs, setFs] = useState(false);

  const pickQuality = (idx: number) => {
    const h = hlsRef.current;
    if (h) h.currentLevel = idx; // -1 → adaptive (Auto)
    setChosen(idx);
    onQualityChange?.(idx === -1 ? null : levels.find((l) => l.index === idx)?.label || null);
    setMenu(null);
  };
  const pickSpeed = (s: number) => {
    if (videoRef.current) videoRef.current.playbackRate = s;
    setSpeed(s);
    setMenu(null);
  };
  // Fullscreen the whole player (not just <video>) so the watermark and menu stay visible.
  const toggleFs = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  };
  useEffect(() => {
    const h = () => setFs(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  const labelFor = (i: number) => levels.find((l) => l.index === i)?.label || "";
  const qualityText = chosen === -1 ? `Auto${playingLevel >= 0 && labelFor(playingLevel) ? ` (${labelFor(playingLevel)})` : ""}` : labelFor(chosen);

  useEffect(() => {
    let hls: any = null;
    let cancelled = false;
    const video = videoRef.current;
    if (!video) return;
    const offline = !!src;
    const url = src || `/api/lessons/${encodeURIComponent(lessonId)}/web-hls?file=master.m3u8`;
    const fail = (why: string) => { if (!cancelled) failRef.current?.(why); };

    loadHls()
      .then((Hls) => {
        if (cancelled) return;
        if (Hls.isSupported()) {
          hls = new Hls({
            xhrSetup: (xhr: XMLHttpRequest, reqUrl: string) => {
              if (offline) return;
              try {
                const u = new URL(reqUrl, window.location.href);
                const token = getToken();
                if (u.origin === window.location.origin && token) {
                  xhr.setRequestHeader("Authorization", `Bearer ${token}`);
                }
              } catch { /* ignore */ }
            },
          });
          hls.on(Hls.Events.ERROR, (_e: unknown, data: any) => {
            if (!data?.fatal) return;
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
            } else {
              fail(`hls ${data.type}`);
            }
          });
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            const seen = new Set<string>();
            const list: Level[] = (hls.levels || [])
              .map((l: any, index: number) => ({ index, height: l.height || 0, bitrate: l.bitrate || 0 }))
              .sort((a: any, b: any) => b.height - a.height || b.bitrate - a.bitrate)
              .map((l: any) => ({ index: l.index, label: l.height ? `${l.height}p` : `${Math.round(l.bitrate / 1000)} kbps` }))
              .filter((l: Level) => (seen.has(l.label) ? false : (seen.add(l.label), true)));
            setLevels(list);
            setChosen(-1);
          });
          hls.on(Hls.Events.LEVEL_SWITCHED, (_e: unknown, data: any) => setPlayingLevel(data?.level ?? -1));
          hlsRef.current = hls;
          hls.loadSource(url);
          hls.attachMedia(video);
        } else if (!offline && video.canPlayType("application/vnd.apple.mpegurl")) {
          // Native HLS (iPhone Safari). Cannot send the auth header, so this
          // only works for free lessons; paid lessons report failure.
          video.src = url;
        } else {
          fail("hls unsupported");
        }
      })
      .catch(() => fail("hls.js load failed"));

    return () => {
      cancelled = true;
      if (hls) hls.destroy();
      hlsRef.current = null;
      setLevels([]); setChosen(-1); setPlayingLevel(-1); setMenu(null);
    };
  }, [lessonId, src]);

  // Drift the watermark to a new random spot every 7 seconds.
  useEffect(() => {
    if (!watermark) return;
    const t = setInterval(() => {
      setPos({ top: 8 + Math.random() * 78, left: 4 + Math.random() * 62 });
    }, 7000);
    return () => clearInterval(t);
  }, [watermark]);

  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  const row = "flex w-full items-center justify-between gap-6 px-4 py-2 text-left text-sm hover:bg-white/10";
  const slotted = !!settingsSlot;

  const menuBody = menu && (
    <>
      {menu === "main" && (
        <>
          <button className={row} onClick={() => setMenu("quality")}><span>Quality</span><span className="text-white/60">{qualityText || "Auto"} ›</span></button>
          <button className={row} onClick={() => setMenu("speed")}><span>Playback speed</span><span className="text-white/60">{speed === 1 ? "Normal" : `${speed}x`} ›</span></button>
        </>
      )}
      {menu === "quality" && (
        <>
          <button className={`${row} text-white/60`} onClick={() => setMenu("main")}>‹ Quality</button>
          <button className={row} onClick={() => pickQuality(-1)}>
            <span>Auto{playingLevel >= 0 && labelFor(playingLevel) ? ` (${labelFor(playingLevel)})` : ""}</span>{chosen === -1 && <span className="text-violet-300">✓</span>}
          </button>
          {levels.map((l) => (
            <button key={l.index} className={row} onClick={() => pickQuality(l.index)}>
              <span>{l.label}</span>{chosen === l.index && <span className="text-violet-300">✓</span>}
            </button>
          ))}
          {levels.length === 0 && <div className="px-4 py-2 text-xs text-white/50">Only Auto is available for this video.</div>}
        </>
      )}
      {menu === "speed" && (
        <>
          <button className={`${row} text-white/60`} onClick={() => setMenu("main")}>‹ Playback speed</button>
          {SPEEDS.map((s) => (
            <button key={s} className={row} onClick={() => pickSpeed(s)}>
              <span>{s === 1 ? "Normal" : `${s}x`}</span>{speed === s && <span className="text-violet-300">✓</span>}
            </button>
          ))}
        </>
      )}
    </>
  );

  // Outside the player (lesson page engagement bar): a pill + dropdown, nothing on the video.
  const slotUi = settingsSlot && createPortal(
    <span className="relative inline-flex">
      <button onClick={() => setMenu(menu ? null : "main")} title="Quality & speed"
        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-[13px] font-bold text-cyan-200 transition hover:-translate-y-0.5 hover:bg-cyan-500/20">
        <Settings2 size={15} /> {qualityText || "Auto"}{speed !== 1 ? ` · ${speed}x` : ""}
      </button>
      {menu && (
        <>
          <span className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <span className="absolute left-0 top-full z-50 mt-1.5 block min-w-48 overflow-hidden rounded-xl border border-white/15 bg-[#1a1a2e] py-1 text-white shadow-2xl">{menuBody}</span>
        </>
      )}
    </span>,
    settingsSlot,
  );

  return (
    <div ref={wrapRef} className="group relative w-full h-full bg-black">
      {slotUi}
      {!slotted && (
        <>
          {/* Settings (quality + speed) and fullscreen — top-right, like the apps */}
          <div className="absolute right-2 top-2 z-20 flex items-center gap-1.5 opacity-90 transition group-hover:opacity-100">
            <button onClick={() => setMenu(menu ? null : "main")} title="Quality & speed"
              className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/60 px-2.5 py-1 text-xs font-bold text-white backdrop-blur hover:bg-black/80">
              ⚙ {qualityText || "Auto"}{speed !== 1 ? ` · ${speed}x` : ""}
            </button>
            <button onClick={toggleFs} title={fs ? "Exit full screen" : "Full screen"}
              className="rounded-lg border border-white/20 bg-black/60 px-2.5 py-1 text-xs font-bold text-white backdrop-blur hover:bg-black/80">
              {fs ? "⤡" : "⛶"}
            </button>
          </div>
          {menu && (
            <>
              <div className="absolute inset-0 z-20" onClick={() => setMenu(null)} />
              <div className="absolute right-2 top-11 z-30 min-w-48 overflow-hidden rounded-xl border border-white/15 bg-[#1a1a2e]/95 py-1 text-white shadow-2xl backdrop-blur">{menuBody}</div>
            </>
          )}
        </>
      )}
      <video
        ref={videoRef}
        controls
        playsInline
        autoPlay={autoPlay}
        controlsList={slotted ? "nodownload noremoteplayback" : "nodownload noremoteplayback nofullscreen"}
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        onPlaying={onPlaying}
        onEnded={onEnded}
        onError={() => failRef.current?.("video error")}
        onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime, e.currentTarget.duration)}
        className="w-full h-full object-contain bg-black"
      />
      {watermark && (
        <span
          aria-hidden
          className="pointer-events-none absolute select-none text-white/35 text-xs sm:text-sm font-bold transition-all duration-[2500ms]"
          style={{ top: `${pos.top}%`, left: `${pos.left}%`, textShadow: "0 1px 2px rgba(0,0,0,.5)" }}
        >
          {watermark}
        </span>
      )}
    </div>
  );
}

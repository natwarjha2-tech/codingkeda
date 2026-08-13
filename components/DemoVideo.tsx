"use client";
import { useState, useEffect, useRef } from "react";
import { PlayCircle, X } from "lucide-react";

/**
 * DemoVideo — "Watch Demo" section for the landing page.
 * Fetches presigned URL from /api/demo-video and plays in a modal overlay.
 * Shows nothing if no demo video is uploaded by super admin.
 */
export default function DemoVideo() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Fetch video URL when modal opens (not on page load — saves unnecessary API calls)
  const handleOpen = async () => {
    setIsOpen(true);
    if (videoUrl) return; // Already loaded
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/demo-video");
      const data = await res.json();
      if (data.success && data.url) {
        setVideoUrl(data.url);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
    setLoading(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    if (isOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  return (
    <>
      {/* The section with id="demo-video" so "Watch Demo" button scrolls here */}
      <section id="demo-video" className="py-20 px-6 bg-gradient-to-br from-[#1a0533] via-[#0f0f1a] to-[#001a33]">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-purple-500/15 border border-purple-500/30 text-purple-300 px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
            🎬 Platform Demo
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-3">See How <span>Coding<span style={{color:"#ef4444"}}>K</span><span style={{color:"#f59e0b"}}>i</span><span style={{color:"#22c55e"}}>d</span>a</span> Works</h2>
          <p className="text-slate-400 mb-10 max-w-lg mx-auto">Watch a quick walkthrough of our platform — how courses, AI mentors, and coding practice work together.</p>

          {/* Play Button */}
          <button
            onClick={handleOpen}
            className="group relative inline-flex items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-full bg-purple-600 hover:bg-purple-700 transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105"
          >
            <PlayCircle size={40} className="text-white" />
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-full border-2 border-purple-400 animate-ping opacity-30" />
          </button>
          <p className="text-slate-500 text-sm mt-4">Click to watch demo (~15 min)</p>
        </div>
      </section>

      {/* Video Modal Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="relative w-full max-w-4xl mx-4">
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors flex items-center gap-1 text-sm"
            >
              <X size={18} /> Close
            </button>

            {/* Video container */}
            <div className="rounded-2xl overflow-hidden bg-black aspect-video shadow-2xl">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-3 border-purple-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {error && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                  Demo video not available yet. Check back soon!
                </div>
              )}
              {videoUrl && (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                  controlsList="nodownload"
                >
                  Your browser does not support video playback.
                </video>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

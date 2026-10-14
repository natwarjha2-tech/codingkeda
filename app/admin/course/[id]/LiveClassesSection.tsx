"use client";
import { useState, useEffect, useCallback } from "react";
import { Radio, Plus, Loader2, Video, X, Ban, Clock } from "lucide-react";
import ScheduleLiveClassModal from "./ScheduleLiveClassModal";

/**
 * Admin "Live Classes" management section for a course (ISOLATED live-class UI).
 *
 * Fully self-contained: lists the course's live classes, schedules new ones,
 * cancels scheduled ones, and plays recordings of ended classes. Dropped into
 * the course page with a single line — the page's existing module/lesson logic
 * is never touched. All calls hit the isolated /api/live/* endpoints with the
 * same inline-fetch + localStorage "token" pattern used across admin pages.
 */

interface LiveClass {
  id: string;
  title: string;
  instructorName: string;
  durationMinutes: number | null;
  agenda: string;
  status: string; // scheduled | live | ended | cancelled
  scheduledAt: string | null;
  createdAt: string;
}

interface Recording {
  id: string;
  status: string;
  url: string | null;
  createdAt: string;
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  scheduled: { label: "Scheduled", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  live: { label: "● Live", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
  ended: { label: "Ended", cls: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
  cancelled: { label: "Cancelled", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
};

export default function LiveClassesSection({ courseId, token }: { courseId: string; token: string }) {
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false); // feature off (503)
  const [showSchedule, setShowSchedule] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Recordings preview modal
  const [recordingsFor, setRecordingsFor] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [recordingsLoading, setRecordingsLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/live/classes?courseId=${encodeURIComponent(courseId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 503) {
        setUnavailable(true);
        setClasses([]);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setUnavailable(false);
        setClasses(data.classes || []);
      }
    } catch {
      // Silent — section just shows empty on transient failure.
    } finally {
      setLoading(false);
    }
  }, [courseId, token]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const handleCancel = async (id: string) => {
    if (!confirm("Cancel this scheduled live class?")) return;
    setCancellingId(id);
    try {
      const res = await fetch(`/api/live/classes/${id}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setClasses((prev) => prev.map((c) => (c.id === id ? { ...c, status: "cancelled" } : c)));
      } else {
        alert(`⚠️ ${data.message || "Failed to cancel."}`);
      }
    } catch {
      alert("⚠️ Something went wrong.");
    } finally {
      setCancellingId(null);
    }
  };

  const openRecordings = async (id: string) => {
    setRecordingsFor(id);
    setRecordings([]);
    setRecordingsLoading(true);
    try {
      const res = await fetch(`/api/live/classes/${id}/recordings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setRecordings(data.recordings || []);
    } catch {
      // Silent.
    } finally {
      setRecordingsLoading(false);
    }
  };

  const fmtDate = (iso: string | null) => {
    if (!iso) return "Not scheduled";
    try {
      return new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="mt-8">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Radio size={18} className="text-purple-400" />
          <h2 className="text-lg font-bold text-white">Live Classes</h2>
        </div>
        {!unavailable && (
          <button
            onClick={() => setShowSchedule(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}
          >
            <Plus size={15} /> Schedule Live Class
          </button>
        )}
      </div>

      {unavailable ? (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-slate-400">
          Live classes are not enabled yet.
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={22} className="animate-spin text-purple-400" />
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-white/5 px-4 py-8 text-center">
          <p className="text-sm text-slate-400">No live classes scheduled yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {classes.map((c) => {
            const badge = STATUS_STYLE[c.status] || STATUS_STYLE.scheduled;
            return (
              <div
                key={c.id}
                className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-white truncate">{c.title || "Untitled Class"}</h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>
                  </div>
                  {c.instructorName && (
                    <p className="text-xs text-slate-400 mt-1">👩‍🏫 {c.instructorName}</p>
                  )}
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <Clock size={11} /> {fmtDate(c.scheduledAt)}
                    {c.durationMinutes ? ` · ${c.durationMinutes} min` : ""}
                  </p>
                  {c.agenda && <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{c.agenda}</p>}
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  {c.status === "ended" && (
                    <button
                      onClick={() => openRecordings(c.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 transition-colors"
                    >
                      <Video size={12} /> Recordings
                    </button>
                  )}
                  {c.status === "scheduled" && (
                    <button
                      onClick={() => handleCancel(c.id)}
                      disabled={cancellingId === c.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-colors disabled:opacity-60"
                    >
                      {cancellingId === c.id ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />} Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule modal */}
      {showSchedule && (
        <ScheduleLiveClassModal
          courseId={courseId}
          token={token}
          onClose={() => setShowSchedule(false)}
          onCreated={fetchClasses}
        />
      )}

      {/* Recordings modal */}
      {recordingsFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 overflow-y-auto"
          style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setRecordingsFor(null); setPreviewUrl(""); } }}
        >
          <div
            className="w-full max-w-2xl rounded-2xl p-7 relative my-auto"
            style={{ background: "linear-gradient(145deg,#0f0a1e,#16213e)", border: "1px solid rgba(124,58,237,0.3)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}
          >
            <button
              onClick={() => { setRecordingsFor(null); setPreviewUrl(""); }}
              className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10"
            >
              <X size={14} />
            </button>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Video size={16} className="text-purple-400" /> Recordings
            </h3>

            {recordingsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={22} className="animate-spin text-purple-400" />
              </div>
            ) : previewUrl ? (
              <video src={previewUrl} controls autoPlay className="w-full max-h-[60vh] bg-black rounded-lg" />
            ) : recordings.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">No recordings available for this class.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {recordings.map((r, i) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Recording {i + 1}</p>
                      <p className="text-xs text-slate-500">{fmtDate(r.createdAt)} · {r.status}</p>
                    </div>
                    {r.status === "ready" && r.url ? (
                      <button
                        onClick={() => setPreviewUrl(r.url!)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                        style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}
                      >
                        Play
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">Processing…</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

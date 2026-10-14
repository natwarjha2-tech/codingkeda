"use client";
import { useState } from "react";
import { X, Loader2, Radio } from "lucide-react";

/**
 * Admin modal to schedule a Live Class for a course (ISOLATED live-class UI).
 *
 * Self-contained sibling component (mirrors EditQuizModal): inline fetch,
 * localStorage "token" bearer auth, dark glass card, click-outside close. Posts
 * to the isolated /api/live/classes endpoint. Rendered only by
 * LiveClassesSection — the course page's existing logic is untouched.
 */

interface Props {
  courseId: string;
  token: string;
  onClose: () => void;
  onCreated: () => void; // parent refreshes its list after a successful create
}

export default function ScheduleLiveClassModal({ courseId, token, onClose, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [instructorName, setInstructorName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [agenda, setAgenda] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) return setError("Class title is required.");
    if (!instructorName.trim()) return setError("Instructor name is required.");
    if (!scheduledAt) return setError("Please pick a date & time.");

    const when = new Date(scheduledAt);
    if (isNaN(when.getTime())) return setError("Invalid date & time.");

    setSaving(true);
    try {
      const res = await fetch("/api/live/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          courseId,
          title: title.trim(),
          instructorName: instructorName.trim(),
          // Send ISO so the server stores a precise instant regardless of locale.
          scheduledAt: when.toISOString(),
          durationMinutes: durationMinutes ? Number(durationMinutes) : null,
          agenda: agenda.trim(),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "Failed to schedule class.");
      } else {
        onCreated();
        onClose();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-7 relative my-auto"
        style={{ background: "linear-gradient(145deg,#0f0a1e,#16213e)", border: "1px solid rgba(124,58,237,0.3)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
        >
          <X size={14} />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Radio size={18} className="text-purple-400" />
          <h3 className="text-xl font-extrabold text-white">Schedule Live Class</h3>
        </div>
        <p className="text-slate-400 text-sm mb-6">Students of this course will see this live session.</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-xl mb-4">⚠️ {error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">Class Title *</label>
            <input
              type="text"
              placeholder="e.g. React Hooks — Live Doubt Session"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors placeholder:text-slate-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">Instructor Name *</label>
            <input
              type="text"
              placeholder="e.g. Rahul Sharma"
              value={instructorName}
              onChange={(e) => setInstructorName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors placeholder:text-slate-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Date &amp; Time *</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors scheme-dark"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Duration (min)</label>
              <input
                type="number"
                min={1}
                max={1440}
                placeholder="60"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors placeholder:text-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">Topic / Agenda</label>
            <textarea
              placeholder="What will be covered? e.g. useEffect, custom hooks, Q&amp;A"
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              rows={3}
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors placeholder:text-slate-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-white/5 hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}
            >
              {saving ? (<><Loader2 size={14} className="animate-spin" /> Scheduling...</>) : "Schedule Class"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

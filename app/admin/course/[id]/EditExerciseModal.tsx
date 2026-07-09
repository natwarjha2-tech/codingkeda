"use client";
import { useState, useEffect } from "react";
import { X, Loader2, Trash2, Save } from "lucide-react";

interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  order: number;
}

interface Exercise {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  type: string;
  language: string | null;
  solution: string | null;
  order: number;
  testCases: TestCase[];
}

interface Props {
  lessonId: string;
  token: string;
  onClose: () => void;
}

export default function EditExerciseModal({ lessonId, token, onClose }: Props) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDifficulty, setEditDifficulty] = useState("medium");
  const [editType, setEditType] = useState("theory");
  const [editLanguage, setEditLanguage] = useState("c");
  const [editSolution, setEditSolution] = useState("");

  useEffect(() => {
    fetchExercises();
  }, [lessonId]);

  const fetchExercises = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/exercises?lessonId=${lessonId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setExercises(data.exercises);
    } catch {}
    setLoading(false);
  };

  const startEdit = (ex: Exercise) => {
    setEditingId(ex.id);
    setEditTitle(ex.title);
    setEditDesc(ex.description);
    setEditDifficulty(ex.difficulty);
    setEditType(ex.type);
    setEditLanguage(ex.language || "c");
    setEditSolution(ex.solution || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditDesc("");
    setEditDifficulty("medium");
    setEditType("theory");
    setEditLanguage("c");
    setEditSolution("");
  };

  const handleSave = async (exId: string) => {
    if (!editTitle.trim() || !editDesc.trim()) return;
    setSavingId(exId);
    try {
      const res = await fetch(`/api/admin/exercises/${exId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDesc.trim(),
          difficulty: editDifficulty,
          type: editType,
          language: editType === "coding" ? editLanguage : null,
          solution: editType === "theory" ? editSolution.trim() || null : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setExercises(prev => prev.map(e => e.id === exId ? {
          ...e,
          title: editTitle.trim(),
          description: editDesc.trim(),
          difficulty: editDifficulty,
          type: editType,
          language: editType === "coding" ? editLanguage : null,
          solution: editType === "theory" ? editSolution.trim() || null : null,
        } : e));
        cancelEdit();
      } else {
        alert(`⚠️ ${data.message || "Failed to update."}`);
      }
    } catch {
      alert("⚠️ Something went wrong.");
    }
    setSavingId(null);
  };

  const handleDelete = async (exId: string) => {
    if (!confirm("Delete this exercise and its test cases?")) return;
    setDeletingId(exId);
    try {
      const res = await fetch(`/api/admin/exercises/${exId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setExercises(prev => prev.filter(e => e.id !== exId));
        if (editingId === exId) cancelEdit();
      } else {
        alert(`⚠️ ${data.message || "Failed to delete."}`);
      }
    } catch {
      alert("⚠️ Something went wrong.");
    }
    setDeletingId(null);
  };

  const getDifficultyColor = (d: string) => {
    switch (d) {
      case "easy": return "text-green-400 bg-green-500/10 border-green-500/20";
      case "medium": return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
      case "hard": return "text-red-400 bg-red-500/10 border-red-500/20";
      default: return "text-slate-400 bg-white/5 border-white/10";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`w-full rounded-2xl p-7 relative my-auto overflow-y-auto ${fullscreen ? "max-w-full mx-4 max-h-full h-[calc(100vh-48px)]" : "max-w-2xl max-h-[90vh]"}`}
        style={{ background: "linear-gradient(145deg,#0f0a1e,#16213e)", border: "1px solid rgba(6,182,212,0.3)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-white">✏️ Edit Exercises</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setFullscreen(!fullscreen)} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10" title={fullscreen ? "Minimize" : "Maximize"}>{fullscreen ? <span className="text-xs">⊖</span> : <span className="text-xs">⊕</span>}</button>
            <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10"><X size={14} /></button>
          </div>
        </div>
        <p className="text-xs text-slate-400 mb-5">Edit or delete existing exercises for this lesson</p>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={24} className="text-cyan-400 animate-spin" />
          </div>
        ) : exercises.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">No exercises found for this lesson.</p>
        ) : (
          <div className="space-y-3">
            {exercises.map((ex, idx) => (
              <div key={ex.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                {editingId === ex.id ? (
                  /* Edit Form */
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-cyan-400 mb-1">Editing Exercise {idx + 1}</div>
                    <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                      placeholder="Title"
                      className="w-full bg-[#0f0a1e] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-cyan-500" />
                    <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)}
                      placeholder="Description"
                      className="w-full bg-[#0f0a1e] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-cyan-500" rows={3} />
                    <div className="flex gap-3">
                      <select value={editDifficulty} onChange={e => setEditDifficulty(e.target.value)}
                        className="flex-1 bg-[#0f0a1e] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none">
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                      <select value={editType} onChange={e => setEditType(e.target.value)}
                        className="flex-1 bg-[#0f0a1e] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none">
                        <option value="theory">Theory</option>
                        <option value="coding">Coding</option>
                      </select>
                    </div>
                    {editType === "theory" && (
                      <textarea value={editSolution} onChange={e => setEditSolution(e.target.value)}
                        placeholder="Solution (hidden from user)"
                        className="w-full bg-[#0f0a1e] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-cyan-500" rows={2} />
                    )}
                    {editType === "coding" && (
                      <select value={editLanguage} onChange={e => setEditLanguage(e.target.value)}
                        className="w-full bg-[#0f0a1e] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none">
                        <option value="c">C</option>
                        <option value="java">Java</option>
                        <option value="python">Python</option>
                        <option value="javascript">JavaScript</option>
                      </select>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button onClick={cancelEdit}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10">
                        Cancel
                      </button>
                      <button onClick={() => handleSave(ex.id)} disabled={!!savingId}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 flex items-center gap-1">
                        {savingId === ex.id ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display */
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-white text-sm font-medium">
                          <span className="text-slate-500 mr-1">{idx + 1}.</span>
                          {ex.title}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded border ${getDifficultyColor(ex.difficulty)}`}>
                          {ex.difficulty}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${ex.type === "coding" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"}`}>
                          {ex.type}
                        </span>
                        {ex.language && (
                          <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10">
                            {ex.language}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2">{ex.description}</p>
                      {ex.testCases.length > 0 && (
                        <p className="text-xs text-slate-600 mt-1">
                          📋 {ex.testCases.length} test case(s) ({ex.testCases.filter(t => !t.isHidden).length} visible, {ex.testCases.filter(t => t.isHidden).length} hidden)
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => startEdit(ex)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(ex.id)} disabled={!!deletingId}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 transition-colors flex items-center gap-1">
                        {deletingId === ex.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <button onClick={onClose}
          className="w-full mt-5 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-white/5 hover:bg-white/10 transition-colors">
          Done
        </button>
      </div>
    </div>
  );
}

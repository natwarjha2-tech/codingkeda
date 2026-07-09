"use client";
import { useState, useEffect } from "react";
import { X, Loader2, Trash2, Save } from "lucide-react";

interface Quiz {
  id: string;
  question: string;
  options: string[];
  answer: number;
  explanation: string | null;
  order: number;
}

interface Props {
  lessonId: string;
  token: string;
  onClose: () => void;
}

export default function EditQuizModal({ lessonId, token, onClose }: Props) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // Edit form state
  const [editQuestion, setEditQuestion] = useState("");
  const [editOptions, setEditOptions] = useState(["", "", "", ""]);
  const [editAnswer, setEditAnswer] = useState(0);
  const [editExplanation, setEditExplanation] = useState("");

  useEffect(() => {
    fetchQuizzes();
  }, [lessonId]);

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/quiz?lessonId=${lessonId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setQuizzes(data.quizzes);
    } catch {}
    setLoading(false);
  };

  const startEdit = (quiz: Quiz) => {
    setEditingId(quiz.id);
    setEditQuestion(quiz.question);
    setEditOptions([...quiz.options]);
    setEditAnswer(quiz.answer);
    setEditExplanation(quiz.explanation || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditQuestion("");
    setEditOptions(["", "", "", ""]);
    setEditAnswer(0);
    setEditExplanation("");
  };

  const handleSave = async (quizId: string) => {
    if (!editQuestion.trim() || editOptions.some(o => !o.trim())) return;
    setSavingId(quizId);
    try {
      const res = await fetch(`/api/admin/quiz/${quizId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          question: editQuestion.trim(),
          options: editOptions.map(o => o.trim()),
          answer: editAnswer,
          explanation: editExplanation.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setQuizzes(prev => prev.map(q => q.id === quizId ? { ...q, question: editQuestion.trim(), options: editOptions.map(o => o.trim()), answer: editAnswer, explanation: editExplanation.trim() || null } : q));
        cancelEdit();
      } else {
        alert(`⚠️ ${data.message || "Failed to update."}`);
      }
    } catch {
      alert("⚠️ Something went wrong.");
    }
    setSavingId(null);
  };

  const handleDelete = async (quizId: string) => {
    if (!confirm("Delete this quiz question?")) return;
    setDeletingId(quizId);
    try {
      const res = await fetch(`/api/admin/quiz/${quizId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setQuizzes(prev => prev.filter(q => q.id !== quizId));
        if (editingId === quizId) cancelEdit();
      } else {
        alert(`⚠️ ${data.message || "Failed to delete."}`);
      }
    } catch {
      alert("⚠️ Something went wrong.");
    }
    setDeletingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`w-full rounded-2xl p-7 relative my-auto overflow-y-auto ${fullscreen ? "max-w-full mx-4 max-h-full h-[calc(100vh-48px)]" : "max-w-2xl max-h-[90vh]"}`}
        style={{ background: "linear-gradient(145deg,#0f0a1e,#16213e)", border: "1px solid rgba(34,197,94,0.3)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-white">✏️ Edit Quizzes</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setFullscreen(!fullscreen)} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10" title={fullscreen ? "Minimize" : "Maximize"}>{fullscreen ? <span className="text-xs">⊖</span> : <span className="text-xs">⊕</span>}</button>
            <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10"><X size={14} /></button>
          </div>
        </div>
        <p className="text-xs text-slate-400 mb-5">Edit or delete existing quiz questions for this lesson</p>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={24} className="text-green-400 animate-spin" />
          </div>
        ) : quizzes.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">No quizzes found for this lesson.</p>
        ) : (
          <div className="space-y-3">
            {quizzes.map((quiz, idx) => (
              <div key={quiz.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                {editingId === quiz.id ? (
                  /* Edit Form */
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-green-400 mb-1">Editing Question {idx + 1}</div>
                    <textarea value={editQuestion} onChange={e => setEditQuestion(e.target.value)}
                      className="w-full bg-[#0f0a1e] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-green-500" rows={2} />
                    {editOptions.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="radio" name={`editQuizAns-${quiz.id}`} checked={editAnswer === i}
                          onChange={() => setEditAnswer(i)} className="accent-green-500" />
                        <input value={opt} onChange={e => { const o = [...editOptions]; o[i] = e.target.value; setEditOptions(o); }}
                          placeholder={`Option ${i + 1}`}
                          className="flex-1 bg-[#0f0a1e] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-green-500" />
                      </div>
                    ))}
                    <input value={editExplanation} onChange={e => setEditExplanation(e.target.value)}
                      placeholder="Explanation (optional)"
                      className="w-full bg-[#0f0a1e] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-green-500" />
                    <div className="flex gap-2 pt-1">
                      <button onClick={cancelEdit}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10">
                        Cancel
                      </button>
                      <button onClick={() => handleSave(quiz.id)} disabled={!!savingId}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-500 disabled:opacity-60 flex items-center gap-1">
                        {savingId === quiz.id ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display */
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium mb-1">
                        <span className="text-slate-500 mr-1">{idx + 1}.</span>
                        {quiz.question}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {quiz.options.map((opt, i) => (
                          <span key={i} className={`text-xs px-2 py-0.5 rounded ${i === quiz.answer ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-white/5 text-slate-400 border border-white/10"}`}>
                            {opt}
                          </span>
                        ))}
                      </div>
                      {quiz.explanation && <p className="text-xs text-slate-500 mt-1">💡 {quiz.explanation}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => startEdit(quiz)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(quiz.id)} disabled={!!deletingId}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 transition-colors flex items-center gap-1">
                        {deletingId === quiz.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
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

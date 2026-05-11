"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, ChevronDown, ChevronUp, FileVideo, FileText,
  X, Loader2, Upload, Check, Play, Eye
} from "lucide-react";
import Navbar from "@/components/Navbar";

interface Lesson {
  id: string;
  title: string;
  videoUrl: string;
  notes: string;
  order: number;
}

interface Module {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

interface Course {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  color: string;
  modules: Module[];
}

export default function ManageCoursePage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Module modal
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [moduleName, setModuleName] = useState("");
  const [creatingModule, setCreatingModule] = useState(false);

  // Lesson modal
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [activeModuleId, setActiveModuleId] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonIsFree, setLessonIsFree] = useState(false);
  const [creatingLesson, setCreatingLesson] = useState(false);

  // Edit lesson modal
  const [editLesson, setEditLesson] = useState<Lesson | null>(null);
  const [editVideoFile, setEditVideoFile] = useState<File | null>(null);
  const [editPdfFile, setEditPdfFile] = useState<File | null>(null);
  const [editVideoUploading, setEditVideoUploading] = useState(false);
  const [editPdfUploading, setEditPdfUploading] = useState(false);
  const [editVideoSuccess, setEditVideoSuccess] = useState(false);
  const [editPdfSuccess, setEditPdfSuccess] = useState(false);
  const [editVideoError, setEditVideoError] = useState("");
  const [editPdfError, setEditPdfError] = useState("");

  // Upload states (reusing existing upload logic)
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [videoDragging, setVideoDragging] = useState(false);
  const [pdfDragging, setPdfDragging] = useState(false);
  const [videoUploadSuccess, setVideoUploadSuccess] = useState(false);
  const [pdfUploadSuccess, setPdfUploadSuccess] = useState(false);
  const [videoError, setVideoError] = useState("");
  const [pdfError, setPdfError] = useState("");

  // Preview modals
  const [previewVideo, setPreviewVideo] = useState("");
  const [previewPdf, setPreviewPdf] = useState("");

  const [error, setError] = useState("");

  const getToken = () => localStorage.getItem("token") || "";

  const requestSignedUrl = async (url: string) => {
    if (!url) return "";

    try {
      const res = await fetch("/api/media/signed-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();
      if (res.ok && data.signedUrl) return data.signedUrl;
    } catch {
      // fallback to raw URL if signed request fails
    }

    return url;
  };

  const handlePreviewVideo = async (url: string) => {
    const signedUrl = await requestSignedUrl(url);
    setPreviewVideo(signedUrl);
  };

  const handlePreviewPdf = async (url: string) => {
    const signedUrl = await requestSignedUrl(url);
    setPreviewPdf(signedUrl);
  };

  useEffect(() => {
    fetchCourse();
  }, [courseId]);

  const fetchCourse = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) setCourse(data.course);
    } catch {}
    setLoading(false);
  };

  const toggleModule = (id: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Upload handlers ──
  const handleVideoUpload = async () => {
    if (!videoFile) return setVideoError("Please select a video file.");
    setVideoError("");
    setVideoUploading(true);
    try {
      const token = localStorage.getItem("token");
      // Step 1: get presigned URL
      const presignRes = await fetch("/api/admin/upload/presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileName: videoFile.name, fileType: videoFile.type, fileSize: videoFile.size, type: "video" }),
      });
      const presignData = await presignRes.json();
      if (!presignRes.ok) return setVideoError(presignData.error || "Failed to get upload URL.");
      // Step 2: upload directly to S3
      const s3Res = await fetch(presignData.uploadUrl, { method: "PUT", body: videoFile, headers: { "Content-Type": videoFile.type } });
      if (!s3Res.ok) return setVideoError("S3 upload failed.");
      setVideoUrl(presignData.publicUrl);
      setVideoUploadSuccess(true);
      setVideoFile(null);
    } catch {
      setVideoError("Upload failed. Check your connection.");
    } finally {
      setVideoUploading(false);
    }
  };

  const handlePdfUpload = async () => {
    if (!pdfFile) return setPdfError("Please select a PDF file.");
    setPdfError("");
    setPdfUploading(true);
    try {
      const token = localStorage.getItem("token");
      // Use presigned upload for PDF too — saves permanent S3 URL
      const presignRes = await fetch("/api/admin/upload/presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileName: pdfFile.name, fileType: pdfFile.type, fileSize: pdfFile.size, type: "pdf" }),
      });
      const presignData = await presignRes.json();
      if (!presignRes.ok) return setPdfError(presignData.error || "Failed to get upload URL.");
      const s3Res = await fetch(presignData.uploadUrl, { method: "PUT", body: pdfFile, headers: { "Content-Type": pdfFile.type } });
      if (!s3Res.ok) return setPdfError("S3 upload failed.");
      setPdfUrl(presignData.publicUrl);
      setPdfUploadSuccess(true);
      setPdfFile(null);
    } catch {
      setPdfError("Upload failed. Check your connection.");
    } finally {
      setPdfUploading(false);
    }
  };

  const handleVideoDrop = (e: React.DragEvent) => {
    e.preventDefault(); setVideoDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith("video/")) { setVideoFile(file); setVideoUploadSuccess(false); setVideoUrl(""); }
  };

  const handlePdfDrop = (e: React.DragEvent) => {
    e.preventDefault(); setPdfDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type === "application/pdf") { setPdfFile(file); setPdfUploadSuccess(false); setPdfUrl(""); }
  };

  // ── Create Module ──
  const handleCreateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleName.trim()) return;
    setCreatingModule(true);
    try {
      const res = await fetch("/api/admin/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ courseId, title: moduleName }),
      });
      const data = await res.json();
      if (data.success) {
        setCourse(prev => prev ? { ...prev, modules: [...prev.modules, { ...data.module, lessons: [] }] } : prev);
        setExpandedModules(prev => new Set([...prev, data.module.id]));
        setShowModuleModal(false);
        setModuleName("");
      }
    } catch {}
    setCreatingModule(false);
  };

  // ── Create Lesson ──
  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonTitle.trim()) return;
    setCreatingLesson(true);
    try {
      const res = await fetch("/api/admin/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ moduleId: activeModuleId, title: lessonTitle, isFree: lessonIsFree, videoUrl, notes: pdfUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setCourse(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            modules: prev.modules.map(m =>
              m.id === activeModuleId ? { ...m, lessons: [...m.lessons, data.lesson] } : m
            ),
          };
        });
        resetLessonModal();
      } else {
        setError(data.message || "Failed to save lesson.");
      }
    } catch {
      setError("Something went wrong.");
    }
    setCreatingLesson(false);
  };

  const resetLessonModal = () => {
    setShowLessonModal(false);
    setLessonTitle("");
    setLessonIsFree(false);
    setVideoFile(null); setPdfFile(null);
    setVideoUrl(""); setPdfUrl("");
    setVideoUploadSuccess(false); setPdfUploadSuccess(false);
    setVideoError(""); setPdfError("");
    setError("");
    setActiveModuleId("");
  };

  // ── Edit Lesson — upload video/pdf to existing lesson ──
  const handleEditVideoUpload = async () => {
    if (!editVideoFile || !editLesson) return setEditVideoError("Please select a video file.");
    setEditVideoError(""); setEditVideoUploading(true);
    try {
      // Step 1: get presigned URL
      const presignRes = await fetch("/api/admin/upload/presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ fileName: editVideoFile.name, fileType: editVideoFile.type, fileSize: editVideoFile.size, type: "video" }),
      });
      const presignData = await presignRes.json();
      if (!presignRes.ok) return setEditVideoError(presignData.error || "Failed to get upload URL.");
      // Step 2: upload directly to S3
      const s3Res = await fetch(presignData.uploadUrl, { method: "PUT", body: editVideoFile, headers: { "Content-Type": editVideoFile.type } });
      if (!s3Res.ok) return setEditVideoError("S3 upload failed.");
      const updateRes = await fetch(`/api/admin/lessons/${editLesson.id}/update-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ videoUrl: presignData.publicUrl }),
      });
      const updateData = await updateRes.json();
      if (!updateRes.ok) return setEditVideoError(updateData.message || "Update failed.");
      setCourse(prev => prev ? {
        ...prev,
        modules: prev.modules.map(m => ({
          ...m, lessons: m.lessons.map(l => l.id === editLesson.id ? { ...l, videoUrl: presignData.publicUrl } : l)
        }))
      } : prev);
      setEditVideoSuccess(true); setEditVideoFile(null);
    } catch { setEditVideoError("Upload failed. Check your connection."); }
    finally { setEditVideoUploading(false); }
  };

  const handleEditPdfUpload = async () => {
    if (!editPdfFile || !editLesson) return setEditPdfError("Please select a PDF file.");
    setEditPdfError(""); setEditPdfUploading(true);
    try {
      const presignRes = await fetch("/api/admin/upload/presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ fileName: editPdfFile.name, fileType: editPdfFile.type, fileSize: editPdfFile.size, type: "pdf" }),
      });
      const presignData = await presignRes.json();
      if (!presignRes.ok) return setEditPdfError(presignData.error || "Failed to get upload URL.");
      const s3Res = await fetch(presignData.uploadUrl, { method: "PUT", body: editPdfFile, headers: { "Content-Type": editPdfFile.type } });
      if (!s3Res.ok) return setEditPdfError("S3 upload failed.");
      const updateRes = await fetch(`/api/admin/lessons/${editLesson.id}/update-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ pdfUrl: presignData.publicUrl }),
      });
      const updateData = await updateRes.json();
      if (!updateRes.ok) return setEditPdfError(updateData.message || "Update failed.");
      setCourse(prev => prev ? {
        ...prev,
        modules: prev.modules.map(m => ({
          ...m, lessons: m.lessons.map(l => l.id === editLesson.id ? { ...l, notes: presignData.publicUrl } : l)
        }))
      } : prev);
      setEditPdfSuccess(true); setEditPdfFile(null);
    } catch { setEditPdfError("Upload failed. Check your connection."); }
    finally { setEditPdfUploading(false); }
  };

  const resetEditModal = () => {
    setEditLesson(null);
    setEditVideoFile(null); setEditPdfFile(null);
    setEditVideoSuccess(false); setEditPdfSuccess(false);
    setEditVideoError(""); setEditPdfError("");
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
      <Loader2 size={32} className="text-purple-400 animate-spin" />
    </div>
  );

  if (!course) return (
    <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
      <p className="text-slate-400">Course not found.</p>
    </div>
  );

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0f0f1a] px-6 py-8 pt-24">
        <div className="max-w-4xl mx-auto">

          {/* Back */}
          <button onClick={() => router.push("/admin/dashboard")}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft size={16} /> Back to Dashboard
          </button>

          {/* Course Header */}
          <div className={`rounded-2xl bg-gradient-to-br ${course.color} p-6 mb-8 relative overflow-hidden`}>
            <div className="absolute inset-0 bg-black/30" />
            <div className="relative z-10">
              <span className="text-xs font-semibold bg-white/20 text-white px-3 py-1 rounded-full mb-3 inline-block">
                {course.category}
              </span>
              <h1 className="text-2xl font-extrabold text-white mb-1">{course.title}</h1>
              <p className="text-white/70 text-sm">{course.subtitle || "No description"}</p>
              <div className="flex items-center gap-4 mt-3 text-white/60 text-xs">
                <span>{course.modules.length} modules</span>
                <span>{course.modules.reduce((a, m) => a + m.lessons.length, 0)} lessons</span>
              </div>
            </div>
          </div>

          {/* Add Module Button */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white font-bold text-lg">Modules</h2>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => setShowModuleModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}>
              <Plus size={15} /> Add Module
            </motion.button>
          </div>

          {/* Modules List */}
          {course.modules.length === 0 ? (
            <div className="text-center py-16 bg-[#16213e] border border-white/10 rounded-2xl">
              <p className="text-slate-400">No modules yet. Click &quot;Add Module&quot; to start.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {course.modules.map((mod, mi) => (
                <motion.div key={mod.id}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: mi * 0.05 }}
                  className="bg-[#16213e] border border-white/10 rounded-2xl overflow-hidden">

                  {/* Module Header */}
                  <button onClick={() => toggleModule(mod.id)}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs font-bold flex items-center justify-center">
                        {mi + 1}
                      </span>
                      <span className="text-white font-semibold">{mod.title}</span>
                      <span className="text-slate-500 text-xs">{mod.lessons.length} lessons</span>
                    </div>
                    {expandedModules.has(mod.id) ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </button>

                  {/* Module Content */}
                  <AnimatePresence>
                    {expandedModules.has(mod.id) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                        <div className="px-6 pb-5 border-t border-white/5">

                          {/* Lessons */}
                          {mod.lessons.length > 0 && (
                            <div className="space-y-2 mt-4 mb-4">
                              {mod.lessons.map((lesson, li) => (
                                <div key={lesson.id}
                                  className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <span className="text-slate-500 text-xs w-5">{li + 1}.</span>
                                    <span className="text-white text-sm font-medium">{lesson.title}</span>
                                    {lesson.videoUrl && <FileVideo size={13} className="text-purple-400" />}
                                    {lesson.notes && <FileText size={13} className="text-pink-400" />}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {lesson.videoUrl && (
                                      <button onClick={() => handlePreviewVideo(lesson.videoUrl)}
                                        className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 bg-purple-500/10 px-2 py-1 rounded-lg transition-colors">
                                        <Play size={11} /> Preview
                                      </button>
                                    )}
                                    {lesson.notes && (
                                      <button onClick={() => handlePreviewPdf(lesson.notes)}
                                        className="flex items-center gap-1 text-xs text-pink-400 hover:text-pink-300 bg-pink-500/10 px-2 py-1 rounded-lg transition-colors">
                                        <Eye size={11} /> PDF
                                      </button>
                                    )}
                                    <button onClick={() => { setEditLesson(lesson); setEditVideoSuccess(false); setEditPdfSuccess(false); setEditVideoError(""); setEditPdfError(""); }}
                                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg transition-colors">
                                      <Upload size={11} /> Edit
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add Lesson Button */}
                          <button
                            onClick={() => { setActiveModuleId(mod.id); setShowLessonModal(true); }}
                            className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 px-4 py-2 rounded-xl transition-all mt-2">
                            <Plus size={14} /> Add Lesson
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Add Module Modal */}
      <AnimatePresence>
        {showModuleModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)" }}
            onClick={e => e.target === e.currentTarget && setShowModuleModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="w-full max-w-sm rounded-2xl p-7 relative"
              style={{ background: "linear-gradient(145deg,#0f0a1e,#16213e)", border: "1px solid rgba(124,58,237,0.25)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
              <button onClick={() => setShowModuleModal(false)}
                className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                <X size={14} />
              </button>
              <h3 className="text-xl font-extrabold text-white mb-1">Add Module</h3>
              <p className="text-slate-400 text-sm mb-6">Enter a name for this module</p>
              <form onSubmit={handleCreateModule} className="space-y-4">
                <input
                  type="text" placeholder="e.g. Introduction to React"
                  value={moduleName} onChange={e => setModuleName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors placeholder:text-slate-500"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowModuleModal(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-white/5 hover:bg-white/10 transition-colors">
                    Cancel
                  </button>
                  <motion.button type="submit" disabled={creatingModule}
                    whileHover={!creatingModule ? { scale: 1.02 } : {}}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}>
                    {creatingModule ? <><Loader2 size={14} className="animate-spin" /> Adding...</> : "Add Module"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Lesson Modal */}
      <AnimatePresence>
        {showLessonModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 overflow-y-auto"
            style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)" }}
            onClick={e => e.target === e.currentTarget && resetLessonModal()}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="w-full max-w-lg rounded-2xl p-7 relative my-auto"
              style={{ background: "linear-gradient(145deg,#0f0a1e,#16213e)", border: "1px solid rgba(124,58,237,0.25)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
              <button onClick={resetLessonModal}
                className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                <X size={14} />
              </button>
              <h3 className="text-xl font-extrabold text-white mb-1">Add Lesson</h3>
              <p className="text-slate-400 text-sm mb-6">Fill in lesson details and upload content</p>

              <form onSubmit={handleCreateLesson} className="space-y-5">
                {/* Lesson Title */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">Lesson Title *</label>
                  <input
                    type="text" placeholder="e.g. What is React?"
                    value={lessonTitle} onChange={e => setLessonTitle(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors placeholder:text-slate-500"
                    autoFocus
                  />
                </div>

                {/* isFree Toggle */}
                <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Free Lesson</p>
                    <p className="text-xs text-slate-400">Toggle on to make this lesson free for all users</p>
                  </div>
                  <button type="button" onClick={() => setLessonIsFree(p => !p)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${lessonIsFree ? "bg-purple-500" : "bg-white/10"}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${lessonIsFree ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>

                {/* Video Upload */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                    <FileVideo size={13} className="text-purple-400" /> Video Upload
                  </label>
                  <div
                    onDragOver={e => { e.preventDefault(); setVideoDragging(true); }}
                    onDragLeave={() => setVideoDragging(false)}
                    onDrop={handleVideoDrop}
                    onClick={() => document.getElementById("lessonVideoInput")?.click()}
                    className="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all"
                    style={{ borderColor: videoDragging ? "#7c3aed" : videoUploadSuccess ? "#22c55e" : "rgba(255,255,255,0.1)", background: videoDragging ? "rgba(124,58,237,0.08)" : "transparent" }}>
                    {videoUploadSuccess
                      ? <p className="text-green-400 text-sm flex items-center justify-center gap-2"><Check size={14} /> Video uploaded!</p>
                      : <><Upload size={20} className="mx-auto mb-1.5 text-slate-500" />
                        <p className="text-slate-400 text-xs">{videoFile ? videoFile.name : "Click or drag & drop video"}</p>
                        <p className="text-slate-600 text-xs mt-0.5">MP4, AVI, MOV</p></>
                    }
                    <input id="lessonVideoInput" type="file" accept="video/*" className="hidden"
                      onChange={e => { setVideoFile(e.target.files?.[0] || null); setVideoUploadSuccess(false); setVideoUrl(""); setVideoError(""); }} />
                  </div>
                  {videoError && <p className="text-red-400 text-xs mt-1.5">⚠️ {videoError}</p>}
                  {!videoUploadSuccess && (
                    <motion.button type="button" onClick={handleVideoUpload} disabled={videoUploading}
                      whileHover={{ scale: 1.02 }}
                      className="w-full mt-2 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                      style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
                      {videoUploading ? <><Loader2 size={12} className="animate-spin" /> Uploading...</> : "Upload Video"}
                    </motion.button>
                  )}
                </div>

                {/* PDF Upload */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                    <FileText size={13} className="text-pink-400" /> PDF Notes Upload
                  </label>
                  <div
                    onDragOver={e => { e.preventDefault(); setPdfDragging(true); }}
                    onDragLeave={() => setPdfDragging(false)}
                    onDrop={handlePdfDrop}
                    onClick={() => document.getElementById("lessonPdfInput")?.click()}
                    className="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all"
                    style={{ borderColor: pdfDragging ? "#ec4899" : pdfUploadSuccess ? "#22c55e" : "rgba(255,255,255,0.1)", background: pdfDragging ? "rgba(236,72,153,0.08)" : "transparent" }}>
                    {pdfUploadSuccess
                      ? <p className="text-green-400 text-sm flex items-center justify-center gap-2"><Check size={14} /> PDF uploaded!</p>
                      : <><Upload size={20} className="mx-auto mb-1.5 text-slate-500" />
                        <p className="text-slate-400 text-xs">{pdfFile ? pdfFile.name : "Click or drag & drop PDF"}</p>
                        <p className="text-slate-600 text-xs mt-0.5">PDF only</p></>
                    }
                    <input id="lessonPdfInput" type="file" accept=".pdf" className="hidden"
                      onChange={e => { setPdfFile(e.target.files?.[0] || null); setPdfUploadSuccess(false); setPdfUrl(""); setPdfError(""); }} />
                  </div>
                  {pdfError && <p className="text-red-400 text-xs mt-1.5">⚠️ {pdfError}</p>}
                  {!pdfUploadSuccess && (
                    <motion.button type="button" onClick={handlePdfUpload} disabled={pdfUploading}
                      whileHover={{ scale: 1.02 }}
                      className="w-full mt-2 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                      style={{ background: "linear-gradient(135deg,#ec4899,#f43f5e)" }}>
                      {pdfUploading ? <><Loader2 size={12} className="animate-spin" /> Uploading...</> : "Upload PDF"}
                    </motion.button>
                  )}
                </div>

                {error && <p className="text-red-400 text-xs">⚠️ {error}</p>}
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={resetLessonModal}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-white/5 hover:bg-white/10 transition-colors">
                    Cancel
                  </button>
                  <motion.button type="submit" disabled={creatingLesson || !lessonTitle.trim()}
                    whileHover={!creatingLesson ? { scale: 1.02 } : {}}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}>
                    {creatingLesson ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : "Save Lesson"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Preview Modal */}
      <AnimatePresence>
        {previewVideo && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: "rgba(0,0,0,0.9)", backdropFilter: "blur(10px)" }}
            onClick={e => e.target === e.currentTarget && setPreviewVideo("")}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="w-full max-w-2xl rounded-2xl overflow-hidden relative"
              style={{ border: "1px solid rgba(124,58,237,0.3)" }}>
              <button onClick={() => setPreviewVideo("")}
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors">
                <X size={14} />
              </button>
              <video src={previewVideo} controls autoPlay className="w-full max-h-[70vh] bg-black" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PDF Preview Modal */}
      <AnimatePresence>
        {previewPdf && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: "rgba(0,0,0,0.9)", backdropFilter: "blur(10px)" }}
            onClick={e => e.target === e.currentTarget && setPreviewPdf("")}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="w-full max-w-3xl h-[80vh] rounded-2xl overflow-hidden relative"
              style={{ border: "1px solid rgba(124,58,237,0.3)" }}>
              <button onClick={() => setPreviewPdf("")}
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors">
                <X size={14} />
              </button>
              <iframe src={previewPdf} className="w-full h-full" title="PDF Preview" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Lesson Modal */}
      <AnimatePresence>
        {editLesson && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 overflow-y-auto"
            style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)" }}
            onClick={e => e.target === e.currentTarget && resetEditModal()}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="w-full max-w-lg rounded-2xl p-7 relative my-auto"
              style={{ background: "linear-gradient(145deg,#0f0a1e,#16213e)", border: "1px solid rgba(124,58,237,0.25)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
              <button onClick={resetEditModal}
                className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                <X size={14} />
              </button>
              <h3 className="text-xl font-extrabold text-white mb-1">Edit Lesson</h3>
              <p className="text-slate-400 text-sm mb-6">{editLesson.title}</p>

              <div className="space-y-5">
                {/* Update Video */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                    <FileVideo size={13} className="text-purple-400" /> Update Video
                    {editLesson.videoUrl && <span className="text-green-400 text-xs">(already uploaded)</span>}
                  </label>
                  <div
                    onClick={() => document.getElementById("editVideoInput")?.click()}
                    className="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all"
                    style={{ borderColor: editVideoSuccess ? "#22c55e" : "rgba(255,255,255,0.1)" }}>
                    {editVideoSuccess
                      ? <p className="text-green-400 text-sm flex items-center justify-center gap-2"><Check size={14} /> Video updated!</p>
                      : <><Upload size={20} className="mx-auto mb-1.5 text-slate-500" />
                        <p className="text-slate-400 text-xs">{editVideoFile ? editVideoFile.name : "Click to select video"}</p>
                        <p className="text-slate-600 text-xs mt-0.5">MP4, AVI, MOV</p></>
                    }
                    <input id="editVideoInput" type="file" accept="video/*" className="hidden"
                      onChange={e => { setEditVideoFile(e.target.files?.[0] || null); setEditVideoSuccess(false); setEditVideoError(""); }} />
                  </div>
                  {editVideoError && <p className="text-red-400 text-xs mt-1.5">⚠️ {editVideoError}</p>}
                  {!editVideoSuccess && (
                    <motion.button type="button" onClick={handleEditVideoUpload} disabled={editVideoUploading}
                      whileHover={{ scale: 1.02 }}
                      className="w-full mt-2 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                      style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
                      {editVideoUploading ? <><Loader2 size={12} className="animate-spin" /> Uploading...</> : "Upload Video"}
                    </motion.button>
                  )}
                </div>

                {/* Update PDF */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                    <FileText size={13} className="text-pink-400" /> Update PDF Notes
                    {editLesson.notes && <span className="text-green-400 text-xs">(already uploaded)</span>}
                  </label>
                  <div
                    onClick={() => document.getElementById("editPdfInput")?.click()}
                    className="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all"
                    style={{ borderColor: editPdfSuccess ? "#22c55e" : "rgba(255,255,255,0.1)" }}>
                    {editPdfSuccess
                      ? <p className="text-green-400 text-sm flex items-center justify-center gap-2"><Check size={14} /> PDF updated!</p>
                      : <><Upload size={20} className="mx-auto mb-1.5 text-slate-500" />
                        <p className="text-slate-400 text-xs">{editPdfFile ? editPdfFile.name : "Click to select PDF"}</p>
                        <p className="text-slate-600 text-xs mt-0.5">PDF only</p></>
                    }
                    <input id="editPdfInput" type="file" accept=".pdf" className="hidden"
                      onChange={e => { setEditPdfFile(e.target.files?.[0] || null); setEditPdfSuccess(false); setEditPdfError(""); }} />
                  </div>
                  {editPdfError && <p className="text-red-400 text-xs mt-1.5">⚠️ {editPdfError}</p>}
                  {!editPdfSuccess && (
                    <motion.button type="button" onClick={handleEditPdfUpload} disabled={editPdfUploading}
                      whileHover={{ scale: 1.02 }}
                      className="w-full mt-2 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                      style={{ background: "linear-gradient(135deg,#ec4899,#f43f5e)" }}>
                      {editPdfUploading ? <><Loader2 size={12} className="animate-spin" /> Uploading...</> : "Upload PDF"}
                    </motion.button>
                  )}
                </div>

                <button type="button" onClick={resetEditModal}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-white/5 hover:bg-white/10 transition-colors">
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

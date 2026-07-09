"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, ChevronDown, ChevronUp, FileVideo, FileText,
  X, Loader2, Upload, Check, Play, Eye, Trash2
} from "lucide-react";
import Navbar from "@/components/Navbar";
import EditQuizModal from "./EditQuizModal";
import EditExerciseModal from "./EditExerciseModal";

interface Lesson {
  id: string;
  title: string;
  videoUrl: string;
  notes: string;
  pptUrl: string;
  pptContent: string;
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
  const [videoMediaId, setVideoMediaId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfMediaId, setPdfMediaId] = useState<string | null>(null);
  const [videoDragging, setVideoDragging] = useState(false);
  const [pdfDragging, setPdfDragging] = useState(false);
  const [videoUploadSuccess, setVideoUploadSuccess] = useState(false);
  const [pdfUploadSuccess, setPdfUploadSuccess] = useState(false);
  const [videoError, setVideoError] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [editVideoMediaId, setEditVideoMediaId] = useState<string | null>(null);

  // Generate Quiz state
  const [generatingQuizId, setGeneratingQuizId] = useState<string | null>(null);

  // Homework state
  const [homeworkModal, setHomeworkModal] = useState(false);
  const [homeworkLessonId, setHomeworkLessonId] = useState("");
  const [homeworkTitle, setHomeworkTitle] = useState("");
  const [homeworkDesc, setHomeworkDesc] = useState("");
  const [homeworkDifficulty, setHomeworkDifficulty] = useState("medium");
  const [homeworkCreating, setHomeworkCreating] = useState(false);

  // Quiz manual add state (multi-step)
  const [quizModal, setQuizModal] = useState(false);
  const [quizLessonId, setQuizLessonId] = useState("");
  const [quizQuestion, setQuizQuestion] = useState("");
  const [quizOptions, setQuizOptions] = useState(["", "", "", ""]);
  const [quizAnswer, setQuizAnswer] = useState(0);
  const [quizExplanation, setQuizExplanation] = useState("");
  const [quizCreating, setQuizCreating] = useState(false);
  const [quizBatch, setQuizBatch] = useState<{question:string;options:string[];answer:number;explanation:string}[]>([]);

  // Exercise manual add state (multi-step)
  const [exerciseModal, setExerciseModal] = useState(false);
  const [exerciseLessonId, setExerciseLessonId] = useState("");
  const [exerciseTitle, setExerciseTitle] = useState("");
  const [exerciseDesc, setExerciseDesc] = useState("");
  const [exerciseDifficulty, setExerciseDifficulty] = useState("medium");
  const [exerciseType, setExerciseType] = useState("theory");
  const [exerciseLanguage, setExerciseLanguage] = useState("c");
  const [exerciseSolution, setExerciseSolution] = useState("");
  const [exerciseTestCases, setExerciseTestCases] = useState<{input:string;expectedOutput:string;isHidden:boolean}[]>([{input:"",expectedOutput:"",isHidden:false},{input:"",expectedOutput:"",isHidden:true}]);
  const [exerciseCreating, setExerciseCreating] = useState(false);
  const [exerciseBatch, setExerciseBatch] = useState<any[]>([]);

  // Edit Quiz state
  const [editQuizModal, setEditQuizModal] = useState(false);
  const [editQuizLessonId, setEditQuizLessonId] = useState("");

  // Edit Exercise state
  const [editExModal, setEditExModal] = useState(false);
  const [editExLessonId, setEditExLessonId] = useState("");

  // Quiz & Exercise sub-menu
  const [qeMenuOpen, setQeMenuOpen] = useState(false);
  const [qeMenuLessonId, setQeMenuLessonId] = useState("");

  // PPT Upload state
  const [pptUploading, setPptUploading] = useState(false);
  const [pptLessonId, setPptLessonId] = useState("");
  const [pptReviewData, setPptReviewData] = useState<{quizzes:any[];exercises:any[]} | null>(null);
  const [pptSaving, setPptSaving] = useState(false);
  const [pptEditIdx, setPptEditIdx] = useState<string | null>(null);
  const [pptFullscreen, setPptFullscreen] = useState(false);

  // Weekly Streak state
  const [creatingStreakId, setCreatingStreakId] = useState<string | null>(null);
  const [streakModal, setStreakModal] = useState(false);
  const [streakLessonId, setStreakLessonId] = useState("");
  const [streakModuleId, setStreakModuleId] = useState("");
  const [streakWeekNum, setStreakWeekNum] = useState(1);
  const [streakTitle, setStreakTitle] = useState("");
  const [streakDesc, setStreakDesc] = useState("");
  const [streakProblem, setStreakProblem] = useState("");
  const [streakSolution, setStreakSolution] = useState("");
  const [streakCreating, setStreakCreating] = useState(false);

  // Preview modals
  const [previewVideo, setPreviewVideo] = useState("");
  const [previewPdf, setPreviewPdf] = useState("");
  const [previewPptContent, setPreviewPptContent] = useState("");
  const [pptViewFullscreen, setPptViewFullscreen] = useState(false);

  // Delete states
  const [deletingModuleId, setDeletingModuleId] = useState<string | null>(null);
  const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null);

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
  const startVideoProcessing = async (mediaId: string | null) => {
    if (!mediaId) return;
    try {
      await fetch("/api/admin/video-process", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ mediaId }),
      });
    } catch {
      // ignore processing trigger errors, it can be retried manually
    }
  };

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

      // Step 3: verify uploaded object on S3 (size/checksum)
      try {
        const token = localStorage.getItem("token");
        const verifyRes = await fetch("/api/admin/upload/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ key: presignData.key, expectedSize: videoFile.size }),
        });
        const verifyData = await verifyRes.json();
        if (!verifyRes.ok || !verifyData.matches) {
          return setVideoError("Upload verification failed. Please try re-uploading the file.");
        }
      } catch (err) {
        return setVideoError("Upload verification failed. Please try re-uploading the file.");
      }

      setVideoUrl(presignData.publicUrl);
      setVideoMediaId(presignData.mediaId || null);
      setVideoUploadSuccess(true);
      setVideoFile(null);
      await startVideoProcessing(presignData.mediaId || null);
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
      setPdfMediaId(presignData.mediaId || null);
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
        body: JSON.stringify({ moduleId: activeModuleId, title: lessonTitle, isFree: lessonIsFree, videoUrl, notes: pdfUrl, mediaId: videoMediaId, pdfMediaId }),
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
        // Reset without cancelling uploads (they are now confirmed)
        setShowLessonModal(false);
        setLessonTitle("");
        setLessonIsFree(false);
        setVideoFile(null); setPdfFile(null);
        setVideoUrl(""); setVideoMediaId(null); setPdfUrl(""); setPdfMediaId(null);
        setVideoUploadSuccess(false); setPdfUploadSuccess(false);
        setVideoError(""); setPdfError("");
        setError("");
        setActiveModuleId("");
      } else {
        setError(data.message || "Failed to save lesson.");
      }
    } catch {
      setError("Something went wrong.");
    }
    setCreatingLesson(false);
  };

  const resetLessonModal = async () => {
    // Cancel pending uploads from S3 + DB if admin didn't save
    if (videoMediaId && videoUploadSuccess) {
      try {
        await fetch("/api/admin/upload/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ mediaId: videoMediaId }),
        });
      } catch (err) {
        console.error("Failed to cancel video upload:", err);
      }
    }
    if (pdfMediaId && pdfUploadSuccess) {
      try {
        await fetch("/api/admin/upload/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ mediaId: pdfMediaId }),
        });
      } catch (err) {
        console.error("Failed to cancel PDF upload:", err);
      }
    }
    setShowLessonModal(false);
    setLessonTitle("");
    setLessonIsFree(false);
    setVideoFile(null); setPdfFile(null);
    setVideoUrl(""); setVideoMediaId(null); setPdfUrl(""); setPdfMediaId(null);
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

      // Step 3: verify uploaded object on S3 (size/checksum)
      try {
        const verifyRes = await fetch("/api/admin/upload/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ key: presignData.key, expectedSize: editVideoFile.size }),
        });
        const verifyData = await verifyRes.json();
        if (!verifyRes.ok || !verifyData.matches) {
          return setEditVideoError("Upload verification failed. Please try re-uploading the file.");
        }
      } catch (err) {
        return setEditVideoError("Upload verification failed. Please try re-uploading the file.");
      }

      setEditVideoMediaId(presignData.mediaId || null);
      const updateRes = await fetch(`/api/admin/lessons/${editLesson.id}/update-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ videoUrl: presignData.publicUrl, mediaId: presignData.mediaId }),
      });
      const updateData = await updateRes.json();
      if (!updateRes.ok) return setEditVideoError(updateData.message || "Update failed.");
      await startVideoProcessing(presignData.mediaId || null);
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

  const resetEditModal = async () => {
    // Cancel pending edit upload if it was uploaded to S3 but update-video/update-pdf failed
    if (editVideoMediaId && !editVideoSuccess) {
      try {
        await fetch("/api/admin/upload/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ mediaId: editVideoMediaId }),
        });
      } catch (err) {
        console.error("Failed to cancel edit video upload:", err);
      }
    }
    setEditLesson(null);
    setEditVideoFile(null); setEditPdfFile(null);
    setEditVideoMediaId(null);
    setEditVideoSuccess(false); setEditPdfSuccess(false);
    setEditVideoError(""); setEditPdfError("");
  };

  // Generate Quiz & Exercise from PDF
  const handleGenerateQuiz = async (lessonId: string) => {
    if (generatingQuizId) return; // prevent double-click
    setGeneratingQuizId(lessonId);
    try {
      const res = await fetch(`/api/admin/lessons/${lessonId}/generate-quiz`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ ${data.message}`);
      } else {
        alert(`⚠️ ${data.message || "Failed to generate quiz."}`);
      }
    } catch {
      alert("⚠️ Something went wrong. Please try again.");
    }
    setGeneratingQuizId(null);
  };

  // Create Homework
  const handleSubmitHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeworkTitle.trim() || !homeworkDesc.trim()) return;
    setHomeworkCreating(true);
    try {
      const res = await fetch("/api/admin/homework", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ lessonId: homeworkLessonId, title: homeworkTitle.trim(), description: homeworkDesc.trim(), difficulty: homeworkDifficulty }),
      });
      const data = await res.json();
      if (data.success) {
        alert("✅ Homework added!");
        setHomeworkModal(false);
        setHomeworkTitle(""); setHomeworkDesc(""); setHomeworkDifficulty("medium");
      } else {
        alert(`⚠️ ${data.message || "Failed."}`);
      }
    } catch { alert("⚠️ Something went wrong."); }
    setHomeworkCreating(false);
  };

  // Quiz: Next button — add to batch (not saved yet)
  const handleQuizNext = () => {
    if (!quizQuestion.trim() || quizOptions.some(o => !o.trim())) return;
    setQuizBatch([...quizBatch, { question: quizQuestion.trim(), options: quizOptions.map(o => o.trim()), answer: quizAnswer, explanation: quizExplanation.trim() }]);
    setQuizQuestion(""); setQuizOptions(["", "", "", ""]); setQuizAnswer(0); setQuizExplanation("");
  };

  // Create Quiz — bulk save all
  const handleSubmitQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    // Include current form if filled
    let allQuizzes = [...quizBatch];
    if (quizQuestion.trim() && quizOptions.every(o => o.trim())) {
      allQuizzes.push({ question: quizQuestion.trim(), options: quizOptions.map(o => o.trim()), answer: quizAnswer, explanation: quizExplanation.trim() });
    }
    if (allQuizzes.length === 0) return;
    setQuizCreating(true);
    try {
      const res = await fetch("/api/admin/quiz/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ lessonId: quizLessonId, quizzes: allQuizzes }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ ${data.count} quiz(zes) added!`);
        setQuizModal(false); setQuizBatch([]);
        setQuizQuestion(""); setQuizOptions(["", "", "", ""]); setQuizAnswer(0); setQuizExplanation("");
      } else { alert(`⚠️ ${data.message || "Failed."}`); }
    } catch { alert("⚠️ Something went wrong."); }
    setQuizCreating(false);
  };

  // Exercise: Next button
  const handleExerciseNext = () => {
    if (!exerciseTitle.trim() || !exerciseDesc.trim()) return;
    exerciseBatch.push({ title: exerciseTitle.trim(), description: exerciseDesc.trim(), difficulty: exerciseDifficulty, type: exerciseType, language: exerciseType === "coding" ? exerciseLanguage : null, solution: exerciseType === "theory" ? exerciseSolution.trim() : null, testCases: exerciseType === "coding" ? exerciseTestCases.filter(tc => tc.input || tc.expectedOutput) : [] });
    setExerciseBatch([...exerciseBatch]);
    setExerciseTitle(""); setExerciseDesc(""); setExerciseSolution(""); setExerciseTestCases([{input:"",expectedOutput:"",isHidden:false},{input:"",expectedOutput:"",isHidden:true}]);
  };

  // Create Exercise — bulk save
  const handleSubmitExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    let allExercises = [...exerciseBatch];
    if (exerciseTitle.trim() && exerciseDesc.trim()) {
      allExercises.push({ title: exerciseTitle.trim(), description: exerciseDesc.trim(), difficulty: exerciseDifficulty, type: exerciseType, language: exerciseType === "coding" ? exerciseLanguage : null, solution: exerciseType === "theory" ? exerciseSolution.trim() : null, testCases: exerciseType === "coding" ? exerciseTestCases.filter(tc => tc.input || tc.expectedOutput) : [] });
    }
    if (allExercises.length === 0) return;
    setExerciseCreating(true);
    try {
      const res = await fetch("/api/admin/exercises/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ lessonId: exerciseLessonId, exercises: allExercises }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ ${data.count} exercise(s) added!` + (allExercises.some(e => e.type === "coding") ? " AI solutions will generate automatically." : ""));
        setExerciseModal(false); setExerciseBatch([]);
        setExerciseTitle(""); setExerciseDesc(""); setExerciseDifficulty("medium"); setExerciseType("theory"); setExerciseSolution("");
      } else { alert(`⚠️ ${data.message || "Failed."}`); }
    } catch { alert("⚠️ Something went wrong."); }
    setExerciseCreating(false);
  };

  // PPT Upload — Upload to S3, save to lesson, then AI extract
  const handlePptUpload = async (e: React.ChangeEvent<HTMLInputElement>, lessonId?: string) => {
    const targetLessonId = lessonId || pptLessonId;
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pptx")) {
      alert("⚠️ Only .pptx files are supported.");
      return;
    }
    setPptUploading(true);
    try {
      // Step 1: Upload PPT to S3 via presigned URL
      const presignRes = await fetch("/api/admin/upload/presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ fileName: file.name, fileType: file.type || "application/vnd.openxmlformats-officedocument.presentationml.presentation", fileSize: file.size, type: "ppt" }),
      });
      const presignData = await presignRes.json();
      if (!presignRes.ok) { alert(`⚠️ ${presignData.error || "Failed to get upload URL."}`); setPptUploading(false); return; }

      // Step 2: Upload to S3
      const s3Res = await fetch(presignData.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/vnd.openxmlformats-officedocument.presentationml.presentation" } });
      if (!s3Res.ok) { alert("⚠️ S3 upload failed."); setPptUploading(false); return; }

      // Step 3: Save PPT URL to lesson
      const pptSaveRes = await fetch(`/api/admin/lessons/${targetLessonId}/update-ppt`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ pptUrl: presignData.publicUrl, mediaId: presignData.mediaId }),
      });
      if (!pptSaveRes.ok) {
        const pptErr = await pptSaveRes.json().catch(() => ({}));
        console.error("PPT save failed:", pptErr);
      }

      // Update local course state so PPT button shows immediately
      setCourse(prev => prev ? {
        ...prev,
        modules: prev.modules.map(m => ({
          ...m, lessons: m.lessons.map(l => l.id === targetLessonId ? { ...l, pptUrl: presignData.publicUrl } : l)
        }))
      } : prev);

      // Step 4: AI extraction from PPT content
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/extract-ppt", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        // Save extracted text to lesson DB for View PPT feature
        if (data.extractedText) {
          await fetch(`/api/admin/lessons/${targetLessonId}/update-ppt`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
            body: JSON.stringify({ pptUrl: presignData.publicUrl, pptContent: data.extractedText }),
          });
          // Update local state with pptContent so View PPT works immediately
          setCourse(prev => prev ? {
            ...prev,
            modules: prev.modules.map(m => ({
              ...m, lessons: m.lessons.map(l => l.id === targetLessonId ? { ...l, pptContent: data.extractedText } : l)
            }))
          } : prev);
        }
        setQeMenuOpen(false);
        setPptReviewData({ quizzes: data.quizzes || [], exercises: data.exercises || [] });
      } else {
        setQeMenuOpen(false);
        alert(`✅ PPT uploaded & saved!\n⚠️ But AI extraction failed: ${data.message || "Try again."}\nYou can add quiz/exercise manually.`);
      }
    } catch {
      alert("⚠️ Something went wrong while processing the PPT.");
    }
    setPptUploading(false);
    e.target.value = "";
  };

  // PPT Save All — saves extracted quizzes and exercises to DB
  const handlePptSaveAll = async () => {
    if (!pptReviewData) return;
    setPptSaving(true);
    try {
      let quizCount = 0;
      let exCount = 0;

      // Step 1: Delete existing quizzes and exercises for this lesson (replace mode)
      // Fetch existing quizzes and delete them
      const existingQuizRes = await fetch(`/api/admin/quiz?lessonId=${pptLessonId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const existingQuizData = await existingQuizRes.json();
      if (existingQuizData.success && existingQuizData.quizzes?.length > 0) {
        for (const q of existingQuizData.quizzes) {
          await fetch(`/api/admin/quiz/${q.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` } });
        }
      }

      // Fetch existing exercises and delete them
      const existingExRes = await fetch(`/api/admin/exercises?lessonId=${pptLessonId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const existingExData = await existingExRes.json();
      if (existingExData.success && existingExData.exercises?.length > 0) {
        for (const ex of existingExData.exercises) {
          await fetch(`/api/admin/exercises/${ex.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` } });
        }
      }

      // Step 2: Save new quizzes (bulk)
      if (pptReviewData.quizzes.length > 0) {
        const qRes = await fetch("/api/admin/quiz/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ lessonId: pptLessonId, quizzes: pptReviewData.quizzes }),
        });
        const qData = await qRes.json();
        if (qData.success) quizCount = qData.count || pptReviewData.quizzes.length;
      }

      // Step 3: Save new exercises (bulk)
      if (pptReviewData.exercises.length > 0) {
        const exercises = pptReviewData.exercises.map((ex: any) => ({
          title: ex.title || "",
          description: ex.description || "",
          difficulty: ex.difficulty || "medium",
          type: ex.type || "theory",
          language: ex.type === "coding" ? (ex.language || "c") : null,
          solution: ex.type === "theory" ? (ex.solution || "") : null,
          testCases: ex.type === "coding" ? (ex.testCases || []) : [],
        }));
        const eRes = await fetch("/api/admin/exercises/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ lessonId: pptLessonId, exercises }),
        });
        const eData = await eRes.json();
        if (eData.success) exCount = eData.count || exercises.length;
      }

      alert(`✅ Saved! ${quizCount} quiz(zes) + ${exCount} exercise(s) replaced.` + (pptReviewData.exercises.some((e: any) => e.type === "coding") ? "\n🤖 AI best solutions will generate automatically for coding exercises." : ""));
      setPptReviewData(null);
    } catch {
      alert("⚠️ Something went wrong while saving.");
    }
    setPptSaving(false);
  };

  // Create Weekly Streak Challenge
  const handleCreateWeeklyStreak = (lessonId: string, moduleId: string, lessonNum: number) => {
    setStreakLessonId(lessonId);
    setStreakModuleId(moduleId);
    setStreakWeekNum(Math.floor(lessonNum / 7));
    setStreakTitle("");
    setStreakDesc("");
    setStreakProblem("");
    setStreakSolution("");
    setStreakModal(true);
  };

  const handleSubmitWeeklyStreak = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!streakTitle.trim() || !streakProblem.trim() || !streakSolution.trim()) return;
    setStreakCreating(true);
    try {
      const res = await fetch("/api/admin/weekly-streak", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          lessonId: streakLessonId,
          moduleId: streakModuleId,
          courseId,
          title: streakTitle.trim(),
          description: streakDesc.trim(),
          problem: streakProblem.trim(),
          solution: streakSolution.trim(),
          weekNumber: streakWeekNum,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("✅ Weekly Challenge created!");
        setStreakModal(false);
      } else {
        alert(`⚠️ ${data.message || "Failed."}`);
      }
    } catch {
      alert("⚠️ Something went wrong.");
    }
    setStreakCreating(false);
  };

  // ── Delete Module ──
  const handleDeleteModule = async (moduleId: string, moduleTitle: string) => {
    if (!confirm(`Are you sure you want to delete module "${moduleTitle}" and ALL its lessons? This cannot be undone.`)) return;
    setDeletingModuleId(moduleId);
    try {
      const res = await fetch(`/api/admin/modules/${moduleId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        setCourse(prev => prev ? { ...prev, modules: prev.modules.filter(m => m.id !== moduleId) } : prev);
      } else {
        alert(`⚠️ ${data.message || "Failed to delete module."}`);
      }
    } catch {
      alert("⚠️ Something went wrong.");
    }
    setDeletingModuleId(null);
  };

  // ── Delete Lesson ──
  const handleDeleteLesson = async (lessonId: string, lessonTitle: string, moduleId: string) => {
    if (!confirm(`Are you sure you want to delete lesson "${lessonTitle}"? This cannot be undone.`)) return;
    setDeletingLessonId(lessonId);
    try {
      const res = await fetch(`/api/admin/lessons/${lessonId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        setCourse(prev => prev ? {
          ...prev,
          modules: prev.modules.map(m => m.id === moduleId ? { ...m, lessons: m.lessons.filter(l => l.id !== lessonId) } : m)
        } : prev);
      } else {
        alert(`⚠️ ${data.message || "Failed to delete lesson."}`);
      }
    } catch {
      alert("⚠️ Something went wrong.");
    }
    setDeletingLessonId(null);
  };

  // ── Delete Course ──
  const handleDeleteCourse = async () => {
    const confirmText = prompt(`Type "${course?.title}" to confirm deletion of this entire course:`);
    if (confirmText !== course?.title) {
      if (confirmText !== null) alert("Course name didn't match. Deletion cancelled.");
      return;
    }
    try {
      const res = await fetch(`/api/admin/courses/${courseId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        alert("✅ Course deleted permanently.");
        router.push("/admin/dashboard");
      } else {
        alert(`⚠️ ${data.message || "Failed to delete course."}`);
      }
    } catch {
      alert("⚠️ Something went wrong.");
    }
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
                <button onClick={handleDeleteCourse}
                  className="ml-auto flex items-center gap-1 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-1 rounded-lg transition-colors text-xs font-semibold">
                  <Trash2 size={12} /> Delete Course
                </button>
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
                    <div className="flex items-center gap-2">
                      <span onClick={(e) => { e.stopPropagation(); handleDeleteModule(mod.id, mod.title); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer">
                        {deletingModuleId === mod.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </span>
                      {expandedModules.has(mod.id) ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
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
                                    {lesson.pptUrl && (
                                      <button onClick={() => { if (lesson.pptContent) setPreviewPptContent(lesson.pptContent); else alert('PPT content not available. Re-upload PPT via Quiz & Exercise.'); }}
                                        className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 px-2 py-1 rounded-lg transition-colors">
                                        <Eye size={11} /> PPT
                                      </button>
                                    )}
                                    <button onClick={() => { setEditLesson(lesson); setEditVideoSuccess(false); setEditPdfSuccess(false); setEditVideoError(""); setEditPdfError(""); }}
                                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg transition-colors">
                                      <Upload size={11} /> Edit
                                    </button>
                                    <button onClick={() => { setQeMenuLessonId(lesson.id); setQeMenuOpen(true); }}
                                      className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-lg transition-colors">
                                      <span>📝 Quiz & Exercise</span>
                                    </button>
                                    <button onClick={() => { setHomeworkLessonId(lesson.id); setHomeworkModal(true); }}
                                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 px-2 py-1 rounded-lg transition-colors">
                                      <span>📝 Homework</span>
                                    </button>
                                    {(li + 1) % 7 === 0 && (
                                      <button onClick={() => handleCreateWeeklyStreak(lesson.id, mod.id, li + 1)}
                                        className="flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 bg-yellow-500/10 px-2 py-1 rounded-lg transition-colors">
                                        <span>{creatingStreakId === lesson.id ? "Creating..." : "🔥 Weekly Challenge"}</span>
                                      </button>
                                    )}
                                    <button onClick={() => handleDeleteLesson(lesson.id, lesson.title, mod.id)}
                                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 bg-red-500/10 px-2 py-1 rounded-lg transition-colors">
                                      {deletingLessonId === lesson.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
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

      {/* PPT Content Viewer Modal */}
      <AnimatePresence>
        {previewPptContent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 overflow-y-auto"
            style={{ background: "rgba(0,0,0,0.9)", backdropFilter: "blur(10px)" }}
            onClick={e => e.target === e.currentTarget && setPreviewPptContent("")}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className={`w-full rounded-2xl overflow-hidden relative ${pptViewFullscreen ? "max-w-full mx-4 max-h-full h-[calc(100vh-48px)]" : "max-w-3xl max-h-[85vh]"}`}
              style={{ border: "1px solid rgba(245,158,11,0.3)", background: "#0f0a1e" }}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/5">
                <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">📄 PPT Content</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPptViewFullscreen(!pptViewFullscreen)} className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors" title={pptViewFullscreen ? "Minimize" : "Maximize"}>{pptViewFullscreen ? <span className="text-xs">⊖</span> : <span className="text-xs">⊕</span>}</button>
                  <button onClick={() => { setPreviewPptContent(""); setPptViewFullscreen(false); }}
                    className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              </div>
              <div className={`p-6 overflow-y-auto ${pptViewFullscreen ? "max-h-[calc(100vh-108px)]" : "max-h-[calc(85vh-60px)]"}`}>
                {previewPptContent.split(/\n---\s*SLIDE\s*\d+\s*---\n?/).filter(Boolean).map((slide, idx) => (
                  <div key={idx} className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl">
                    <div className="text-xs font-bold text-purple-400 mb-2">Slide {idx + 1}</div>
                    <p className="text-sm text-white/85 whitespace-pre-wrap leading-relaxed">{slide.trim()}</p>
                  </div>
                ))}
              </div>
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

      {/* Homework Modal */}
      <AnimatePresence>
        {homeworkModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)" }}
            onClick={e => e.target === e.currentTarget && setHomeworkModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="w-full max-w-md rounded-2xl p-7 relative"
              style={{ background: "linear-gradient(145deg,#0f0a1e,#16213e)", border: "1px solid rgba(59,130,246,0.3)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
              <button onClick={() => setHomeworkModal(false)}
                className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                <X size={14} />
              </button>
              <h3 className="text-xl font-extrabold text-white mb-1">📝 Add Homework</h3>
              <p className="text-slate-400 text-sm mb-6">Practice problem for students (no evaluation)</p>
              <form onSubmit={handleSubmitHomework} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">Title *</label>
                  <input type="text" placeholder="e.g. Build a responsive navbar" value={homeworkTitle}
                    onChange={e => setHomeworkTitle(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-blue-500 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors placeholder:text-slate-500" autoFocus />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">Description *</label>
                  <textarea placeholder="Describe the practice problem..." value={homeworkDesc}
                    onChange={e => setHomeworkDesc(e.target.value)} rows={4}
                    className="w-full bg-white/5 border border-white/10 focus:border-blue-500 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors placeholder:text-slate-500 resize-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">Difficulty</label>
                  <select value={homeworkDifficulty} onChange={e => setHomeworkDifficulty(e.target.value)}
                    className="w-full bg-[#0f0a1e] border border-white/10 focus:border-blue-500 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors">
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setHomeworkModal(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-white/5 hover:bg-white/10 transition-colors">
                    Cancel
                  </button>
                  <motion.button type="submit" disabled={homeworkCreating}
                    whileHover={!homeworkCreating ? { scale: 1.02 } : {}}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
                    {homeworkCreating ? <><Loader2 size={14} className="animate-spin" /> Adding...</> : "Add Homework"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quiz & Exercise Sub-Menu */}
      {qeMenuOpen && (()=>{ const _lesson = course?.modules.flatMap(m=>m.lessons).find(l=>l.id===qeMenuLessonId); return (<div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={e => { if (e.target === e.currentTarget && !pptUploading) setQeMenuOpen(false); }}><div className="w-full max-w-xs rounded-2xl p-6" style={{ background: "#16213e", border: "1px solid rgba(108,71,255,0.3)" }}><h3 className="text-base font-bold text-white mb-4 text-center">📝 Quiz & Exercise</h3><div className="space-y-3">{_lesson?.pptUrl && <button onClick={() => { if (_lesson.pptContent) { setPreviewPptContent(_lesson.pptContent); } else { alert('PPT content not available. Try re-uploading the PPT.'); } setQeMenuOpen(false); }} className="w-full py-2.5 rounded-xl text-xs font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-colors flex items-center justify-center gap-2">📄 View Uploaded PPT</button>}<div><label className={`block w-full py-4 rounded-xl text-sm font-semibold text-center transition-colors ${pptUploading ? "text-amber-300 bg-amber-500/20 border border-amber-500/40 cursor-wait" : "text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 cursor-pointer"}`}>{pptUploading ? <span className="flex items-center justify-center gap-2"><span className="inline-block w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></span> AI is extracting content...</span> : (_lesson?.pptUrl ? "🔄 Replace PPT" : "📄 Upload PPT")}<input type="file" accept=".pptx" className="hidden" onChange={(e) => { setPptLessonId(qeMenuLessonId); handlePptUpload(e, qeMenuLessonId); }} disabled={pptUploading} /></label>{!pptUploading && <p className="text-xs text-slate-500 text-center mt-2">{_lesson?.pptUrl ? "Re-upload will replace existing quiz & exercise" : "Upload .pptx → AI extracts → Review & Save"}</p>}{pptUploading && <p className="text-xs text-amber-400/70 text-center mt-2">Please wait... AI is reading your PPT slides</p>}</div>{!pptUploading && <div className="border-t border-white/10 pt-3"><p className="text-xs text-slate-500 text-center mb-2">Or manage manually:</p><div className="flex gap-2"><button onClick={() => { setQeMenuOpen(false); setQuizLessonId(qeMenuLessonId); setQuizModal(true); }} className="flex-1 py-2 rounded-lg text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20">+ Quiz</button><button onClick={() => { setQeMenuOpen(false); setExerciseLessonId(qeMenuLessonId); setExerciseModal(true); }} className="flex-1 py-2 rounded-lg text-xs font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20">+ Exercise</button></div><div className="flex gap-2 mt-2"><button onClick={() => { setQeMenuOpen(false); setEditQuizLessonId(qeMenuLessonId); setEditQuizModal(true); }} className="flex-1 py-2 rounded-lg text-xs font-semibold text-slate-400 bg-white/5 border border-white/10">✏️ Edit Quiz</button><button onClick={() => { setQeMenuOpen(false); setEditExLessonId(qeMenuLessonId); setEditExModal(true); }} className="flex-1 py-2 rounded-lg text-xs font-semibold text-slate-400 bg-white/5 border border-white/10">✏️ Edit Ex</button></div></div>}</div></div></div>); })()}

      {/* PPT Review Modal — shows extracted content for admin review before saving */}
      {pptReviewData && (<div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 overflow-y-auto" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)" }} onClick={e => { if (e.target === e.currentTarget) setPptReviewData(null); }}><div className={`w-full rounded-2xl p-7 relative my-auto overflow-y-auto ${pptFullscreen ? "max-w-full mx-4 max-h-full h-[calc(100vh-48px)]" : "max-w-2xl max-h-[90vh]"}`} style={{ background: "linear-gradient(145deg,#0f0a1e,#16213e)", border: "1px solid rgba(245,158,11,0.3)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}><div className="flex items-center justify-between mb-1"><h3 className="text-lg font-bold text-white">📄 PPT Extraction — Review</h3><div className="flex items-center gap-2"><button onClick={() => setPptFullscreen(!pptFullscreen)} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10" title={pptFullscreen ? "Minimize" : "Maximize"}>{pptFullscreen ? <span className="text-xs">⊖</span> : <span className="text-xs">⊕</span>}</button><button onClick={() => { setPptReviewData(null); setPptFullscreen(false); }} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10"><X size={14} /></button></div></div><p className="text-xs text-slate-400 mb-5">AI extracted the following. Click ✏️ to edit, then Save All.</p>
        {/* Quizzes */}
        {pptReviewData.quizzes.length > 0 && (<div className="mb-6"><h4 className="text-sm font-bold text-green-400 mb-3">📋 Quizzes ({pptReviewData.quizzes.length})</h4><div className="space-y-2">{pptReviewData.quizzes.map((q: any, i: number) => (<div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3">
          {pptEditIdx === `q-${i}` ? (
            <div className="space-y-2">
              <textarea value={q.question} onChange={e => { const d = {...pptReviewData}; d.quizzes[i].question = e.target.value; setPptReviewData(d); }} className="w-full bg-[#0f0a1e] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none" rows={2} />
              {q.options.map((opt: string, oi: number) => (<div key={oi} className="flex items-center gap-2"><input type="radio" checked={q.answer === oi} onChange={() => { const d = {...pptReviewData}; d.quizzes[i].answer = oi; setPptReviewData(d); }} className="accent-green-500" /><input value={opt} onChange={e => { const d = {...pptReviewData}; d.quizzes[i].options[oi] = e.target.value; setPptReviewData(d); }} className="flex-1 bg-[#0f0a1e] border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs outline-none" /></div>))}
              <input value={q.explanation || ""} onChange={e => { const d = {...pptReviewData}; d.quizzes[i].explanation = e.target.value; setPptReviewData(d); }} placeholder="Explanation" className="w-full bg-[#0f0a1e] border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs outline-none" />
              <button onClick={() => setPptEditIdx(null)} className="text-xs text-green-400 font-semibold">✅ Done Editing</button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-white text-sm font-medium mb-1"><span className="text-slate-500 mr-1">{i+1}.</span>{q.question}</p>
                <div className="flex flex-wrap gap-1.5 mt-1">{q.options.map((opt: string, oi: number) => (<span key={oi} className={`text-xs px-2 py-0.5 rounded ${oi === q.answer ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-white/5 text-slate-400 border border-white/10"}`}>{opt}</span>))}</div>
                {q.explanation && <p className="text-xs text-slate-500 mt-1">💡 {q.explanation}</p>}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => setPptEditIdx(`q-${i}`)} className="px-2 py-1 rounded-lg text-xs font-semibold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20">✏️</button>
                <button onClick={() => { const d = {...pptReviewData}; d.quizzes.splice(i, 1); setPptReviewData(d); }} className="px-2 py-1 rounded-lg text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20">🗑</button>
              </div>
            </div>
          )}
        </div>))}</div></div>)}
        {/* Exercises */}
        {pptReviewData.exercises.length > 0 && (<div className="mb-6"><h4 className="text-sm font-bold text-cyan-400 mb-3">💻 Exercises ({pptReviewData.exercises.length})</h4><div className="space-y-2">{pptReviewData.exercises.map((ex: any, i: number) => (<div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3">
          {pptEditIdx === `e-${i}` ? (
            <div className="space-y-2">
              <input value={ex.title} onChange={e => { const d = {...pptReviewData}; d.exercises[i].title = e.target.value; setPptReviewData(d); }} placeholder="Title" className="w-full bg-[#0f0a1e] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none" />
              <textarea value={ex.description} onChange={e => { const d = {...pptReviewData}; d.exercises[i].description = e.target.value; setPptReviewData(d); }} placeholder="Description" className="w-full bg-[#0f0a1e] border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none" rows={3} />
              <div className="flex gap-2">
                <select value={ex.difficulty} onChange={e => { const d = {...pptReviewData}; d.exercises[i].difficulty = e.target.value; setPptReviewData(d); }} className="flex-1 bg-[#0f0a1e] border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs outline-none"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select>
                <select value={ex.type} onChange={e => { const d = {...pptReviewData}; d.exercises[i].type = e.target.value; setPptReviewData(d); }} className="flex-1 bg-[#0f0a1e] border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs outline-none"><option value="theory">Theory</option><option value="coding">Coding</option></select>
              </div>
              {ex.type === "theory" && <textarea value={ex.solution || ""} onChange={e => { const d = {...pptReviewData}; d.exercises[i].solution = e.target.value; setPptReviewData(d); }} placeholder="Solution (for evaluation)" className="w-full bg-[#0f0a1e] border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs outline-none" rows={2} />}
              {ex.type === "coding" && <>
                <input value={ex.language || "c"} onChange={e => { const d = {...pptReviewData}; d.exercises[i].language = e.target.value; setPptReviewData(d); }} placeholder="Language (c/java/python/javascript)" className="w-full bg-[#0f0a1e] border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs outline-none" />
                <div className="text-xs font-semibold text-slate-400 mt-1">Test Cases:</div>
                {(ex.testCases || []).map((tc: any, ti: number) => (<div key={ti} className="flex gap-2 items-center"><input value={tc.input || ""} onChange={e => { const d = {...pptReviewData}; d.exercises[i].testCases[ti].input = e.target.value; setPptReviewData(d); }} placeholder="Input" className="flex-1 bg-[#0f0a1e] border border-white/10 rounded px-2 py-1 text-white text-xs outline-none" /><input value={tc.expectedOutput || ""} onChange={e => { const d = {...pptReviewData}; d.exercises[i].testCases[ti].expectedOutput = e.target.value; setPptReviewData(d); }} placeholder="Output" className="flex-1 bg-[#0f0a1e] border border-white/10 rounded px-2 py-1 text-white text-xs outline-none" /><label className="text-xs text-slate-500 flex items-center gap-1"><input type="checkbox" checked={tc.isHidden} onChange={e => { const d = {...pptReviewData}; d.exercises[i].testCases[ti].isHidden = e.target.checked; setPptReviewData(d); }} className="accent-cyan-500" />H</label><button onClick={() => { const d = {...pptReviewData}; d.exercises[i].testCases.splice(ti, 1); setPptReviewData(d); }} className="text-red-400 text-xs">✕</button></div>))}
                {(ex.testCases || []).length < 5 && <button onClick={() => { const d = {...pptReviewData}; if (!d.exercises[i].testCases) d.exercises[i].testCases = []; d.exercises[i].testCases.push({input:"",expectedOutput:"",isHidden:true}); setPptReviewData(d); }} className="text-xs text-cyan-400">+ Add Test Case</button>}
              </>}
              <button onClick={() => setPptEditIdx(null)} className="text-xs text-cyan-400 font-semibold">✅ Done Editing</button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1"><span className="text-white text-sm font-medium"><span className="text-slate-500 mr-1">{i+1}.</span>{ex.title}</span><span className={`text-xs px-2 py-0.5 rounded ${ex.type === "coding" ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"}`}>{ex.type}</span><span className={`text-xs px-2 py-0.5 rounded ${ex.difficulty === "easy" ? "bg-green-500/20 text-green-400" : ex.difficulty === "hard" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>{ex.difficulty}</span></div>
                <p className="text-xs text-slate-500 line-clamp-2">{ex.description}</p>
                {ex.type === "theory" && ex.solution && <p className="text-xs text-emerald-500 mt-1">✅ Solution: {ex.solution.slice(0,100)}...</p>}
                {ex.type === "coding" && ex.testCases && <p className="text-xs text-slate-600 mt-1">📋 {ex.testCases.length} test case(s) | Lang: {ex.language || "c"}</p>}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => setPptEditIdx(`e-${i}`)} className="px-2 py-1 rounded-lg text-xs font-semibold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20">✏️</button>
                <button onClick={() => { const d = {...pptReviewData}; d.exercises.splice(i, 1); setPptReviewData(d); }} className="px-2 py-1 rounded-lg text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20">🗑</button>
              </div>
            </div>
          )}
        </div>))}</div></div>)}
        <div className="flex gap-3 pt-2 border-t border-white/10"><button onClick={() => setPptReviewData(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-white/5 hover:bg-white/10 transition-colors">Cancel</button><button onClick={handlePptSaveAll} disabled={pptSaving} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>{pptSaving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : "✅ Save All to DB"}</button></div></div></div>)}

      {/* Quiz Add Modal — Multi-step (1-10 questions) */}
      {quizModal && (<div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.8)" }} onClick={e => { if (e.target === e.currentTarget) setQuizModal(false); }}><div className="w-full max-w-lg rounded-2xl p-7 relative max-h-[85vh] overflow-y-auto" style={{ background: "#16213e", border: "1px solid rgba(34,197,94,0.3)" }}><button onClick={() => setQuizModal(false)} className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10"><X size={14} /></button><h3 className="text-lg font-bold text-white mb-1">📋 Add Quiz Questions</h3><p className="text-xs text-slate-400 mb-4">Add 1-10 questions. Click Save to store all.</p><form onSubmit={handleSubmitQuiz} className="space-y-3"><div className="text-xs font-bold text-purple-400 mb-1">Question {quizBatch.length + 1} of max 10</div><textarea value={quizQuestion} onChange={e => setQuizQuestion(e.target.value)} placeholder="Enter question..." className="w-full bg-[#0f0a1e] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none" rows={2} />{quizOptions.map((opt, i) => (<div key={i} className="flex items-center gap-2"><input type="radio" name="quizAns" checked={quizAnswer === i} onChange={() => setQuizAnswer(i)} className="accent-green-500" /><input value={opt} onChange={e => { const o = [...quizOptions]; o[i] = e.target.value; setQuizOptions(o); }} placeholder={`Option ${i + 1}`} className="flex-1 bg-[#0f0a1e] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>))}<input value={quizExplanation} onChange={e => setQuizExplanation(e.target.value)} placeholder="Explanation (optional)" className="w-full bg-[#0f0a1e] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none" />{quizBatch.length > 0 && <div className="text-xs text-green-400">✅ {quizBatch.length} question(s) ready</div>}<div className="flex gap-3 pt-2"><button type="button" onClick={() => setQuizModal(false)} className="py-2.5 px-4 rounded-xl text-sm font-semibold text-slate-300 bg-white/5">Cancel</button><button type="button" onClick={handleQuizNext} disabled={quizBatch.length >= 10} className="py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-40">+ Next</button><button type="submit" disabled={quizCreating} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: "linear-gradient(135deg,#22c55e,#10b981)" }}>{quizCreating ? "Saving..." : `Save All (${quizBatch.length + (quizQuestion.trim() ? 1 : 0)})`}</button></div></form></div></div>)}

      {/* Exercise Add Modal — Multi-step with Theory/Coding support */}
      {exerciseModal && (<div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.8)" }} onClick={e => { if (e.target === e.currentTarget) setExerciseModal(false); }}><div className="w-full max-w-lg rounded-2xl p-7 relative max-h-[85vh] overflow-y-auto" style={{ background: "#16213e", border: "1px solid rgba(6,182,212,0.3)" }}><button onClick={() => setExerciseModal(false)} className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10"><X size={14} /></button><h3 className="text-lg font-bold text-white mb-1">💻 Add Exercise</h3><p className="text-xs text-slate-400 mb-4">Add exercises. Click Save to store all.</p><form onSubmit={handleSubmitExercise} className="space-y-3">{exerciseBatch.length > 0 && <div className="text-xs text-cyan-400">✅ {exerciseBatch.length} exercise(s) ready</div>}<input value={exerciseTitle} onChange={e => setExerciseTitle(e.target.value)} placeholder="Exercise title" className="w-full bg-[#0f0a1e] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none" /><textarea value={exerciseDesc} onChange={e => setExerciseDesc(e.target.value)} placeholder="Description / Problem statement" className="w-full bg-[#0f0a1e] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none" rows={3} /><div className="flex gap-3"><select value={exerciseDifficulty} onChange={e => setExerciseDifficulty(e.target.value)} className="flex-1 bg-[#0f0a1e] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select><select value={exerciseType} onChange={e => setExerciseType(e.target.value)} className="flex-1 bg-[#0f0a1e] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none"><option value="theory">Theory</option><option value="coding">Coding</option></select></div>{exerciseType === "theory" && (<textarea value={exerciseSolution} onChange={e => setExerciseSolution(e.target.value)} placeholder="Solution (hidden from user — used for evaluation)" className="w-full bg-[#0f0a1e] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none" rows={3} />)}{exerciseType === "coding" && (<><select value={exerciseLanguage} onChange={e => setExerciseLanguage(e.target.value)} className="w-full bg-[#0f0a1e] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none"><option value="c">C</option><option value="java">Java</option><option value="python">Python</option><option value="javascript">JavaScript</option></select><div className="text-xs font-semibold text-slate-300 mt-2">Test Cases (1-5):</div>{exerciseTestCases.map((tc, i) => (<div key={i} className="flex gap-2 items-center"><input value={tc.input} onChange={e => { const t = [...exerciseTestCases]; t[i].input = e.target.value; setExerciseTestCases(t); }} placeholder="Input" className="flex-1 bg-[#0f0a1e] border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none" /><input value={tc.expectedOutput} onChange={e => { const t = [...exerciseTestCases]; t[i].expectedOutput = e.target.value; setExerciseTestCases(t); }} placeholder="Expected Output" className="flex-1 bg-[#0f0a1e] border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none" /><label className="text-xs text-slate-400 flex items-center gap-1"><input type="checkbox" checked={tc.isHidden} onChange={e => { const t = [...exerciseTestCases]; t[i].isHidden = e.target.checked; setExerciseTestCases(t); }} className="accent-cyan-500" />Hidden</label></div>))}{exerciseTestCases.length < 5 && <button type="button" onClick={() => setExerciseTestCases([...exerciseTestCases, {input:"",expectedOutput:"",isHidden:true}])} className="text-xs text-cyan-400 hover:text-cyan-300">+ Add Test Case</button>}</>)}<div className="flex gap-3 pt-2"><button type="button" onClick={() => setExerciseModal(false)} className="py-2.5 px-4 rounded-xl text-sm font-semibold text-slate-300 bg-white/5">Cancel</button><button type="button" onClick={handleExerciseNext} className="py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500">+ Next</button><button type="submit" disabled={exerciseCreating} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: "linear-gradient(135deg,#06b6d4,#6366f1)" }}>{exerciseCreating ? "Saving..." : `Save All (${exerciseBatch.length + (exerciseTitle.trim() ? 1 : 0)})`}</button></div></form></div></div>)}

      {/* Edit Quiz Modal */}
      {editQuizModal && (<EditQuizModal lessonId={editQuizLessonId} token={getToken()} onClose={() => setEditQuizModal(false)} />)}

      {/* Edit Exercise Modal */}
      {editExModal && (<EditExerciseModal lessonId={editExLessonId} token={getToken()} onClose={() => setEditExModal(false)} />)}

      {/* Weekly Streak Challenge Modal */}
      <AnimatePresence>
        {streakModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 overflow-y-auto"
            style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)" }}
            onClick={e => e.target === e.currentTarget && setStreakModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="w-full max-w-lg rounded-2xl p-7 relative my-auto"
              style={{ background: "linear-gradient(145deg,#0f0a1e,#16213e)", border: "1px solid rgba(245,158,11,0.3)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
              <button onClick={() => setStreakModal(false)}
                className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                <X size={14} />
              </button>
              <h3 className="text-xl font-extrabold text-white mb-1">🔥 Create Weekly Challenge</h3>
              <p className="text-slate-400 text-sm mb-6">Week {streakWeekNum} — This challenge will appear after lesson completion</p>

              <form onSubmit={handleSubmitWeeklyStreak} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">Challenge Title *</label>
                  <input type="text" placeholder="e.g. Week 1 Master Challenge" value={streakTitle}
                    onChange={e => setStreakTitle(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-yellow-500 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors placeholder:text-slate-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">Description (optional)</label>
                  <input type="text" placeholder="Brief description" value={streakDesc}
                    onChange={e => setStreakDesc(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-yellow-500 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors placeholder:text-slate-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">Problem Statement *</label>
                  <textarea placeholder="Write the challenge problem here..." value={streakProblem}
                    onChange={e => setStreakProblem(e.target.value)} rows={4}
                    className="w-full bg-white/5 border border-white/10 focus:border-yellow-500 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors placeholder:text-slate-500 resize-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">Solution (for AI evaluation) *</label>
                  <textarea placeholder="Write the expected solution..." value={streakSolution}
                    onChange={e => setStreakSolution(e.target.value)} rows={4}
                    className="w-full bg-white/5 border border-white/10 focus:border-yellow-500 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors placeholder:text-slate-500 resize-none" />
                  <p className="text-slate-600 text-xs mt-1">This solution is used by AI to evaluate student answers. Not shown to students.</p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setStreakModal(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-white/5 hover:bg-white/10 transition-colors">
                    Cancel
                  </button>
                  <motion.button type="submit" disabled={streakCreating}
                    whileHover={!streakCreating ? { scale: 1.02 } : {}}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                    {streakCreating ? <><Loader2 size={14} className="animate-spin" /> Creating...</> : "🔥 Create Challenge"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

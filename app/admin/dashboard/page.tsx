"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileVideo, FileText, LogOut, Check } from "lucide-react";
import Navbar from "@/components/Navbar";

export default function AdminDashboard() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [videoSuccess, setVideoSuccess] = useState("");
  const [pdfSuccess, setPdfSuccess] = useState("");
  const [videoError, setVideoError] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [videoDragging, setVideoDragging] = useState(false);
  const [pdfDragging, setPdfDragging] = useState(false);

  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = () => {
    setLoggingOut(true);
    setTimeout(() => {
      localStorage.removeItem("adminToken");
      sessionStorage.clear();
      router.push("/");
    }, 1200);
  };

  const handleVideoUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) return setVideoError("Please select a video file.");
    setVideoError("");
    setVideoSuccess(`"${videoFile.name}" uploaded successfully!`);
    setVideoFile(null);
  };

  const handlePdfUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile) return setPdfError("Please select a PDF file.");
    setPdfError("");
    setPdfSuccess(`"${pdfFile.name}" uploaded successfully!`);
    setPdfFile(null);
  };

  const handleVideoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setVideoDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("video/")) { setVideoFile(file); setVideoError(""); }
    else setVideoError("Please drop a valid video file.");
  };

  const handlePdfDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setPdfDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === "application/pdf") { setPdfFile(file); setPdfError(""); }
    else setPdfError("Please drop a valid PDF file.");
  };

  return (
    <>
      {/* Logout overlay */}
      <AnimatePresence>
        {loggingOut && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center"
            style={{ background: "rgba(10,1,24,0.92)", backdropFilter: "blur(10px)" }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex flex-col items-center gap-4"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <LogOut size={32} className="text-purple-400" />
              </motion.div>
              <p className="text-white font-semibold text-sm">Logging out...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Navbar />
      <motion.main
        animate={loggingOut ? { opacity: 0, scale: 0.97 } : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="min-h-screen bg-[#0f0f1a] px-6 py-8 pt-24"
      >
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <span className="bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold px-3 py-1.5 rounded-full">
              🔐 Admin Panel
            </span>
            <button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
              <LogOut size={15} /> Logout
            </button>
          </div>
        </div>

        <h1 className="text-3xl font-extrabold text-white mb-1">Admin Dashboard</h1>
        <p className="text-slate-400 text-sm mb-8">Upload course content for students</p>

        <div className="grid md:grid-cols-2 gap-6">

          {/* Video Upload */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="bg-[#16213e] border border-white/10 rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-purple-500/20 p-2.5 rounded-xl">
                <FileVideo size={20} className="text-purple-400" />
              </div>
              <div>
                <h2 className="text-white font-bold">Video Upload</h2>
                <p className="text-slate-500 text-xs">MP4, AVI, MOV supported</p>
              </div>
            </div>

            {videoError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl mb-4">
                {videoError}
              </div>
            )}
            {videoSuccess && (
              <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
                <Check size={14} /> {videoSuccess}
              </div>
            )}

            <form onSubmit={handleVideoUpload} className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setVideoDragging(true); }}
                onDragLeave={() => setVideoDragging(false)}
                onDrop={handleVideoDrop}
                onClick={() => document.getElementById("videoInput")?.click()}
                className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 hover:border-purple-400 hover:shadow-lg"
                style={{ borderColor: videoDragging ? "#7c3aed" : "rgba(255,255,255,0.1)", background: videoDragging ? "rgba(124,58,237,0.08)" : "transparent" }}
              >
                <Upload size={26} className="mx-auto mb-2 text-slate-500" />
                <p className="text-slate-400 text-sm">{videoFile ? videoFile.name : "Click or drag & drop video"}</p>
                <p className="text-slate-600 text-xs mt-1">MP4, AVI, MOV</p>
                <input id="videoInput" type="file" accept="video/*" className="hidden"
                  onChange={(e) => { setVideoFile(e.target.files?.[0] || null); setVideoError(""); setVideoSuccess(""); }} />
              </div>
              <motion.button
                type="submit"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full py-3 rounded-xl font-semibold text-white text-sm"
                style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
              >
                Upload Video
              </motion.button>
            </form>
          </motion.div>

          {/* PDF Upload */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="bg-[#16213e] border border-white/10 rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-red-500/20 p-2.5 rounded-xl">
                <FileText size={20} className="text-red-400" />
              </div>
              <div>
                <h2 className="text-white font-bold">PDF Upload</h2>
                <p className="text-slate-500 text-xs">PDF files only</p>
              </div>
            </div>

            {pdfError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl mb-4">
                {pdfError}
              </div>
            )}
            {pdfSuccess && (
              <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
                <Check size={14} /> {pdfSuccess}
              </div>
            )}

            <form onSubmit={handlePdfUpload} className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setPdfDragging(true); }}
                onDragLeave={() => setPdfDragging(false)}
                onDrop={handlePdfDrop}
                onClick={() => document.getElementById("pdfInput")?.click()}
                className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 hover:border-red-400 hover:shadow-lg"
                style={{ borderColor: pdfDragging ? "#ef4444" : "rgba(255,255,255,0.1)", background: pdfDragging ? "rgba(239,68,68,0.08)" : "transparent" }}
              >
                <Upload size={26} className="mx-auto mb-2 text-slate-500" />
                <p className="text-slate-400 text-sm">{pdfFile ? pdfFile.name : "Click or drag & drop PDF"}</p>
                <p className="text-slate-600 text-xs mt-1">PDF only</p>
                <input id="pdfInput" type="file" accept=".pdf" className="hidden"
                  onChange={(e) => { setPdfFile(e.target.files?.[0] || null); setPdfError(""); setPdfSuccess(""); }} />
              </div>
              <motion.button
                type="submit"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full py-3 rounded-xl font-semibold text-white text-sm"
                style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)" }}
              >
                Upload PDF
              </motion.button>
            </form>
          </motion.div>

        </div>
      </div>
      </motion.main>
    </>
  );
}

"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Plus, BookOpen, Users, Tag, X, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";

interface Course {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  color: string;
  icon: string;
  instructor: string;
  _count?: { modules: number; enrollments: number };
  creator?: { name: string; email: string; role: string } | null;
}

const CATEGORIES = ["Web Dev", "Programming", "Data Science", "DSA", "Design", "General"];

export default function AdminDashboard() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [form, setForm] = useState({ title: "", subtitle: "", category: "Web Dev", instructor: "", color: "from-purple-500 to-pink-500" });
  const [error, setError] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<"my" | "all">("my");

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";

  useEffect(() => {
    fetchCourses();
    checkSuperAdmin();
  }, []);

  const checkSuperAdmin = () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (user.role === "super-admin") {
        setIsSuperAdmin(true);
        fetchAllCourses();
      }
    } catch {}
  };

  const fetchAllCourses = async () => {
    try {
      const res = await fetch("/api/admin/courses/all", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setAllCourses(data.courses);
    } catch {}
  };

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/courses", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setCourses(data.courses);
    } catch {}
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) return setError("Course title is required.");
    setCreating(true);
    try {
      const res = await fetch("/api/admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form }),
      });
      const data = await res.json();
      if (!data.success) return setError(data.message || "Failed to create course.");
      setCourses(prev => [data.course, ...prev]);
      setShowModal(false);
      setForm({ title: "", subtitle: "", category: "Web Dev", instructor: "", color: "from-purple-500 to-pink-500" });
    } catch {
      setError("Something went wrong.");
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = () => {
    setLoggingOut(true);
    setTimeout(() => {
      localStorage.removeItem("token");
      localStorage.removeItem("adminToken");
      localStorage.removeItem("user");
      router.push("/");
    }, 1000);
  };

  return (
    <>
      <AnimatePresence>
        {loggingOut && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(10,1,24,0.95)", backdropFilter: "blur(10px)" }}>
            <div className="flex flex-col items-center gap-3">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                <LogOut size={28} className="text-purple-400" />
              </motion.div>
              <p className="text-white text-sm font-semibold">Logging out...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Navbar />

      <motion.main animate={loggingOut ? { opacity: 0 } : { opacity: 1 }}
        className="min-h-screen bg-[#0f0f1a] px-6 py-8 pt-24">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold px-3 py-1 rounded-full">🔐 Admin Panel</span>
              </div>
              <h1 className="text-3xl font-extrabold text-white">Course Management</h1>
              <p className="text-slate-400 text-sm mt-1">Create and manage your learning content</p>
            </div>
            <button onClick={handleLogout}
              className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors px-4 py-2 rounded-xl hover:bg-white/5">
              <LogOut size={15} /> Logout
            </button>
          </div>

          {/* Create Button */}
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white text-sm mb-8"
            style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)", boxShadow: "0 4px 20px rgba(124,58,237,0.35)" }}>
            <Plus size={18} /> Create New Course
          </motion.button>

          {/* Super Admin Tabs */}
          {isSuperAdmin && (
            <div className="flex gap-2 mb-6">
              <button onClick={() => setActiveTab("my")}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === "my" ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" : "text-slate-400 hover:text-white bg-white/5"}`}>
                My Courses
              </button>
              <button onClick={() => setActiveTab("all")}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === "all" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" : "text-slate-400 hover:text-white bg-white/5"}`}>
                👑 All Courses (Super Admin)
              </button>
            </div>
          )}

          {/* Courses Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="text-purple-400 animate-spin" />
            </div>
          ) : (activeTab === "my" ? courses : allCourses).length === 0 ? (
            <div className="text-center py-20">
              <BookOpen size={48} className="text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-lg font-semibold">No courses yet</p>
              <p className="text-slate-600 text-sm mt-1">{activeTab === "my" ? 'Click "Create New Course" to get started' : "No courses from any admin yet"}</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(activeTab === "my" ? courses : allCourses).map((course, i) => (
                <motion.div key={course.id}
                  initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-[#16213e] border border-white/10 rounded-2xl overflow-hidden hover:border-purple-500/30 transition-all group">
                  {/* Thumbnail */}
                    <div className={`h-36 bg-gradient-to-br ${course.color} flex items-center justify-center relative`}>
                    <span className="text-4xl">📚</span>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Tag size={10} /> {course.category}
                      </span>
                      {activeTab === "all" && course.creator && (
                        <span className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full">
                          by {course.creator.name || course.creator.email}
                        </span>
                      )}
                    </div>
                    <h3 className="text-white font-bold text-base mb-1 line-clamp-1">{course.title}</h3>
                    <p className="text-slate-400 text-xs mb-4 line-clamp-2">{course.subtitle || "No description"}</p>

                    <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
                      <span className="flex items-center gap-1"><BookOpen size={11} /> {course._count?.modules || 0} modules</span>
                      <span className="flex items-center gap-1"><Users size={11} /> {course._count?.enrollments || 0} enrolled</span>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={() => router.push(`/admin/course/${course.id}`)}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                      style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}>
                      Manage Course
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.main>

      {/* Create Course Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)" }}
            onClick={e => e.target === e.currentTarget && setShowModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="w-full max-w-md rounded-2xl p-7 relative"
              style={{ background: "linear-gradient(145deg,#0f0a1e,#16213e)", border: "1px solid rgba(124,58,237,0.25)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>

              <button onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                <X size={14} />
              </button>

              <h3 className="text-xl font-extrabold text-white mb-1">Create New Course</h3>
              <p className="text-slate-400 text-sm mb-6">Fill in the details to create a course</p>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-xl mb-4">⚠️ {error}</div>
              )}

              <form onSubmit={handleCreate} className="space-y-4">
                {[
                  { label: "Course Title *", key: "title", placeholder: "e.g. Complete React Course" },
                  { label: "Short Description", key: "subtitle", placeholder: "e.g. Learn React from scratch" },
                  { label: "Instructor Name", key: "instructor", placeholder: "e.g. John Doe" },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">{label}</label>
                    <input
                      type="text"
                      placeholder={placeholder}
                      value={form[key as keyof typeof form]}
                      onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors placeholder:text-slate-500"
                    />
                  </div>
                ))}

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">Category</label>
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full bg-[#0f0a1e] border border-white/10 focus:border-purple-500 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-white/5 hover:bg-white/10 transition-colors">
                    Cancel
                  </button>
                  <motion.button type="submit" disabled={creating}
                    whileHover={!creating ? { scale: 1.02 } : {}} whileTap={!creating ? { scale: 0.97 } : {}}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}>
                    {creating ? <><Loader2 size={14} className="animate-spin" /> Creating...</> : "Create Course"}
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

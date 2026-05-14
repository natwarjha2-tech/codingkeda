"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpen, ArrowRight, Loader2, GraduationCap } from "lucide-react";
import Navbar from "@/components/Navbar";
import { getToken } from "@/services/auth";

interface EnrolledCourse {
  id: string;
  title: string;
  color: string;
  icon: string;
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
}

export default function MyCoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login?redirect=/my-courses");
      return;
    }

    fetch("/api/student/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCourses(data.enrolledCourses || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0f0f1a] px-6 py-10 pt-24">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-10"
          >
            <div className="flex items-center gap-3 mb-2">
              <GraduationCap size={24} className="text-purple-400" />
              <h1 className="text-3xl font-extrabold text-white">My Courses</h1>
            </div>
            <p className="text-slate-400 text-sm">
              All courses you have enrolled in. Continue learning from where you left off.
            </p>
          </motion.div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="text-purple-400 animate-spin" />
            </div>
          )}

          {/* Empty State */}
          {!loading && courses.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <BookOpen size={48} className="text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-lg font-semibold mb-2">
                No courses enrolled yet
              </p>
              <p className="text-slate-600 text-sm mb-6">
                Explore our courses and start your learning journey today.
              </p>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => router.push("/dashboard")}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white text-sm"
                style={{
                  background: "linear-gradient(135deg,#7c3aed,#ec4899)",
                  boxShadow: "0 4px 20px rgba(124,58,237,0.35)",
                }}
              >
                Browse Courses <ArrowRight size={15} />
              </motion.button>
            </motion.div>
          )}

          {/* Enrolled Courses Grid */}
          {!loading && courses.length > 0 && (
            <div className="grid md:grid-cols-2 gap-6">
              {courses.map((course, i) => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="bg-[#16213e] border border-white/10 rounded-2xl overflow-hidden hover:border-purple-500/30 transition-all group"
                >
                  {/* Color Banner */}
                  <div
                    className="h-24 flex items-center justify-center relative"
                    style={{
                      background: course.color?.startsWith("linear")
                        ? course.color
                        : `linear-gradient(135deg, ${course.color || "#7c3aed"}, #ec4899)`,
                    }}
                  >
                    <div className="absolute inset-0 bg-black/20" />
                    <span className="text-3xl relative z-10">📚</span>
                  </div>

                  <div className="p-5">
                    <h3 className="text-white font-bold text-base mb-3 line-clamp-1">
                      {course.title}
                    </h3>

                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-400">
                          {course.completedLessons}/{course.totalLessons} lessons
                        </span>
                        <span className="text-purple-400 font-semibold">
                          {course.progressPercent}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${course.progressPercent}%` }}
                          transition={{ duration: 0.8, delay: 0.2 + i * 0.1 }}
                          className="h-full rounded-full"
                          style={{
                            background: "linear-gradient(90deg,#7c3aed,#ec4899)",
                          }}
                        />
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center justify-between mb-4">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                          course.progressPercent === 100
                            ? "bg-green-500/15 text-green-400 border border-green-500/30"
                            : course.progressPercent > 0
                            ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                            : "bg-slate-500/15 text-slate-400 border border-slate-500/30"
                        }`}
                      >
                        {course.progressPercent === 100
                          ? "✅ Completed"
                          : course.progressPercent > 0
                          ? "📖 In Progress"
                          : "🆕 Not Started"}
                      </span>
                    </div>

                    {/* Continue Button */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => router.push("/dashboard")}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all flex items-center justify-center gap-2"
                      style={{
                        background: "linear-gradient(135deg,#7c3aed,#ec4899)",
                      }}
                    >
                      Continue Learning <ArrowRight size={14} />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

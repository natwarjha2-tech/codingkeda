"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Heart, Trash2, ArrowRight, Loader2, BookOpen } from "lucide-react";
import Navbar from "@/components/Navbar";
import { getToken } from "@/services/auth";

interface WishlistItem {
  id: string;
  courseId: string;
  title: string;
  subtitle: string;
  category: string;
  instructor: string;
  color: string;
  rating: number;
  totalHours: number;
  addedAt: string;
}

export default function WishlistPage() {
  const router = useRouter();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login?redirect=/wishlist");
      return;
    }

    fetch("/api/wishlist", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setItems(data.wishlist || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const handleRemove = async (courseId: string) => {
    setRemoving(courseId);
    try {
      const token = getToken();
      const res = await fetch("/api/wishlist", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ courseId }),
      });
      const data = await res.json();
      if (data.success) {
        setItems((prev) => prev.filter((item) => item.courseId !== courseId));
      }
    } catch {}
    setRemoving(null);
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0f0f1a] px-6 py-10 pt-24">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10"
          >
            <div className="flex items-center gap-3 mb-2">
              <Heart size={24} className="text-pink-400" />
              <h1 className="text-3xl font-extrabold text-white">Wishlist</h1>
            </div>
            <p className="text-slate-400 text-sm">
              Courses you&apos;ve saved for later. Enroll when you&apos;re ready.
            </p>
          </motion.div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="text-purple-400 animate-spin" />
            </div>
          )}

          {/* Empty State */}
          {!loading && items.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <Heart size={48} className="text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-lg font-semibold mb-2">
                Your wishlist is empty
              </p>
              <p className="text-slate-600 text-sm mb-6">
                Browse courses and add them to your wishlist to save for later.
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

          {/* Wishlist Grid */}
          {!loading && items.length > 0 && (
            <div className="grid md:grid-cols-2 gap-6">
              {items.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="bg-[#16213e] border border-white/10 rounded-2xl overflow-hidden hover:border-purple-500/30 transition-all"
                >
                  {/* Color Banner */}
                  <div
                    className="h-20 flex items-center justify-center relative"
                    style={{
                      background: item.color?.includes("gradient")
                        ? item.color
                        : `linear-gradient(135deg, ${item.color || "#7c3aed"}, #ec4899)`,
                    }}
                  >
                    <div className="absolute inset-0 bg-black/20" />
                    <span className="text-2xl relative z-10">📚</span>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
                        {item.category}
                      </span>
                      <button
                        onClick={() => handleRemove(item.courseId)}
                        disabled={removing === item.courseId}
                        className="text-slate-500 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-500/10"
                        title="Remove from wishlist"
                      >
                        {removing === item.courseId ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>

                    <h3 className="text-white font-bold text-base mb-1 line-clamp-1">
                      {item.title}
                    </h3>
                    <p className="text-slate-400 text-xs mb-3 line-clamp-2">
                      {item.subtitle}
                    </p>

                    <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
                      <span>{item.instructor}</span>
                      <span>⭐ {item.rating}</span>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() =>
                        router.push(
                          `/payment?courseId=${item.courseId}`
                        )
                      }
                      className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
                      style={{
                        background: "linear-gradient(135deg,#7c3aed,#ec4899)",
                      }}
                    >
                      <BookOpen size={14} /> Enroll Now
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

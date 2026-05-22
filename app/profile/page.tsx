"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { User, Mail, Calendar, BookOpen, Save, Loader2, CheckCircle, Camera } from "lucide-react";
import Navbar from "@/components/Navbar";
import { getToken } from "@/services/auth";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import MobileBackButton from "@/components/MobileBackButton";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  enrolledCourses?: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const triggerLogin = useAuthRedirect();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdChanging, setPwdChanging] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) {
      triggerLogin();
      return;
    }

    fetch("/api/student", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const user = data.student || data.user;
          setProfile(user);
          setName(user.name || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Restore avatar from server
    fetch("/api/student/avatar", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.avatarUrl) setAvatarUrl(data.avatarUrl);
      })
      .catch(() => {});
  }, [router]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be less than 2MB.");
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarUrl(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload to server
    const token = getToken();
    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const res = await fetch("/api/student/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.avatarUrl) {
        setAvatarUrl(data.avatarUrl);
        window.dispatchEvent(new Event("avatar-updated"));
      } else {
        setError(data.message || "Failed to upload photo.");
      }
    } catch {
      setError("Failed to upload photo. Please try again.");
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name cannot be empty.");
      return;
    }

    setError("");
    setSaving(true);
    setSaved(false);

    try {
      const token = getToken();
      const res = await fetch("/api/student/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(data.message || "Failed to update profile.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
          <Loader2 size={28} className="text-purple-400 animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0f0f1a] px-6 py-10 pt-24">
        <div className="max-w-lg mx-auto">
          <MobileBackButton />
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-2xl font-extrabold text-white mb-1">Edit Profile</h1>
            <p className="text-slate-400 text-sm">Manage your account information</p>
          </motion.div>

          {/* Avatar */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-4 mb-8"
          >
            <div className="relative group">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white overflow-hidden"
                style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  (profile?.name || "U").charAt(0).toUpperCase()
                )}
              </div>
              <button
                type="button"
                onClick={() => document.getElementById("avatar-upload")?.click()}
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
              >
                <Camera size={18} className="text-white" />
              </button>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div>
              <p className="text-white font-semibold">{profile?.name || "User"}</p>
              <p className="text-slate-400 text-sm">{profile?.email}</p>
              <button
                type="button"
                onClick={() => document.getElementById("avatar-upload")?.click()}
                className="text-purple-400 text-xs mt-1 hover:underline cursor-pointer"
              >
                Change photo
              </button>
            </div>
          </motion.div>

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-5"
          >
            {/* Name */}
            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-2 mb-2">
                <User size={13} className="text-purple-400" /> Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors placeholder:text-slate-500"
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-2 mb-2">
                <Mail size={13} className="text-purple-400" /> Email Address
              </label>
              <input
                type="email"
                value={profile?.email || ""}
                disabled
                className="w-full bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-slate-400 text-sm cursor-not-allowed"
              />
              <p className="text-slate-600 text-xs mt-1">Email cannot be changed</p>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-white/5 border border-white/8 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar size={13} className="text-purple-400" />
                  <span className="text-xs text-slate-400">Member Since</span>
                </div>
                <p className="text-white text-sm font-semibold">
                  {profile?.createdAt
                    ? new Date(profile.createdAt).toLocaleDateString("en-IN", {
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </p>
              </div>
              <div className="bg-white/5 border border-white/8 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen size={13} className="text-purple-400" />
                  <span className="text-xs text-slate-400">Enrolled</span>
                </div>
                <p className="text-white text-sm font-semibold">
                  {profile?.enrolledCourses ?? 0} courses
                </p>
              </div>
            </div>

            {/* Change Password */}
            <div className="pt-4 border-t border-white/8">
              <h3 className="text-sm font-semibold text-white mb-3">Change Password</h3>
              <div className="space-y-3">
                <input
                  type="password"
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  placeholder="Current password"
                  className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors placeholder:text-slate-500"
                />
                <input
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="New password (min 8 characters)"
                  className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors placeholder:text-slate-500"
                />
                <input
                  type="password"
                  id="confirmNewPwd"
                  placeholder="Confirm new password"
                  className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors placeholder:text-slate-500"
                />
                {pwdSuccess && (
                  <p className="text-green-400 text-xs">{pwdSuccess}</p>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    setError(""); setPwdSuccess("");
                    const confirmPwd = (document.getElementById("confirmNewPwd") as HTMLInputElement)?.value || "";
                    if (!currentPwd.trim() || !newPwd.trim() || !confirmPwd.trim()) { setError("All password fields are required."); return; }
                    if (newPwd.length < 8) { setError("New password must be at least 8 characters."); return; }
                    if (newPwd !== confirmPwd) { setError("New passwords do not match."); return; }
                    setPwdChanging(true);
                    try {
                      const token = getToken();
                      const res = await fetch("/api/auth/change-password", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
                      });
                      const data = await res.json();
                      if (data.success) { setPwdSuccess("Password changed successfully!"); setCurrentPwd(""); setNewPwd(""); (document.getElementById("confirmNewPwd") as HTMLInputElement).value = ""; }
                      else { setError(data.message || "Failed to change password."); }
                    } catch { setError("Something went wrong."); }
                    setPwdChanging(false);
                  }}
                  disabled={pwdChanging}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}
                >
                  {pwdChanging ? "Changing..." : "Change Password"}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/30 px-3 py-2 rounded-lg">
                ⚠️ {error}
              </p>
            )}

            {/* Save Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white text-sm disabled:opacity-60"
              style={{
                background: saved
                  ? "linear-gradient(135deg,#22c55e,#16a34a)"
                  : "linear-gradient(135deg,#7c3aed,#ec4899)",
                boxShadow: "0 4px 20px rgba(124,58,237,0.3)",
              }}
            >
              {saving ? (
                <><Loader2 size={15} className="animate-spin" /> Saving...</>
              ) : saved ? (
                <><CheckCircle size={15} /> Profile Saved!</>
              ) : (
                <><Save size={15} /> Save Changes</>
              )}
            </motion.button>
          </motion.div>
        </div>
      </main>
    </>
  );
}

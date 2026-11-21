"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Lock, LogOut, UserX } from "lucide-react";
import { api } from "../api";
import { logoutUser } from "@/services/auth";
import { Bar, Panel, btn } from "@/components/my/ui";
import DeleteAccountModal from "@/components/my/DeleteAccountModal";

type Student = {
  name: string; email: string; studentName?: string | null; studentDob?: string | null; studentGrade?: string | null;
  studentGender?: string | null; studentSchool?: string | null; parentName?: string | null; parentEmail?: string | null; parentContact?: string | null;
};
type Xp = { level: number; title: string; xp: number; progressPct: number; toNext: number; next?: { level: number; title: string } | null; floor?: number; ceil?: number };

const QUICK = [
  { href: "/my/report", label: "My Report", icon: "📊", color: "#8b5cf6" },
  { href: "/my/referral", label: "Refer & Earn", icon: "🎁", color: "#f59e0b" },
  { href: "/my/help", label: "Help & Support", icon: "💖", color: "#ec4899" },
  { href: "/my/orders", label: "My Orders", icon: "🧾", color: "#3b82f6" },
  { href: "/my/mall", label: "CK Mall", icon: "🏬", color: "#fbbf24" },
  { href: "/my/rate", label: "Rate Us", icon: "⭐", color: "#22c55e" },
  { href: "/my/about", label: "About", icon: "ℹ️", color: "#06b6d4" },
  { href: "/my/progress", label: "Student Progress", icon: "🎓", color: "#a78bfa" },
  { href: "/my/certificates", label: "Certificates", icon: "📜", color: "#fbbf24" },
  { href: "/my/achievements", label: "Achievements", icon: "🏆", color: "#f59e0b" },
  { href: "/my/homework", label: "Homework", icon: "📝", color: "#10b981" },
  { href: "/my/live", label: "Live Classes", icon: "🎥", color: "#ef4444" },
];

const field = "w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white outline-none focus:border-violet-400";

export default function ProfilePage() {
  const router = useRouter();
  const [s, setS] = useState<Student | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [xp, setXp] = useState<Xp | null>(null);
  const [enrolled, setEnrolled] = useState<{ id: string; title: string; progressPercent: number; completedLessons: number; totalLessons: number }[]>([]);
  const [coins, setCoins] = useState(0);
  const [ach, setAch] = useState<{ id: string; title: string; badgeType: string; courseTitle?: string }[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwd, setPwd] = useState({ cur: "", nw: "", cf: "" });
  const [saving, setSaving] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api("/api/student").then((d) => setS(d.student)).catch(() => {});
    api("/api/student/avatar").then((d) => setAvatar(d.avatarUrl || null)).catch(() => {});
    api("/api/xp").then((d) => d?.xp && setXp(d.xp)).catch(() => {});
    api("/api/student/dashboard").then((d) => setEnrolled(d.enrolledCourses || [])).catch(() => {});
    api("/api/coins").then((d) => setCoins(d.totalCoins || 0)).catch(() => {});
    api("/api/achievements").then((d) => setAch((d.achievements || []).slice(0, 3))).catch(() => {});
  }, []);

  const set = (k: keyof Student, v: string) => setS((p) => (p ? { ...p, [k]: v } : p));

  const save = async () => {
    if (!s) return;
    if (!s.name?.trim()) { setMsg({ ok: false, text: "Account name is required." }); return; }
    setSaving(true); setMsg({ ok: true, text: "Saving..." });
    try {
      await api("/api/student/profile", {
        method: "PATCH",
        json: {
          name: s.name.trim(), studentName: s.studentName || "", studentDob: s.studentDob || "", studentGrade: s.studentGrade || "",
          studentGender: s.studentGender || "", studentSchool: s.studentSchool || "", parentName: s.parentName || "",
          parentEmail: s.parentEmail || "", parentContact: s.parentContact || "",
        },
      });
      setMsg({ ok: true, text: "✅ Profile saved successfully!" });
      setTimeout(() => setMsg(null), 3000);
    } catch (e) { setMsg({ ok: false, text: `❌ ${e instanceof Error ? e.message : "Failed to save."}` }); }
    finally { setSaving(false); }
  };

  const onPhoto = async (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { setMsg({ ok: false, text: "Please choose an image." }); return; }
    if (f.size > 2 * 1024 * 1024) { setMsg({ ok: false, text: "Photo must be under 2 MB." }); return; }
    setAvatar(URL.createObjectURL(f));
    const fd = new FormData();
    fd.append("avatar", f);
    try { const d = await api("/api/student/avatar", { method: "POST", body: fd }); if (d.avatarUrl) setAvatar(d.avatarUrl); }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Upload failed." }); }
  };

  const changePwd = async () => {
    if (!pwd.cur || !pwd.nw || !pwd.cf) { setPwdMsg({ ok: false, text: "All password fields are required." }); return; }
    if (pwd.nw.length < 8) { setPwdMsg({ ok: false, text: "New password must be at least 8 characters." }); return; }
    if (pwd.nw !== pwd.cf) { setPwdMsg({ ok: false, text: "New passwords do not match." }); return; }
    try {
      await api("/api/auth/change-password", { method: "POST", json: { currentPassword: pwd.cur, newPassword: pwd.nw } });
      setPwdMsg({ ok: true, text: "✅ Password changed successfully!" });
      setPwd({ cur: "", nw: "", cf: "" });
    } catch (e) { setPwdMsg({ ok: false, text: `❌ ${e instanceof Error ? e.message : "Failed to change password."}` }); }
  };

  const logout = () => {
    logoutUser();
    ["ck_token", "user", "userEmail"].forEach((k) => localStorage.removeItem(k));
    router.replace("/login");
  };

  if (!s) return <div className="py-16 text-center text-slate-400">Loading profile…</div>;
  const initial = (s.name || "?").charAt(0).toUpperCase();
  const achIcon = (b: string) => (b === "super-master" ? "🏆" : b === "master" ? "🥈" : "⭐");

  return (
    <div className="mx-auto max-w-5xl space-y-5 pt-2">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-violet-400/20 bg-gradient-to-br from-[#2e1a4a]/70 to-[#161626] p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-violet-600/15 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-fuchsia-500 to-rose-500 text-4xl font-extrabold">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initial}
              </div>
              <button onClick={() => fileRef.current?.click()} className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#161626] bg-violet-600" title="Change photo"><Camera size={14} /></button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
            </div>
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-extrabold">{s.name} <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[10px]">✓</span></h1>
              <div className="text-sm text-slate-400">{s.email}</div>
            </div>
          </div>
          <div className="grid flex-1 grid-cols-3 gap-3">
            <Mini icon="📚" value={enrolled.length} label="Learning" sub="courses active" />
            <Mini icon="🪙" value={coins} label="Coins" sub="earned" />
            <Mini icon="🏅" value={ach.length ? `${ach.length}+` : 0} label="Badges" sub="achievements" />
          </div>
        </div>
        {xp && (
          <div className="relative mt-6 flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex h-14 w-14 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-[#431407]">
              <span className="text-[9px] font-extrabold">LEVEL</span><span className="text-xl font-extrabold leading-none">{xp.level}</span>
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-sm"><b>{xp.title}</b><span className="text-slate-400">{xp.xp} XP</span></div>
              <div className="mb-1 text-xs text-slate-500">Keep learning. Keep growing.</div>
              <Bar pct={xp.progressPct} from="from-amber-400" to="to-pink-500" />
            </div>
            <div className="text-right"><div className="text-lg font-extrabold text-amber-300">{xp.toNext} XP</div><div className="text-xs text-slate-500">{xp.next ? `to Level ${xp.next.level}` : "Max level"}</div></div>
          </div>
        )}
      </section>

      {/* Enrolled + Achievements */}
      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Enrolled Courses" icon="📖" right={<Link href="/my/courses" className="text-xs font-bold text-violet-300">View All →</Link>}>
          {enrolled.length === 0 && <div className="py-4 text-sm text-slate-400">No courses yet.</div>}
          <div className="space-y-3">
            {enrolled.slice(0, 4).map((c) => (
              <Link key={c.id} href={`/my/courses/${c.id}`} className="block rounded-xl bg-white/5 p-3 hover:bg-white/10">
                <div className="mb-1.5 flex justify-between text-sm"><b className="truncate">{c.title}</b><span className="text-violet-300">{c.progressPercent}%</span></div>
                <Bar pct={c.progressPercent} />
                <div className="mt-1 text-[11px] text-slate-500">{c.completedLessons}/{c.totalLessons} lessons</div>
              </Link>
            ))}
          </div>
          <Link href="/my/courses" className="mt-3 block rounded-xl border border-dashed border-white/15 py-2 text-center text-sm text-slate-400 hover:text-white">+ Browse More Courses</Link>
        </Panel>
        <Panel title="Achievements" icon="🏆" right={<Link href="/my/achievements" className="text-xs font-bold text-violet-300">View All →</Link>}>
          {ach.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-400">🏆 No badges yet. Finish quizzes to earn your first one!</div>
          ) : (
            <div className="space-y-2">
              {ach.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                  <span className="text-2xl">{achIcon(a.badgeType)}</span>
                  <div className="min-w-0"><div className="truncate text-sm font-bold">{a.title}</div>{a.courseTitle && <div className="truncate text-xs text-slate-500">{a.courseTitle}</div>}</div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Student info */}
      <Panel title="Student Information" icon="🎓" sub="Your academic profile">
        <div className="grid gap-3 sm:grid-cols-2">
          <L label="Student Name"><input className={field} value={s.studentName || ""} onChange={(e) => set("studentName", e.target.value)} placeholder="Student's full name" /></L>
          <L label="Date of Birth"><input type="date" className={field} value={(s.studentDob || "").slice(0, 10)} onChange={(e) => set("studentDob", e.target.value)} /></L>
          <L label="Grade">
            <select className={`${field} bg-[#1a1a2e]`} value={s.studentGrade || ""} onChange={(e) => set("studentGrade", e.target.value)}>
              <option value="">Select Grade</option>
              {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={String(i + 1)}>Grade {i + 1}</option>)}
              <option value="college">College</option><option value="other">Other</option>
            </select>
          </L>
          <L label="Gender">
            <select className={`${field} bg-[#1a1a2e]`} value={s.studentGender || ""} onChange={(e) => set("studentGender", e.target.value)}>
              <option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option><option value="prefer-not-to-say">Prefer not to say</option>
            </select>
          </L>
          <div className="sm:col-span-2"><L label="School"><input className={field} value={s.studentSchool || ""} onChange={(e) => set("studentSchool", e.target.value)} placeholder="School/Institution name" /></L></div>
        </div>
      </Panel>

      {/* Parent info */}
      <Panel title="Parent / Guardian Information" icon="👨‍👩‍👧" sub="Keep your guardian contact details updated">
        <div className="grid gap-3 sm:grid-cols-3">
          <L label="Parent Name"><input className={field} value={s.parentName || ""} onChange={(e) => set("parentName", e.target.value)} /></L>
          <L label="Parent Email"><input type="email" className={field} value={s.parentEmail || ""} onChange={(e) => set("parentEmail", e.target.value)} /></L>
          <L label="Parent Phone"><input type="tel" className={field} value={s.parentContact || ""} onChange={(e) => set("parentContact", e.target.value)} placeholder="+91 9876543210" /></L>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={save} disabled={saving} className={`${btn} bg-gradient-to-r from-violet-600 to-pink-500 disabled:opacity-60`}>Update Profile</button>
          <span className="text-xs text-slate-500">Saves your Student and Parent/Guardian details</span>
          {msg && <span className={`text-sm ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</span>}
        </div>
        <Link href="/parent-consent" className="mt-3 inline-block text-xs font-semibold text-violet-300 hover:text-white">Verify parent / profile →</Link>
      </Panel>

      {/* Account settings */}
      <Panel title="Account Settings" icon="⚙️" sub="Manage your account information and security">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <div className="text-sm font-bold text-slate-300">Account Information</div>
            <L label="Display Name"><input className={field} value={s.name} onChange={(e) => set("name", e.target.value)} /></L>
            <div className="text-[11px] text-slate-500">The name shown across CodingKida</div>
            <L label="Email"><div className="relative"><input className={`${field} pr-24 opacity-70`} value={s.email} readOnly /><span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-[11px] text-slate-500"><Lock size={11} /> Read only</span></div></L>
            <button onClick={save} disabled={saving} className={`${btn} bg-violet-600 hover:bg-violet-500 disabled:opacity-60`}>Save Changes</button>
          </div>
          <div className="space-y-3">
            <div className="text-sm font-bold text-slate-300">Security</div>
            <L label="Current Password"><input type="password" className={field} value={pwd.cur} onChange={(e) => setPwd({ ...pwd, cur: e.target.value })} /></L>
            <L label="New Password"><input type="password" className={field} value={pwd.nw} onChange={(e) => setPwd({ ...pwd, nw: e.target.value })} placeholder="Min 8 characters" /></L>
            <L label="Confirm New Password"><input type="password" className={field} value={pwd.cf} onChange={(e) => setPwd({ ...pwd, cf: e.target.value })} /></L>
            {pwdMsg && <div className={`rounded-lg px-3 py-2 text-sm ${pwdMsg.ok ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"}`}>{pwdMsg.text}</div>}
            <button onClick={changePwd} className={`${btn} border border-white/15 hover:bg-white/5`}>Update Password</button>
          </div>
        </div>
      </Panel>

      {/* Quick actions */}
      <Panel title="Quick Actions" icon="⚡">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK.map((q) => (
            <Link key={q.href} href={q.href} className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center transition hover:-translate-y-0.5" style={{ boxShadow: `inset 0 0 0 1px ${q.color}10` }}>
              <span className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl" style={{ background: `${q.color}18` }}>{q.icon}</span>
              <span className="text-sm font-semibold">{q.label}</span>
            </Link>
          ))}
        </div>
      </Panel>

      <div className="flex flex-wrap gap-3 pb-4">
        <button onClick={logout} className={`${btn} border border-white/15 hover:bg-white/5`}><LogOut size={15} /> Logout</button>
        <button onClick={() => setDelOpen(true)} className={`${btn} border border-red-400/30 text-red-400 hover:bg-red-500/10`}><UserX size={15} /> Delete account</button>
      </div>
      {delOpen && <DeleteAccountModal onClose={() => setDelOpen(false)} />}
    </div>
  );
}

function Mini({ icon, value, label, sub }: { icon: string; value: React.ReactNode; label: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-center">
      <div className="text-xl">{icon}</div>
      <div className="text-xl font-extrabold">{value}</div>
      <div className="text-xs font-semibold text-slate-300">{label}</div>
      <div className="text-[10px] text-slate-500">{sub}</div>
    </div>
  );
}
function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-400">{label}</span>{children}</label>;
}

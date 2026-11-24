"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, GraduationCap, KeyRound, Lock, LogOut, ShieldAlert, Users, UserX } from "lucide-react";
import { api, apiCached } from "../api";
import { logoutUser } from "@/services/auth";
import { Bar, btn } from "@/components/my/ui";
import DeleteAccountModal from "@/components/my/DeleteAccountModal";

type Student = {
  name: string; email: string; studentName?: string | null; studentDob?: string | null; studentGrade?: string | null;
  studentGender?: string | null; studentSchool?: string | null; parentName?: string | null; parentEmail?: string | null; parentContact?: string | null;
};
type Xp = { level: number; title: string; xp: number; progressPct: number; toNext: number; next?: { level: number; title: string } | null };
type Tab = "student" | "parent" | "account" | "privacy";

const TABS: { key: Tab; label: string; sub: string; icon: React.ElementType; color: string }[] = [
  { key: "student", label: "Student Info", sub: "Name, class & school", icon: GraduationCap, color: "#a78bfa" },
  { key: "parent", label: "Parent / Guardian", sub: "Who to contact", icon: Users, color: "#f472b6" },
  { key: "account", label: "Login & Security", sub: "Name, email, password", icon: KeyRound, color: "#38bdf8" },
  { key: "privacy", label: "Account", sub: "Log out or delete", icon: ShieldAlert, color: "#f87171" },
];

const field = "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400 focus:bg-white/[0.07]";

/**
 * Profile — settings layout used by Coursera / Udemy / Khan Academy:
 * a compact profile header, section tabs on the left, one aligned form on the right.
 */
export default function ProfilePage() {
  const router = useRouter();
  const [s, setS] = useState<Student | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [xp, setXp] = useState<Xp | null>(null);
  const [courses, setCourses] = useState(0);
  const [coins, setCoins] = useState(0);
  const [badges, setBadges] = useState(0);
  const [tab, setTab] = useState<Tab>("student");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwd, setPwd] = useState({ cur: "", nw: "", cf: "" });
  const [saving, setSaving] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiCached("/api/student", (d) => setS(d.student)).catch(() => {});
    apiCached("/api/student/avatar", (d) => setAvatar(d.avatarUrl || null)).catch(() => {});
    apiCached("/api/xp", (d) => { if (d?.xp) setXp(d.xp); }).catch(() => {});
    apiCached("/api/student/dashboard", (d) => setCourses((d.enrolledCourses || []).length)).catch(() => {});
    apiCached("/api/coins", (d) => setCoins(d.totalCoins || 0)).catch(() => {});
    apiCached("/api/achievements", (d) => setBadges(d.totalCount ?? (d.achievements || []).length)).catch(() => {});
  }, []);
  useEffect(() => { setMsg(null); setPwdMsg(null); }, [tab]);

  const set = (k: keyof Student, v: string) => setS((p) => (p ? { ...p, [k]: v } : p));

  const save = async () => {
    if (!s) return;
    if (!s.name?.trim()) { setMsg({ ok: false, text: "Display name is required." }); return; }
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
      setMsg({ ok: true, text: "✅ Saved!" });
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
    ["ck_token", "user", "userEmail", "ck_my_user"].forEach((k) => localStorage.removeItem(k));
    router.replace("/login");
  };

  if (!s) return <div className="py-16 text-center text-slate-400">Loading profile…</div>;
  const initial = (s.name || "?").charAt(0).toUpperCase();
  const active = TABS.find((t) => t.key === tab)!;
  const filled = [s.name, s.studentName, s.studentDob, s.studentGrade, s.studentGender, s.studentSchool, s.parentName, s.parentEmail, s.parentContact, avatar];
  const complete = Math.round((filled.filter((v) => !!(v && String(v).trim())).length / filled.length) * 100);

  const saveBar = (
    <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
      <button onClick={save} disabled={saving} className={`${btn} bg-gradient-to-r from-violet-600 to-pink-500 shadow-[0_4px_14px_rgba(168,85,247,0.35)] disabled:opacity-60`}>{saving ? "Saving…" : "Save changes"}</button>
      {msg && <span className={`text-sm font-semibold ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</span>}
    </div>
  );

  return (
    <div className="space-y-5 pt-2">
      {/* Profile header */}
      <section className="relative overflow-hidden rounded-3xl border border-violet-400/20 bg-gradient-to-br from-[#3b1d6e] via-[#241a45] to-[#161626] p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-center gap-5">
            <div className="relative shrink-0">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-fuchsia-500 to-rose-500 text-4xl font-extrabold ring-4 ring-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initial}
              </div>
              <button onClick={() => fileRef.current?.click()} className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#241a45] bg-violet-600 hover:bg-violet-500" title="Change photo"><Camera size={14} /></button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-widest text-violet-300">Hello, Superstar ✨</div>
              <h1 className="flex items-center gap-2 truncate text-2xl font-extrabold md:text-3xl">{s.name} <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[10px]">✓</span></h1>
              <div className="truncate text-sm text-slate-400">{s.email}</div>
            </div>
          </div>

          <div className="flex flex-1 flex-wrap items-stretch gap-3 lg:justify-end">
            <Stat icon="📚" value={courses} label="Courses" tint="139,92,246" href="/my/enrolled" />
            <Stat icon="🪙" value={coins} label="Coins" tint="245,158,11" href="/my/mall" />
            <Stat icon="🏅" value={badges} label="Badges" tint="244,63,94" href="/my/achievements" />
            {xp && (
              <div className="flex min-w-[220px] flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 lg:max-w-xs">
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-[#431407]">
                  <span className="text-[8px] font-extrabold">LEVEL</span><span className="text-xl font-extrabold leading-none">{xp.level}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between text-sm"><b className="truncate">{xp.title}</b><span className="text-xs text-slate-400">{xp.xp} XP</span></div>
                  <div className="mt-1.5"><Bar pct={xp.progressPct} from="from-amber-400" to="to-pink-500" /></div>
                  <div className="mt-1 text-[11px] text-amber-300">{xp.next ? `${xp.toNext} XP to Level ${xp.next.level}` : "Max level 🎉"}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Settings: tabs + one form */}
      {/* Both cards share one height, radius, border and padding so their edges line up. */}
      <div className="grid items-stretch gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="flex flex-col rounded-2xl border border-white/10 bg-[#161626]/75">
          <div className="hidden border-b border-white/10 px-5 py-4 lg:block">
            <h2 className="text-sm font-extrabold">Settings</h2>
            <p className="text-xs text-slate-400">Manage your profile</p>
          </div>
        <nav className="flex gap-2 overflow-x-auto p-3 lg:flex-col lg:overflow-visible">
          {TABS.map((t) => {
            const on = tab === t.key;
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${on ? "bg-white/[0.08] shadow-[inset_3px_0_0_var(--c)]" : "hover:bg-white/[0.05]"}`}
                style={{ ["--c" as string]: t.color }}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `${t.color}22`, color: t.color }}><Icon size={17} /></span>
                <span className="min-w-0">
                  <span className={`block text-sm font-bold ${on ? "text-white" : "text-slate-300"}`}>{t.label}</span>
                  <span className="hidden text-[11px] text-slate-500 lg:block">{t.sub}</span>
                </span>
              </button>
            );
          })}
        </nav>
          {/* Profile completeness (LinkedIn-style) fills the column and nudges kids to finish */}
          <div className="mt-auto hidden border-t border-white/10 p-5 lg:block">
            <div className="mb-2 flex items-center justify-between text-xs"><b>Profile complete</b><span className="font-extrabold text-emerald-300">{complete}%</span></div>
            <Bar pct={complete} from="from-emerald-400" to="to-sky-400" />
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{complete >= 100 ? "🎉 Awesome! Your profile is all set." : "Fill in the missing details to complete your profile ✨"}</p>
          </div>
        </aside>

        <section className="flex flex-col rounded-2xl border border-white/10 bg-[#161626]/75">
          <header className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${active.color}22`, color: active.color }}><active.icon size={19} /></span>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold leading-tight">{active.label}</h2>
              <p className="text-xs text-slate-400">{active.sub}</p>
            </div>
          </header>
          <div className="flex-1 p-6">

          {tab === "student" && (
            <>
              <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
                <L label="Student Name"><input className={field} value={s.studentName || ""} onChange={(e) => set("studentName", e.target.value)} placeholder="Student's full name" /></L>
                <L label="Date of Birth"><input type="date" className={`${field} [color-scheme:dark]`} value={(s.studentDob || "").slice(0, 10)} onChange={(e) => set("studentDob", e.target.value)} /></L>
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
                <div className="md:col-span-2"><L label="School"><input className={field} value={s.studentSchool || ""} onChange={(e) => set("studentSchool", e.target.value)} placeholder="School / Institution name" /></L></div>
              </div>
              {saveBar}
            </>
          )}

          {tab === "parent" && (
            <>
              <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
                <div className="md:col-span-2"><L label="Parent / Guardian Name"><input className={field} value={s.parentName || ""} onChange={(e) => set("parentName", e.target.value)} /></L></div>
                <L label="Parent Email"><input type="email" className={field} value={s.parentEmail || ""} onChange={(e) => set("parentEmail", e.target.value)} placeholder="parent@example.com" /></L>
                <L label="Parent Phone"><input type="tel" className={field} value={s.parentContact || ""} onChange={(e) => set("parentContact", e.target.value)} placeholder="+91 9876543210" /></L>
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-pink-400/20 bg-pink-500/[0.06] px-4 py-3 text-sm">
                <span className="text-xl">👨‍👩‍👧</span>
                <span className="flex-1 text-slate-300">Parents get progress reports and important updates.</span>
                <Link href="/parent-consent" className="whitespace-nowrap font-bold text-pink-300 hover:text-white">Verify parent →</Link>
              </div>
              {saveBar}
            </>
          )}

          {tab === "account" && (
            <div className="space-y-7">
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-300">Account information</h3>
                <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
                  <L label="Display Name" hint="Shown across CodingKida"><input className={field} value={s.name} onChange={(e) => set("name", e.target.value)} /></L>
                  <L label="Email" hint="Contact support to change your email">
                    <div className="relative"><input className={`${field} pr-24 opacity-70`} value={s.email} readOnly /><span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-[11px] text-slate-500"><Lock size={11} /> Read only</span></div>
                  </L>
                </div>
                {saveBar}
              </div>
              <div className="border-t border-white/10 pt-6">
                <h3 className="mb-3 text-sm font-bold text-slate-300">Change password</h3>
                <div className="grid gap-x-5 gap-y-4 md:grid-cols-3">
                  <L label="Current Password"><input type="password" autoComplete="current-password" className={field} value={pwd.cur} onChange={(e) => setPwd({ ...pwd, cur: e.target.value })} /></L>
                  <L label="New Password"><input type="password" autoComplete="new-password" className={field} value={pwd.nw} onChange={(e) => setPwd({ ...pwd, nw: e.target.value })} placeholder="Min 8 characters" /></L>
                  <L label="Confirm New Password"><input type="password" autoComplete="new-password" className={field} value={pwd.cf} onChange={(e) => setPwd({ ...pwd, cf: e.target.value })} /></L>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button onClick={changePwd} className={`${btn} border border-sky-400/40 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20`}><KeyRound size={15} /> Update password</button>
                  {pwdMsg && <span className={`text-sm font-semibold ${pwdMsg.ok ? "text-emerald-400" : "text-red-400"}`}>{pwdMsg.text}</span>}
                </div>
              </div>
            </div>
          )}

          {tab === "privacy" && (
            <div className="space-y-4">
              <Row icon={<LogOut size={18} />} tint="#a78bfa" title="Log out" text="Sign out of CodingKida on this browser. Your progress is saved."
                action={<button onClick={logout} className={`${btn} border border-white/15 hover:bg-white/5`}><LogOut size={15} /> Log out</button>} />
              <Row icon={<UserX size={18} />} tint="#f87171" title="Delete account" text="Permanently delete your account and all your progress. This cannot be undone."
                action={<button onClick={() => setDelOpen(true)} className={`${btn} border border-red-400/40 text-red-400 hover:bg-red-500/10`}><UserX size={15} /> Delete account</button>} danger />
            </div>
          )}
          </div>
        </section>
      </div>

      {delOpen && <DeleteAccountModal onClose={() => setDelOpen(false)} />}
    </div>
  );
}

function Stat({ icon, value, label, tint, href }: { icon: string; value: React.ReactNode; label: string; tint: string; href: string }) {
  return (
    <Link href={href} className="flex min-w-[96px] flex-col items-center justify-center rounded-2xl border px-4 py-3 text-center transition hover:-translate-y-0.5" style={{ borderColor: `rgba(${tint},0.35)`, background: `rgba(${tint},0.12)` }}>
      <span className="text-xl leading-none">{icon}</span>
      <span className="mt-1 text-xl font-extrabold">{value}</span>
      <span className="text-[11px] font-semibold text-slate-300">{label}</span>
    </Link>
  );
}
function L({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}
function Row({ icon, tint, title, text, action, danger }: { icon: React.ReactNode; tint: string; title: string; text: string; action: React.ReactNode; danger?: boolean }) {
  return (
    <div className={`flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center ${danger ? "border-red-400/25 bg-red-500/[0.04]" : "border-white/10 bg-white/[0.02]"}`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: `${tint}22`, color: tint }}>{icon}</span>
      <div className="min-w-0 flex-1"><div className="font-bold">{title}</div><div className="text-sm text-slate-400">{text}</div></div>
      {action}
    </div>
  );
}

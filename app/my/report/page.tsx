"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useMy } from "../MyContext";
import { Bar, Kpi, Loading, PageHeader, Panel, btn, fmtDate } from "@/components/my/ui";

type Course = { id: string; title: string; progressPercent: number; completedLessons: number; totalLessons: number };
type Ach = { id: string; title: string; badgeType: string; courseTitle?: string; lessonTitle?: string; earnedAt: string };
type Tx = { id: string; type: string; coins: number; reason?: string; createdAt: string; courseTitle?: string; lessonTitle?: string };
type Day = { date: string; minutes: number; sessions: number };

const fmtMins = (m: number) => (!m || m <= 0 ? "—" : m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`);
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** "My Report" — same data and sections as the desktop app (dashboard + coins + achievements + learning-time calendar). */
export default function ReportPage() {
  const { user } = useMy();
  const [dash, setDash] = useState<{ enrolledCount: number; enrolledCourses: Course[] } | null>(null);
  const [coins, setCoins] = useState<{ totalCoins: number; transactions: Tx[] }>({ totalCoins: 0, transactions: [] });
  const [ach, setAch] = useState<Ach[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [streak, setStreak] = useState(0);
  const [share, setShare] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    api("/api/student/dashboard").then(async (d) => {
      setDash(d);
      // Weekly streak = passed weekly challenges across enrolled courses.
      const counts = await Promise.all((d.enrolledCourses || []).map((c: Course) =>
        api(`/api/weekly-streak?courseId=${encodeURIComponent(c.id)}`).then((r) => r.completedCount || 0).catch(() => 0)));
      setStreak(counts.reduce((a: number, b: number) => a + b, 0));
    }).catch(() => setDash({ enrolledCount: 0, enrolledCourses: [] }));
    api("/api/coins").then((d) => setCoins({ totalCoins: d.totalCoins || 0, transactions: d.transactions || [] })).catch(() => {});
    api("/api/achievements").then((d) => setAch(d.achievements || [])).catch(() => {});
    api("/api/attendance").then((d) => setDays(d.days || [])).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const today = new Date();
  const todayMins = byDate.get(dayKey(today))?.minutes || 0;
  const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7)); monday.setHours(0, 0, 0, 0);
  let weekMins = 0, weekActive = 0, activeDays30 = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const r = byDate.get(dayKey(d));
    if (r && r.minutes > 0) { activeDays30++; if (d >= monday) { weekMins += r.minutes; weekActive++; } }
  }

  if (!dash) return <div className="mx-auto max-w-6xl pt-2"><PageHeader icon="📊" title="My Report" sub="Your learning journey at a glance 🚀" /><Loading text="Loading your report..." /></div>;

  const courses = dash.enrolledCourses || [];
  const totalCompleted = courses.reduce((s, c) => s + (c.completedLessons || 0), 0);
  const sm = ach.filter((a) => a.badgeType === "super-master").length;
  const ms = ach.filter((a) => a.badgeType === "master").length;
  const pro = ach.length - sm - ms;
  const name = user?.name || "Student";

  const reportText = () => {
    const date = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    const lines = courses.map((c) => `  • ${c.title} — ${c.progressPercent || 0}% (${c.completedLessons || 0} lessons done)`).join("\n") || "  No courses yet";
    const badges = [sm ? `  🏆 Super Master x${sm}` : "", ms ? `  🥈 Master x${ms}` : "", pro ? `  ⭐ Pro x${pro}` : ""].filter(Boolean).join("\n") || "  None yet";
    return `📊 CodingKida Learning Report\nStudent: ${name}\nDate: ${date}\n\n⏱ Attendance\n  Today: ${fmtMins(todayMins)}\n  This Week: ${fmtMins(weekMins)}\n  Active Days (30d): ${activeDays30}/30\n\n📚 Courses Enrolled: ${dash.enrolledCount || courses.length}\n✅ Lessons Completed: ${totalCompleted}\n🔥 Weekly Streak: ${streak}\n🪙 Coins Earned: ${coins.totalCoins}\n\n📈 Course Progress:\n${lines}\n\n🏆 Achievements:\n${badges}\n\nPowered by CodingKida — codingkida.com`;
  };

  // Calendar: last 3 months
  const months = [2, 1, 0].map((back) => new Date(today.getFullYear(), today.getMonth() - back, 1));

  return (
    <div className="mx-auto max-w-6xl space-y-5 pt-2">
      <PageHeader icon="📊" title={<><span>My </span><span className="bg-gradient-to-r from-violet-400 to-pink-500 bg-clip-text text-transparent">Report</span></>} sub="Your learning journey at a glance 🚀"
        right={<>
          <a href={`https://wa.me/?text=${encodeURIComponent(reportText())}`} target="_blank" rel="noopener noreferrer" className={`${btn} border border-emerald-400/30 bg-emerald-400/5 text-emerald-400`}>💬 WhatsApp</a>
          <button onClick={() => { setShare(reportText()); setCopied(false); }} className={`${btn} border border-sky-400/30 bg-sky-400/5 text-sky-300`}>📋 Copy & Share</button>
          <button onClick={load} className={`${btn} border border-violet-400/25 bg-violet-500/5 text-violet-300`}>🔄 Refresh</button>
        </>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon="📖" color="#8B5CF6" label="Courses Enrolled" value={dash.enrolledCount || courses.length} sub="total" />
        <Kpi icon="✅" color="#22C55E" label="Lessons Completed" value={totalCompleted} sub="all time" />
        <Kpi icon="⏰" color="#F59E0B" label="Today" value={fmtMins(todayMins)} sub={todayMins > 0 ? "learning time" : "no activity yet"} />
        <Kpi icon="📅" color="#EC4899" label="This Week" value={fmtMins(weekMins)} sub={`${weekActive} active days / 7`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <Panel title="Your Coding Journey" icon="🚀" sub="Every line of code makes you stronger 💜">
          <div className="grid gap-4 sm:grid-cols-3">
            {months.map((m) => <Month key={m.toISOString()} first={m} byDate={byDate} />)}
          </div>
          <div className="mt-4 rounded-xl bg-violet-500/10 p-3 text-center text-sm text-violet-200">
            {activeDays30 >= 20 ? "🌟 Amazing! You learn almost every day." : activeDays30 >= 8 ? "💪 Great rhythm — keep the streak going!" : "🌱 A little coding every day builds big skills."}
          </div>
        </Panel>
        <Panel title="Quick Stats" icon="⚡">
          <div className="space-y-2.5">
            <Row icon="🔥" label="Weekly Streak" value={streak} />
            <Row icon="🪙" label="Coins Earned" value={coins.totalCoins} />
            <Row icon="🏆" label="Achievements" value={ach.length} />
            <Row icon="📆" label="Active Days (30d)" value={`${activeDays30}/30`} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Course Progress" icon="📖">
          {courses.length === 0 ? <div className="text-sm text-slate-400">No courses enrolled yet.</div> : (
            <div className="space-y-3">{courses.map((c) => (
              <div key={c.id}><div className="mb-1 flex justify-between text-sm"><b className="truncate">{c.title}</b><span className="text-violet-300">{c.progressPercent}%</span></div><Bar pct={c.progressPercent} /><div className="mt-1 text-[11px] text-slate-500">{c.completedLessons}/{c.totalLessons} lessons</div></div>
            ))}</div>
          )}
        </Panel>
        <Panel title="Recent Achievements" icon="⭐">
          {ach.length === 0 ? <div className="text-sm text-slate-400">No achievements yet.</div> : (
            <div className="space-y-2">{ach.slice(0, 5).map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5">
                <span className="text-xl">{a.badgeType === "super-master" ? "🏆" : a.badgeType === "master" ? "🥈" : "⭐"}</span>
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{a.title}</div><div className="truncate text-xs text-slate-500">{[a.courseTitle, a.lessonTitle].filter(Boolean).join(" › ")}</div></div>
                <span className="text-[11px] text-slate-500">{a.earnedAt ? fmtDate(a.earnedAt) : ""}</span>
              </div>
            ))}</div>
          )}
        </Panel>
      </div>

      <Panel title="Achievements & Badges" icon="🏆">
        <div className="grid grid-cols-3 gap-3">
          <Badge icon="🏆" label="Super Master" n={sm} color="#fbbf24" />
          <Badge icon="🥈" label="Master" n={ms} color="#a78bfa" />
          <Badge icon="⭐" label="Pro / Star" n={pro} color="#22c55e" />
        </div>
      </Panel>

      <Panel title="My Coins" icon="🪙" right={<span className="text-xl font-extrabold text-amber-300">🪙 {coins.totalCoins}</span>}>
        {coins.transactions.length === 0 ? <div className="text-sm text-slate-400">No coins yet.</div> : (
          <div className="space-y-2">{coins.transactions.slice(0, 10).map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-2.5 text-sm">
              <div className="min-w-0"><div className="truncate font-semibold">{t.reason || t.type}</div><div className="truncate text-xs text-slate-500">{[t.courseTitle, t.lessonTitle].filter(Boolean).join(" › ")} {fmtDate(t.createdAt)}</div></div>
              <b className={t.type === "SPENT" ? "text-red-400" : "text-emerald-400"}>{t.type === "SPENT" ? "-" : "+"}{t.coins}</b>
            </div>
          ))}</div>
        )}
      </Panel>

      {share && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={() => setShare(null)}>
          <div className="w-full max-w-lg rounded-2xl border border-violet-400/30 bg-[#1a1a2e] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between"><b>📊 Share Learning Report</b><button onClick={() => setShare(null)} className="text-white/50">✕</button></div>
            <p className="mb-3 text-sm text-slate-400">Copy the report below and paste it in WhatsApp, Gmail, or any app.</p>
            <textarea readOnly value={share} className="h-56 w-full resize-none rounded-xl border border-white/10 bg-white/5 p-3 font-mono text-xs" />
            <button onClick={() => navigator.clipboard?.writeText(share).then(() => setCopied(true))} className="mt-3 w-full rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 py-3 font-bold">{copied ? "✅ Copied!" : "📋 Copy Report"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Month({ first, byDate }: { first: Date; byDate: Map<string, Day> }) {
  const y = first.getFullYear(), m = first.getMonth();
  const daysIn = new Date(y, m + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday first
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  const today = dayKey(new Date());
  return (
    <div>
      <div className="mb-2 text-center text-xs font-bold text-slate-300">{first.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-500">{["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i}>{d}</div>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const k = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const mins = byDate.get(k)?.minutes || 0;
          const bg = mins === 0 ? "rgba(255,255,255,0.05)" : mins < 15 ? "rgba(34,197,94,0.35)" : mins < 45 ? "rgba(34,197,94,0.6)" : "rgba(34,197,94,0.9)";
          return <div key={i} title={mins ? `${k}: ${mins} min` : k} className={`flex aspect-square items-center justify-center rounded text-[10px] ${k === today ? "ring-1 ring-violet-400" : ""}`} style={{ background: bg }}>{d}</div>;
        })}
      </div>
    </div>
  );
}
function Row({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
  return <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5 text-sm"><span>{icon} {label}</span><b>{value}</b></div>;
}
function Badge({ icon, label, n, color }: { icon: string; label: string; n: number; color: string }) {
  return <div className="rounded-xl border p-4 text-center" style={{ borderColor: `${color}40`, background: `${color}10` }}><div className="text-3xl">{icon}</div><div className="text-2xl font-extrabold" style={{ color }}>{n}</div><div className="text-xs text-slate-400">{label}</div></div>;
}

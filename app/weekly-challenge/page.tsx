import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import KidsPage, { PageHeader } from "@/components/site/KidsPage";
import { getPublicWeekly } from "@/app/services/weekly-public.service";

export const metadata: Metadata = {
  title: "Weekly coding challenge for kids | CodingKida",
  description: "A new coding problem every Monday. Solve it first to become Weekly Champion and win coins and XP.",
  alternates: { canonical: "/weekly-challenge" },
};

const LANG: Record<string, string> = { python: "Python 🐍", java: "Java ☕", c: "C 🔧", cpp: "C++ ⚙️" };
const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

async function Weekly() {
  await connection();
  const w = await getPublicWeekly();
  const ex = w.exercise;
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <section className="px-5 py-12">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <p className="text-sm font-black uppercase tracking-wider text-[#C2410C]">📅 {fmt(w.week.start)} – {fmt(w.week.end)}</p>
          {!ex ? (
            <div className="mt-4 rounded-[28px] bg-white border-2 border-dashed border-[#FDBA74] p-10 text-center">
              <div className="text-6xl">⏳</div>
              <h2 className="mt-3 text-2xl font-black">This week&apos;s challenge is being prepared</h2>
              <p className="text-[#6B7280]">Check back soon!</p>
            </div>
          ) : (
            <article className="mt-3 rounded-[28px] bg-white border-2 border-[#FED7AA] border-b-8 p-6 md:p-8">
              <div className="flex flex-wrap gap-2 text-sm font-black">
                {ex.language && <span className="rounded-full bg-[#FFEDD5] px-3 py-1 text-[#C2410C]">{LANG[ex.language] ?? ex.language}</span>}
                {ex.difficulty && <span className="rounded-full bg-[#F3F4F6] px-3 py-1 capitalize text-[#374151]">{ex.difficulty}</span>}
                {ex.courseTitle && <span className="rounded-full bg-[#EDE9FE] px-3 py-1 text-[#6D28D9]">From: {ex.courseTitle}</span>}
              </div>
              <h2 className="mt-4 text-3xl md:text-4xl font-black">{ex.title}</h2>
              <p className="mt-4 text-lg leading-relaxed text-[#374151] whitespace-pre-line">{ex.description}</p>

              {(ex.inputFormat || ex.outputFormat || ex.constraints) && (
                <dl className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {ex.inputFormat && <Box label="Input">{ex.inputFormat}</Box>}
                  {ex.outputFormat && <Box label="Output">{ex.outputFormat}</Box>}
                  {ex.constraints && <Box label="Rules">{ex.constraints}</Box>}
                </dl>
              )}

              {ex.samples.length > 0 && (
                <div className="mt-6 space-y-3">
                  <h3 className="text-xl font-black">Examples</h3>
                  {ex.samples.map((s, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <pre className="rounded-2xl bg-[#1E1B4B] p-4 font-mono text-sm text-white whitespace-pre-wrap"><span className="block font-sans text-xs font-black text-white/50 mb-1">INPUT</span>{s.input || "(none)"}</pre>
                      <pre className="rounded-2xl bg-[#0F0D2E] p-4 font-mono text-sm text-[#86EFAC] whitespace-pre-wrap"><span className="block font-sans text-xs font-black text-white/50 mb-1">OUTPUT</span>{s.expectedOutput}</pre>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link href="/download" className="rounded-2xl bg-[#F97316] px-6 py-4 text-center font-black text-white border-b-[6px] border-[#C2410C] hover:brightness-110">
                  🏁 Solve it in the app
                </Link>
                <Link href="/playground" className="rounded-2xl bg-white px-6 py-4 text-center font-black text-[#C2410C] border-2 border-[#FED7AA] hover:bg-[#FFF7ED]">
                  🧪 Practise in the playground
                </Link>
              </div>
              <p className="mt-3 text-sm text-[#6B7280]">Your answer counts when every test passes in the CodingKida app.</p>
            </article>
          )}
        </div>

        <aside className="space-y-6">
          <div className="rounded-[28px] bg-[#FFF7E6] border-2 border-[#FDE68A] p-6">
            <h3 className="text-xl font-black">Prizes 🎁</h3>
            <ul className="mt-4 space-y-3">
              {w.rewards.map((r) => (
                <li key={r.label} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3">
                  <span className="text-3xl">{r.icon}</span>
                  <span className="flex-1"><b className="block">{r.label}</b><span className="text-sm text-[#6B7280]">{r.who}</span></span>
                  <span className="font-black text-[#B45309]">🪙 {r.coins}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm font-bold text-[#6B7280]">Every solver also gets +50 XP ⭐</p>
          </div>

          <div className="rounded-[28px] bg-white border-2 border-[#EDE9FE] p-6">
            <h3 className="text-xl font-black">This week&apos;s solvers 🏆</h3>
            <p className="text-sm text-[#6B7280]">{w.totalSolvers} solved so far</p>
            {w.leaderboard.length === 0 ? (
              <p className="mt-4 rounded-2xl bg-[#FAFAFF] p-4 text-center font-bold">Nobody yet. Be the first! 🚀</p>
            ) : (
              <ol className="mt-4 space-y-2">
                {w.leaderboard.map((r) => (
                  <li key={r.rank} className={`flex items-center gap-3 rounded-2xl px-4 py-2 ${r.rank <= 3 ? "bg-[#FFF7E6]" : "bg-[#FAFAFF]"}`}>
                    <span className="w-8 text-center text-lg font-black">{medals[r.rank - 1] ?? r.rank}</span>
                    <span className="flex-1 font-bold">{r.name}</span>
                    <span className="text-xs font-bold text-[#6B7280]">{r.weeksSolved} week{r.weeksSolved === 1 ? "" : "s"}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function Box({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-[#FFF7ED] p-4">
      <dt className="text-xs font-black uppercase text-[#C2410C]">{label}</dt>
      <dd className="mt-1 text-sm text-[#374151] whitespace-pre-line">{children}</dd>
    </div>
  );
}

export default function WeeklyChallengePage() {
  return (
    <KidsPage>
      <PageHeader
        badge="🔥 New every Monday"
        title={<>Weekly coding <span className="text-[#F97316]">challenge</span></>}
        text="One problem for everyone. The first to solve it becomes Weekly Champion!"
        tint="from-[#FFEDD5] via-[#FFFBF5] to-[#FEF3C7]"
      />
      <Suspense fallback={<div className="max-w-6xl mx-auto px-5 py-12"><div className="h-96 rounded-[28px] bg-[#FFF7ED] animate-pulse" /></div>}>
        <Weekly />
      </Suspense>
    </KidsPage>
  );
}

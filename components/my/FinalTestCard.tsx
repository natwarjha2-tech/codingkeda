"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/app/my/api";
import CertificateViewer from "./CertificateViewer";

type Status = {
  available: boolean; unlocked: boolean; inProgress?: boolean; passed?: boolean; courseTitle: string;
  totalQuestions: number; timeLimitMin: number; passPercent: number; bestPercent: number | null;
  completedLessons: number; totalLessons: number; nextAttemptAt?: string | null;
  certificate?: { code: string; percent: number } | null;
  pendingCertificate?: { attemptId: string; suggestedName?: string } | null;
};

/** "FINAL TEST — Course Certificate Test" card on the course page (desktop final-test.js). */
export default function FinalTestCard({ courseId }: { courseId: string }) {
  const [s, setS] = useState<Status | null>(null);
  const [view, setView] = useState(false);
  useEffect(() => { api(`/api/final-test?courseId=${encodeURIComponent(courseId)}`).then(setS).catch(() => setS(null)); }, [courseId]);
  if (!s || !s.available) return null;

  const href = `/my/final-test/${courseId}`;
  const meta = `${s.totalQuestions} MCQs · ${s.timeLimitMin} min · pass ${s.passPercent}%${s.bestPercent !== null ? ` · best ${s.bestPercent}%` : ""}`;
  let action: React.ReactNode;
  if (s.certificate) {
    action = <div className="flex flex-wrap gap-2"><button onClick={() => setView(true)} className="rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-5 py-2.5 text-sm font-bold">📜 View Certificate</button><Link href={href} className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-bold">Practice</Link></div>;
  } else if (s.pendingCertificate) {
    action = <Link href={`${href}?claim=1`} className="inline-block rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-2.5 text-sm font-extrabold text-[#431407]">🎉 Passed — Get Certificate</Link>;
  } else if (!s.unlocked) {
    action = <div className="text-sm text-slate-400">🔒 Complete all lessons to unlock ({s.completedLessons}/{s.totalLessons} done)</div>;
  } else if (s.nextAttemptAt && !s.inProgress) {
    action = <div className="text-sm text-amber-300">⏳ Retake available after {new Date(s.nextAttemptAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</div>;
  } else {
    action = <Link href={href} className="inline-block rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-5 py-2.5 text-sm font-bold">{s.inProgress ? "▶ Resume Test" : "▶ Start Final Test"}</Link>;
  }

  return (
    <section className="rounded-2xl border border-violet-400/25 bg-gradient-to-br from-violet-500/15 to-pink-500/5 p-5">
      <div className="mb-2 flex items-center gap-3">
        <span className="text-3xl">🎓</span>
        <div className="flex-1"><div className="text-[11px] font-bold tracking-wider text-violet-300">FINAL TEST</div><div className="font-extrabold">Course Certificate Test</div></div>
        {s.certificate ? <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300">Passed</span> : !s.unlocked ? <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold">🔒 Locked</span> : null}
      </div>
      <div className="mb-3 text-sm text-slate-400">{meta}</div>
      {action}
      {view && s.certificate && <CertificateViewer code={s.certificate.code} courseTitle={s.courseTitle} percent={s.certificate.percent} onClose={() => setView(false)} />}
    </section>
  );
}

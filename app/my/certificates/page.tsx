"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../api";
import { EmptyState, Loading, PageHeader, fmtDate } from "@/components/my/ui";
import CertificateViewer from "@/components/my/CertificateViewer";

type Cert = { code: string; courseId?: string; courseTitle: string; studentName?: string; percent: number; issuedAt: string };

export default function CertificatesPage() {
  const [list, setList] = useState<Cert[] | null>(null);
  const [open, setOpen] = useState<Cert | null>(null);
  useEffect(() => { api("/api/certificates").then((d) => setList(d.certificates || [])).catch(() => setList([])); }, []);

  return (
    <div className="mx-auto max-w-4xl pt-2">
      <PageHeader icon="📜" title="My Certificates" sub="Pass a course's final test to earn its certificate." />
      {!list ? <Loading /> : list.length === 0 ? (
        <EmptyState icon="📜" title="No certificates yet" text="Finish all lessons of a course, then pass its Final Test to get your certificate."
          action={<Link href="/my/courses" className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold">Go to my courses</Link>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((c) => (
            <div key={c.code} className="rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-400/10 to-violet-500/5 p-5">
              <div className="text-3xl">🎓</div>
              <div className="mt-1 font-extrabold">{c.courseTitle}</div>
              <div className="text-sm text-slate-400">{c.studentName ? `${c.studentName} · ` : ""}Score {c.percent}% · {c.issuedAt ? fmtDate(c.issuedAt) : ""}</div>
              <div className="mt-1 font-mono text-xs text-slate-500">ID: {c.code}</div>
              <button onClick={() => setOpen(c)} className="mt-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-4 py-2 text-sm font-bold">📜 View Certificate</button>
            </div>
          ))}
        </div>
      )}
      {open && <CertificateViewer code={open.code} courseTitle={open.courseTitle} percent={open.percent} onClose={() => setOpen(null)} />}
    </div>
  );
}

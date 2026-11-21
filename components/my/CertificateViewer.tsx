"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api } from "@/app/my/api";

/** Shows a certificate PDF (generated on demand, owner only) with Save PDF + WhatsApp, like the desktop app. */
export default function CertificateViewer({ code, courseTitle, percent, onClose }: { code: string; courseTitle?: string; percent?: number; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [name, setName] = useState("certificate.pdf");
  const [err, setErr] = useState("");

  useEffect(() => {
    let objectUrl: string | null = null;
    api(`/api/certificates/${encodeURIComponent(code)}?format=base64`)
      .then((d) => {
        const raw = atob(d.base64);
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
        setUrl(objectUrl);
        const t = String(courseTitle || "").replace(/[\\/:*?"<>|]+/g, " ").trim();
        setName(`CodingKida Certificate - ${t || code}.pdf`);
      })
      .catch((e) => setErr(e.message || "Could not load the certificate."));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [code, courseTitle]);

  const wa = `https://wa.me/?text=${encodeURIComponent(`🎓 I just completed ${courseTitle ? `the ${courseTitle} course` : "a course"} on CodingKida${typeof percent === "number" ? ` with ${percent}%` : ""}!\nCertificate ID: ${code}\nLearn coding with me: https://www.codingkida.com`)}`;

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black/90 p-3 md:p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 rounded-t-xl bg-[#16213e] px-4 py-3">
        <b className="text-sm">📜 Certificate {code}</b>
        <div className="flex flex-wrap gap-2">
          {url && <a href={url} download={name} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold hover:bg-white/5">💾 Save PDF</a>}
          <a href={wa} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-[#052e16]">💬 WhatsApp</a>
          <a href="/verify" target="_blank" title={`Anyone can check certificate ${code} here`} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold hover:bg-white/5">✔ Verify page</a>
          <button onClick={onClose} className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-300"><X size={12} className="inline" /> Close</button>
        </div>
      </div>
      <div className="mx-auto w-full max-w-5xl flex-1 overflow-hidden rounded-b-xl bg-[#0f0f1a]">
        {err ? <div className="p-10 text-center text-amber-300">{err}</div>
          : url ? <iframe src={`${url}#toolbar=0&navpanes=0`} title="Certificate" className="h-full w-full" />
          : <div className="p-10 text-center text-slate-400">Loading certificate…</div>}
      </div>
    </div>
  );
}

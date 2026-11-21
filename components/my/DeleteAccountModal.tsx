"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { api } from "@/app/my/api";
import { logoutUser } from "@/services/auth";

/** Same 2-step flow as the desktop app: type DELETE → email code → scheduled deletion (30 days). */
export default function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const f = "mt-1 w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-white outline-none";

  const send = async () => {
    setBusy(true); setMsg("");
    try { const d = await api("/api/account/delete/send-code", { method: "POST", json: {} }); setSentTo(d.sentTo || "your email"); setStep(2); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  };
  const del = async () => {
    if (!window.confirm("Delete your CodingKida account? You will be signed out of all devices. It is deleted permanently after 30 days unless you sign in again.")) return;
    setBusy(true); setMsg("");
    try {
      const d = await api("/api/account/delete", { method: "POST", json: { code: code.trim(), reason, channel: "web" } });
      const when = d.scheduledFor ? new Date(d.scheduledFor).toLocaleDateString("en-IN", { dateStyle: "long" }) : "in 30 days";
      window.alert(`Your account will be deleted on ${when}. Sign in again before then to keep it.`);
      logoutUser();
      Object.keys(localStorage).forEach((k) => { if (k.startsWith("ck_") || k === "user" || k === "userEmail") localStorage.removeItem(k); });
      window.location.href = "/login";
    } catch (e) { setMsg(e instanceof Error ? e.message : "Something went wrong."); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-red-400/35 bg-[#141428] p-6 text-sm text-slate-200" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><b className="text-lg text-white">Delete your account</b><button onClick={onClose} className="rounded-full bg-white/10 p-1"><X size={14} /></button></div>
        <ul className="mb-3 ml-5 list-disc space-y-1 text-slate-300">
          <li>You are signed out of all devices straight away.</li>
          <li>Your account is permanently deleted after 30 days. Sign in again before then to restore it.</li>
          <li>We delete your profile, email, phone, parent details, photo, notifications, chat messages and saved code.</li>
          <li>Progress, coins, badges, certificates and purchased courses can&apos;t be recovered. Purchases are not refunded.</li>
          <li>Payment records are kept only where the law requires, without your name or email.</li>
        </ul>
        {step === 1 ? (
          <>
            <label className="block text-slate-400">Why are you leaving? (optional)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} className={f} />
            <label className="mt-3 block text-slate-400">Type <b>DELETE</b> to continue</label>
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className={f} />
            <button onClick={send} disabled={busy || confirm.trim().toUpperCase() !== "DELETE"} className="mt-4 w-full rounded-lg bg-red-600 py-2.5 font-bold disabled:opacity-50">Send confirmation code to my email</button>
          </>
        ) : (
          <>
            <div className="text-slate-400">We sent a 6-digit code to {sentTo}.</div>
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6-digit code" className={`${f} text-center text-xl font-extrabold tracking-[8px]`} />
            <button onClick={del} disabled={busy || code.length !== 6} className="mt-4 w-full rounded-lg bg-red-600 py-2.5 font-bold disabled:opacity-50">Delete my account</button>
            <button onClick={send} disabled={busy} className="mt-2 w-full rounded-lg border border-white/15 py-2.5">Send a new code</button>
          </>
        )}
        {msg && <div className="mt-3 text-red-400">{msg}</div>}
        <button onClick={onClose} className="mt-3 w-full rounded-lg border border-white/15 py-2.5">Cancel</button>
      </div>
    </div>
  );
}

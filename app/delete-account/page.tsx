"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";

/**
 * Public "Delete your account" page (also the web link required by Google Play
 * and Apple: people can delete their account without reinstalling the app).
 */
export default function DeleteAccountPage() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<{ pending: boolean; scheduledFor: string | null } | null>(null);
  const [step, setStep] = useState<"intro" | "code" | "done">("intro");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("token") || localStorage.getItem("ck_token");
    setToken(t);
    setReady(true);
    if (t) {
      fetch("/api/account/delete", { headers: { Authorization: `Bearer ${t}` } })
        .then((r) => r.json())
        .then((d) => { if (d.success) setStatus({ pending: d.pending, scheduledFor: d.scheduledFor }); })
        .catch(() => {});
    }
  }, []);

  const call = async (path: string, body: object) => {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.message || "Something went wrong.");
    return data;
  };

  const sendCode = async () => {
    setBusy(true); setError("");
    try {
      const d = await call("/api/account/delete/send-code", {});
      setSentTo(d.sentTo || "your email");
      setStep("code");
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };

  const confirmDelete = async () => {
    setBusy(true); setError("");
    try {
      const d = await call("/api/account/delete", { code: code.trim(), reason, channel: "web" });
      setScheduledFor(d.scheduledFor);
      ["token", "ck_token", "user", "userEmail"].forEach((k) => localStorage.removeItem(k));
      setStep("done");
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };

  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { dateStyle: "long" });

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white pt-24 pb-16 px-4">
        <div className="max-w-xl mx-auto">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Delete your CodingKida account</h1>
          <p className="text-slate-600 text-sm mb-6">
            You can delete your account at any time. This is what happens:
          </p>
          <ul className="text-sm text-slate-700 space-y-2 mb-6 list-disc pl-5">
            <li>You are signed out of all your devices straight away.</li>
            <li>Your account is permanently deleted after <b>30 days</b>. If you change your mind, just sign in again before then and your account is restored.</li>
            <li>We delete your profile, name, email, phone, parent details, photo, devices, notifications, chat messages and saved code.</li>
            <li>Your progress, coins, badges, certificates and <b>purchased courses can&apos;t be recovered</b> after deletion. Purchases are not refunded.</li>
            <li>Payment records are kept only where Indian tax law requires it, without your name or email.</li>
          </ul>

          {!ready ? null : !token ? (
            <div className="rounded-2xl border border-slate-200 p-5">
              <p className="text-sm text-slate-700 mb-4">Please sign in first so we know the account is yours.</p>
              <Link href="/login?redirect=%2Fdelete-account" className="inline-block px-5 py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold">
                Sign in to delete your account
              </Link>
              <p className="text-xs text-slate-500 mt-4">
                You can also delete your account in the CodingKida app: Profile → Delete account.
              </p>
            </div>
          ) : status?.pending && step !== "done" ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
              Your account is already scheduled for deletion{status.scheduledFor ? ` on ${fmt(status.scheduledFor)}` : ""}.
              Sign in again before then to keep it.
            </div>
          ) : step === "intro" ? (
            <div className="rounded-2xl border border-red-200 p-5 space-y-4">
              <label className="block text-sm text-slate-700">
                Why are you leaving? (optional)
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-purple-500" />
              </label>
              <label className="block text-sm text-slate-700">
                Type <b>DELETE</b> to continue
                <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-purple-500" />
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button onClick={sendCode} disabled={busy || confirmText.trim().toUpperCase() !== "DELETE"}
                className="w-full py-3 rounded-xl bg-red-600 disabled:opacity-50 text-white text-sm font-semibold">
                {busy ? "Sending code…" : "Send confirmation code to my email"}
              </button>
            </div>
          ) : step === "code" ? (
            <div className="rounded-2xl border border-red-200 p-5 space-y-4">
              <p className="text-sm text-slate-700">We sent a 6-digit code to <b>{sentTo}</b>. Enter it to delete your account.</p>
              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6-digit code"
                className="w-full rounded-xl border border-slate-200 p-3 text-center text-lg tracking-[8px] font-bold outline-none focus:border-purple-500" />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button onClick={confirmDelete} disabled={busy || code.length !== 6}
                className="w-full py-3 rounded-xl bg-red-600 disabled:opacity-50 text-white text-sm font-semibold">
                {busy ? "Deleting…" : "Delete my account"}
              </button>
              <button onClick={sendCode} disabled={busy} className="w-full text-xs text-slate-500">Send a new code</button>
            </div>
          ) : (
            <div className="rounded-2xl border border-green-300 bg-green-50 p-5 text-sm text-green-900">
              Your account will be deleted on <b>{scheduledFor ? fmt(scheduledFor) : "in 30 days"}</b>. You have been signed out.
              Sign in again before then if you want to keep it. We have also sent you an email.
            </div>
          )}
        </div>
      </main>
    </>
  );
}

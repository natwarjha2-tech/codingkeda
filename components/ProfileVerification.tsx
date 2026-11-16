"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Profile verification status from GET /api/student/consent.
 *  - variant "banner": dashboard reminder; shown until the profile is verified
 *    (no close button — it goes away only when the steps are done).
 *  - variant "card": profile page; always shows Verified / Unverified, what is
 *    missing, and a "Verify profile" button.
 */
interface Status {
  profile?: { verified: boolean; missing: string[] };
  blocked?: boolean;
  daysLeft?: number | null;
  required?: boolean;
  enabled?: boolean;
}

export default function ProfileVerification({ variant }: { variant: "banner" | "card" }) {
  const [s, setS] = useState<Status | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("ck_token");
    if (!token) return;
    fetch("/api/student/consent", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.consent) setS(d.consent); })
      .catch(() => {});
  }, []);

  if (!s?.profile) return null;
  const { verified, missing } = s.profile;

  if (variant === "banner") {
    if (verified) return null;
    const when = s.blocked
      ? "Your learning is on hold until this is done."
      : s.enabled && s.required && s.daysLeft != null
        ? s.daysLeft <= 1 ? "Today is the last day." : `${s.daysLeft} days left.`
        : "";
    return (
      <div className={`mb-6 rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 ${
        s.blocked ? "border-red-500/40 bg-red-500/10" : "border-amber-500/40 bg-amber-500/10"}`}>
        <div className="flex-1">
          <p className="text-white font-semibold text-sm">⚠️ Your profile is not verified</p>
          <p className="text-slate-300 text-xs mt-0.5">
            {missing.length ? `Still needed: ${missing.join(", ")}.` : ""} {when}
          </p>
        </div>
        <Link href="/parent-consent" className="shrink-0 text-center px-4 py-2 rounded-xl text-sm font-bold text-white bg-purple-600 hover:bg-purple-700">
          Verify profile
        </Link>
      </div>
    );
  }

  return (
    <div className={`mb-8 rounded-2xl border p-4 ${verified ? "border-green-500/30 bg-green-500/10" : "border-amber-500/40 bg-amber-500/10"}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400">Profile status</p>
          <p className={`font-bold ${verified ? "text-green-400" : "text-amber-300"}`}>
            {verified ? "✅ Verified" : "⚠️ Unverified"}
          </p>
        </div>
        {!verified && (
          <Link href="/parent-consent" className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-purple-600 hover:bg-purple-700">
            Verify profile
          </Link>
        )}
      </div>
      {!verified && missing.length > 0 && (
        <ul className="mt-3 text-xs text-slate-300 list-disc pl-5 space-y-0.5">
          {missing.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}
    </div>
  );
}

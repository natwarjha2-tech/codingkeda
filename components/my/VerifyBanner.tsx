"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/app/my/api";

type Consent = { required: boolean; verified: boolean; blocked: boolean; daysLeft: number | null; profile: { verified: boolean; missing: string[] } };

/**
 * Dashboard banner (desktop #ck-verify-banner): shown until the profile /
 * parent verification is done. Under-18 students see the days left.
 */
export default function VerifyBanner() {
  const [c, setC] = useState<Consent | null>(null);
  useEffect(() => { api("/api/student/consent").then((d) => setC(d.consent || null)).catch(() => {}); }, []);
  if (!c) return null;
  const parentPending = c.required && !c.verified;
  if (!parentPending && c.profile?.verified !== false) return null;

  const urgent = c.blocked || (c.daysLeft !== null && c.daysLeft <= 3);
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-2xl border p-4 ${urgent ? "border-red-400/40 bg-red-500/10" : "border-amber-400/30 bg-amber-400/10"}`}>
      <span className="text-2xl">{parentPending ? "👨‍👩‍👧" : "🪪"}</span>
      <div className="min-w-0 flex-1">
        <div className="font-bold">{parentPending ? "Ask your parent to verify your account" : "Complete your profile"}</div>
        <div className="text-sm text-slate-300">
          {parentPending
            ? c.blocked ? "Lessons are paused until your parent verifies." : c.daysLeft !== null ? `Please finish within ${c.daysLeft} day${c.daysLeft === 1 ? "" : "s"} to keep learning.` : "It only takes a minute."
            : `Still needed: ${c.profile.missing.join(", ")}.`}
        </div>
      </div>
      <Link href={parentPending ? "/parent-consent" : "/my/profile"} className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2 text-sm font-extrabold text-[#431407]">
        {parentPending ? "Verify now" : "Update profile"}
      </Link>
    </div>
  );
}

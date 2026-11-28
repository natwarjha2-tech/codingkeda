"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { clearLocalSession, getToken, isExpiredGuest, saveToken } from "@/services/auth";

/**
 * /try/editor?example=python/loops
 * Entry to the classroom code editor from the public site (playground page,
 * tutorial "Try it" buttons). Signed-in students go straight in; visitors get a
 * temporary guest account first (no form). `example` opens that tutorial's code.
 */
export default function TryEditorPage() {
  const [err, setErr] = useState("");

  useEffect(() => {
    const example = new URLSearchParams(window.location.search).get("example") || "";
    const go = () => window.location.replace(`/my/code${example ? `?example=${encodeURIComponent(example)}` : ""}`);

    if (isExpiredGuest()) clearLocalSession(); // an old guest's 4 hours are over
    if (getToken()) { go(); return; }          // signed in, or a guest still in their session

    (async () => {
      try {
        const res = await fetch("/api/guest/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || !d.token) throw new Error(d.message || "Could not open the code editor.");
        if (!getToken()) saveToken(d.token);
        go();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not open the code editor.");
      }
    })();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0f1a] px-5 text-white">
      {err ? (
        <div className="max-w-md rounded-3xl border border-white/10 bg-[#1a1a2e] p-7 text-center">
          <div className="text-5xl">😕</div>
          <h1 className="mt-3 text-xl font-extrabold">{err}</h1>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/learn" className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-bold hover:bg-white/5">📖 Free tutorials</Link>
            <Link href="/signup" className="rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-5 py-2.5 text-sm font-bold">Sign up free</Link>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-violet-400/30 border-t-violet-400" />
          <p className="mt-4 font-semibold text-white/70">Opening the CodingKida code editor…</p>
        </div>
      )}
    </div>
  );
}

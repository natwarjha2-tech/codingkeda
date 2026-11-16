"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { dobError, ageFromDob } from "@/app/lib/age";
import { cleanName, validateName } from "@/app/lib/name";

/**
 * Parent verification (students under 18, and anyone whose age is not on file).
 * The student saves the parent's email and phone, a 6-digit code goes to the
 * parent's email (and WhatsApp, once that is switched on), the parent reads the
 * codes out and the student types them in. Same steps as the phone and desktop apps.
 */

interface Consent {
  enabled: boolean;
  required: boolean;
  verified: boolean;
  blocked: boolean;
  daysLeft?: number | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  phoneRequired?: boolean;
  studentDob?: string | null;
  parentName?: string | null;
  parentEmail?: string | null;
  parentEmailMasked?: string | null;
  parentContact?: string | null;
  parentPhoneLast4?: string | null;
  studentName?: string | null;
  profile?: { verified: boolean; missing: string[] };
}

type Busy = "" | "save" | "emailSend" | "emailConfirm" | "phoneSend" | "phoneConfirm";

/** "12-04-2010" (phone app) → "2010-04-12" (date picker). */
function toIso(s?: string | null): string {
  const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(String(s ?? "").trim());
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : String(s ?? "").trim();
}

const input = "w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-4 py-2.5 text-slate-900 text-sm outline-none";
const btn = "px-4 py-2.5 rounded-xl font-semibold text-white text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-50";

export default function ParentConsentPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [c, setC] = useState<Consent | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<Busy>("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [fullName, setFullName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [dob, setDob] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [phoneSent, setPhoneSent] = useState(false);
  const [phoneCode, setPhoneCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.message || "Something went wrong.");
    return data;
  }, [token]);

  const fill = (x: Consent) => {
    setFullName(x.studentName ?? "");
    setSavedName(x.studentName ?? "");
    setDob(toIso(x.studentDob));
    setParentName(x.parentName ?? "");
    setParentEmail(x.parentEmail ?? "");
    setParentPhone(x.parentContact ?? "");
  };

  const load = useCallback(async (refill = true) => {
    try {
      const data = await api("/api/student/consent");
      setC(data.consent);
      if (refill) fill(data.consent);
      setFailed(false);
    } catch { setFailed(true); }
    finally { setLoading(false); }
  }, [api]);

  useEffect(() => {
    const t = localStorage.getItem("token") || localStorage.getItem("ck_token") || "";
    if (!t) { router.replace("/login"); return; }
    setToken(t);
  }, [router]);
  useEffect(() => { if (token) load(); }, [token, load]);

  const dirty = !!c && (
    fullName.trim() !== savedName ||
    dob !== toIso(c.studentDob) ||
    parentName.trim() !== (c.parentName ?? "") ||
    parentEmail.trim() !== (c.parentEmail ?? "") ||
    parentPhone.trim() !== (c.parentContact ?? "")
  );

  const save = async (): Promise<boolean> => {
    const nameProblem = fullName.trim() !== savedName ? validateName(fullName) : null;
    if (nameProblem) { setMsg({ text: nameProblem, ok: false }); return false; }
    const problem = dobError(dob);
    if (problem) { setMsg({ text: problem, ok: false }); return false; }
    const adult = (ageFromDob(dob) ?? 0) >= 18;
    if (!adult) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(parentEmail.trim())) { setMsg({ text: "Enter your parent or guardian's email address.", ok: false }); return false; }
      if (parentPhone.replace(/\D/g, "").length < 10) { setMsg({ text: "Enter your parent or guardian's 10-digit phone number.", ok: false }); return false; }
    }
    setBusy("save");
    try {
      await api("/api/student/profile", {
        method: "PATCH",
        body: JSON.stringify({
          ...(fullName.trim() !== savedName ? { name: cleanName(fullName) } : {}),
          studentDob: dob.trim(),
          ...(adult ? {} : { parentName: cleanName(parentName), parentEmail: parentEmail.trim(), parentContact: parentPhone.trim() }),
        }),
      });
      await load(true);
      setMsg(null);
      return true;
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
      return false;
    } finally { setBusy(""); }
  };

  const sendEmail = async () => {
    if (dirty && !(await save())) return;
    setBusy("emailSend");
    try {
      const r = await api("/api/student/consent/email/send", { method: "POST", body: "{}" });
      setEmailSent(true); setEmailCode(""); setEmailTo(r.sentTo || "");
      setMsg({ text: `We emailed a 6-digit code to ${r.sentTo}. Ask your parent to read it out to you.`, ok: true });
    } catch (e) { setMsg({ text: (e as Error).message, ok: false }); }
    finally { setBusy(""); }
  };

  const confirmEmail = async () => {
    if (!/^\d{6}$/.test(emailCode.trim())) { setMsg({ text: "Enter the 6-digit code.", ok: false }); return; }
    setBusy("emailConfirm");
    try {
      await api("/api/student/consent/email/confirm", { method: "POST", body: JSON.stringify({ code: emailCode.trim() }) });
      setEmailSent(false); setEmailCode(""); setMsg(null);
      await load(false);
    } catch (e) { setMsg({ text: (e as Error).message, ok: false }); }
    finally { setBusy(""); }
  };

  const sendPhone = async () => {
    if (dirty && !(await save())) return;
    setBusy("phoneSend");
    try {
      const r = await api("/api/student/parent-verify/send", { method: "POST", body: "{}" });
      setPhoneSent(true); setPhoneCode(""); setDevCode(r.devCode ?? null);
      setMsg({ text: r.testMode ? "Test mode: no WhatsApp message was sent. The code is shown on screen." : `We sent a 6-digit code to your parent's WhatsApp (${r.sentTo}). Ask them to read it out to you.`, ok: true });
    } catch (e) { setMsg({ text: (e as Error).message, ok: false }); }
    finally { setBusy(""); }
  };

  const confirmPhone = async () => {
    if (!/^\d{6}$/.test(phoneCode.trim())) { setMsg({ text: "Enter the 6-digit code.", ok: false }); return; }
    setBusy("phoneConfirm");
    try {
      await api("/api/student/parent-verify/confirm", { method: "POST", body: JSON.stringify({ code: phoneCode.trim() }) });
      setPhoneSent(false); setPhoneCode(""); setDevCode(null); setMsg(null);
      await load(false);
    } catch (e) { setMsg({ text: (e as Error).message, ok: false }); }
    finally { setBusy(""); }
  };

  const signOut = () => {
    ["token", "ck_token", "user", "userEmail"].forEach((k) => localStorage.removeItem(k));
    router.replace("/login");
  };

  const shell = (children: React.ReactNode) => (
    <>
      <Navbar />
      <main className="min-h-screen bg-white pt-24 pb-16 px-4">
        <div className="max-w-xl mx-auto">{children}</div>
      </main>
    </>
  );

  if (loading) return shell(<p className="text-slate-500 text-sm">Loading…</p>);
  if (failed || !c) {
    return shell(
      <>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Could not load</h1>
        <p className="text-slate-500 text-sm mb-4">Check your internet connection and try again.</p>
        <button className={btn} onClick={() => { setLoading(true); load(); }}>Try again</button>
      </>,
    );
  }

  const profileDone = c.profile ? c.profile.verified : (!c.required || c.verified);
  // Under 18 (or age not known yet): the parent steps are needed.
  const needsParent = (ageFromDob(c.studentDob) ?? 0) < 18;

  if (profileDone) {
    return shell(
      <div className="text-center py-10">
        <div className="text-5xl mb-3">✅</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Profile verified</h1>
        <p className="text-slate-500 text-sm mb-5">
          {needsParent ? "Thank you. Your parent or guardian is verified. You can use CodingKida without any limit." : "Your details are complete."}
        </p>
        <button className={btn} onClick={() => router.replace("/dashboard")}>Continue</button>
      </div>,
    );
  }

  const card = "border border-slate-200 rounded-2xl p-4 mb-4";
  const label = "block text-xs font-semibold text-slate-700 mt-3 mb-1.5";

  return shell(
    <>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Verify your profile</h1>
      <p className="text-slate-500 text-sm mb-4">
        CodingKida is made for students, and anyone under 18 needs a parent or guardian to confirm. It takes about two minutes.
      </p>
      {c.profile && c.profile.missing.length > 0 && (
        <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-4">
          <p className="font-semibold text-slate-800 mb-1">Still needed</p>
          <ul className="list-disc pl-5 space-y-0.5">{c.profile.missing.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      )}

      {c.blocked ? (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
          Finish this to keep using CodingKida. Your learning is on hold until your parent is verified.
        </div>
      ) : c.daysLeft != null ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-xl mb-4">
          {c.daysLeft <= 1 ? "Last day to finish this." : `${c.daysLeft} days left to finish this.`}
        </div>
      ) : null}

      {msg && (
        <div className={`text-sm px-4 py-3 rounded-xl mb-4 border ${msg.ok ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
          {msg.text}
        </div>
      )}

      <div className={card}>
        <h2 className="font-bold text-slate-900">1. Your details</h2>
        <label className={label}>Your full name</label>
        <input className={input} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Rahul Sharma" />
        <label className={label}>Your date of birth</label>
        <input type="date" className={input} value={dob} onChange={(e) => setDob(e.target.value)} />
        <label className={label}>Parent or guardian name</label>
        <input className={input} value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Full name" />
        <label className={label}>Parent email</label>
        <input type="email" className={input} value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} placeholder="parent@example.com" />
        <label className={label}>Parent phone (WhatsApp)</label>
        <input type="tel" className={input} value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="10-digit mobile number" />
        {dirty && (
          <button className={`${btn} w-full mt-4`} onClick={save} disabled={!!busy}>{busy === "save" ? "Saving…" : "Save details"}</button>
        )}
      </div>

      <div className={card}>
        <h2 className="font-bold text-slate-900 mb-2">2. Parent email {c.emailVerified ? "✅" : ""}</h2>
        {c.emailVerified ? (
          <p className="text-green-600 font-semibold text-sm">Verified ({c.parentEmailMasked})</p>
        ) : (
          <>
            <p className="text-slate-500 text-sm mb-3">
              We email a 6-digit code to {c.parentEmailMasked || "your parent"}. Your parent reads it out and you type it here.
            </p>
            {emailSent && (
              <>
                <div className="flex gap-2 mb-1">
                  <input className={`${input} tracking-[0.3em] text-center`} inputMode="numeric" maxLength={6} placeholder="6-digit code"
                    value={emailCode} onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
                  <button className={btn} onClick={confirmEmail} disabled={!!busy}>{busy === "emailConfirm" ? "…" : "Confirm"}</button>
                </div>
                {emailTo && <p className="text-xs text-slate-400 mb-2">Sent to {emailTo}. Check the spam folder too.</p>}
              </>
            )}
            <button className={`${btn} w-full`} onClick={sendEmail} disabled={!!busy}>
              {busy === "emailSend" ? "Sending…" : emailSent ? "Send a new code" : "Send code to parent email"}
            </button>
          </>
        )}
      </div>

      <div className={card}>
        <h2 className="font-bold text-slate-900 mb-2">3. Parent phone {c.phoneRequired && c.phoneVerified ? "✅" : ""}</h2>
        {!c.phoneRequired ? (
          <p className="text-slate-500 text-sm">
            Phone verification on WhatsApp will start soon. For now, only the parent email is checked. Please keep the phone number above correct.
          </p>
        ) : c.phoneVerified ? (
          <p className="text-green-600 font-semibold text-sm">Verified (•••• {c.parentPhoneLast4})</p>
        ) : (
          <>
            <p className="text-slate-500 text-sm mb-3">We send a 6-digit code to your parent&apos;s WhatsApp. Your parent reads it out and you type it here.</p>
            {phoneSent && (
              <div className="flex gap-2 mb-2">
                <input className={`${input} tracking-[0.3em] text-center`} inputMode="numeric" maxLength={6} placeholder="6-digit code"
                  value={phoneCode} onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
                <button className={btn} onClick={confirmPhone} disabled={!!busy}>{busy === "phoneConfirm" ? "…" : "Confirm"}</button>
              </div>
            )}
            {devCode && <p className="text-xs text-amber-600 mb-2">Test mode: your code is {devCode}</p>}
            <button className={`${btn} w-full`} onClick={sendPhone} disabled={!!busy}>
              {busy === "phoneSend" ? "Sending…" : phoneSent ? "Send a new code" : "Send code to parent's WhatsApp"}
            </button>
          </>
        )}
      </div>

      <div className="text-center text-sm">
        {!c.blocked && (
          <button className="text-purple-600 font-semibold mx-3" onClick={() => router.replace("/dashboard")}>Do this later</button>
        )}
        <button className="text-slate-400 mx-3" onClick={signOut}>Sign out</button>
      </div>
    </>,
  );
}

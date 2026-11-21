"use client";
import { useState } from "react";
import Link from "next/link";

const GRADE_OPTIONS = ["Class 4–5", "Class 6–8", "Class 9–10", "Class 11–12"];

/** School demo request form. Posts to /api/school-inquiries. */
export default function RequestDemoForm() {
  const [f, setF] = useState({ school: "", contact: "", email: "", phone: "", city: "", students: "", message: "", website: "" });
  const [grades, setGrades] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const toggleGrade = (g: string) => setGrades((gs) => (gs.includes(g) ? gs.filter((x) => x !== g) : [...gs, g]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!grades.length) { setError("Please choose at least one class."); return; }
    if (!consent) { setError("Please agree to be contacted."); return; }
    setState("sending");
    try {
      const res = await fetch("/api/school-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, grades: grades.join(", "), students: Number(f.students) || 0, consent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) { setState("error"); setError(data.message || "Something went wrong. Please try again."); return; }
      setState("done");
    } catch {
      setState("error");
      setError("Network problem. Please try again.");
    }
  };

  if (state === "done") {
    return (
      <div className="rounded-[28px] bg-[#DCFCE7] border-2 border-[#86EFAC] border-b-8 p-8 text-center">
        <div className="text-6xl">🎉</div>
        <h3 className="mt-3 text-2xl font-black text-[#15803D]">Thank you! We got your request.</h3>
        <p className="mt-2 text-[#374151]">Our team will contact you within 2 working days to set up the demo. We have also sent a confirmation to {f.email}.</p>
        <Link href="/courses" className="mt-5 inline-block rounded-2xl bg-[#7C3AED] px-6 py-3 font-black text-white">Explore the courses meanwhile →</Link>
      </div>
    );
  }

  const input = "w-full rounded-2xl border-2 border-[#E5E7EB] bg-white px-4 py-3 font-semibold outline-none focus:border-[#7C3AED]";
  return (
    <form onSubmit={submit} className="rounded-[28px] bg-white border-2 border-[#E0F2FE] border-b-8 p-6 md:p-8 space-y-4" noValidate={false}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="School name *"><input required minLength={2} maxLength={150} value={f.school} onChange={set("school")} className={input} /></Field>
        <Field label="Your name *"><input required minLength={2} maxLength={100} value={f.contact} onChange={set("contact")} className={input} /></Field>
        <Field label="Email *"><input required type="email" maxLength={150} value={f.email} onChange={set("email")} className={input} /></Field>
        <Field label="Phone *"><input required type="tel" inputMode="tel" maxLength={20} value={f.phone} onChange={set("phone")} className={input} /></Field>
        <Field label="City *"><input required minLength={2} maxLength={80} value={f.city} onChange={set("city")} className={input} /></Field>
        <Field label="About how many students?"><input type="number" min={0} max={100000} value={f.students} onChange={set("students")} className={input} /></Field>
      </div>
      <fieldset>
        <legend className="text-sm font-black text-[#374151]">Classes you are interested in *</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {GRADE_OPTIONS.map((g) => (
            <button type="button" key={g} onClick={() => toggleGrade(g)} aria-pressed={grades.includes(g)}
              className={`rounded-full px-4 py-2 font-extrabold border-2 ${grades.includes(g) ? "bg-[#0EA5E9] border-[#0EA5E9] text-white" : "bg-white border-[#E5E7EB]"}`}>
              {g}
            </button>
          ))}
        </div>
      </fieldset>
      <Field label="Message (optional)"><textarea rows={4} maxLength={2000} value={f.message} onChange={set("message")} className={input} placeholder="Tell us about your school, timings or questions" /></Field>
      {/* Honeypot (hidden from people) */}
      <input type="text" name="website" value={f.website} onChange={set("website")} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <label className="flex items-start gap-3 text-sm text-[#374151]">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 w-5 h-5 accent-[#7C3AED]" />
        <span>I agree that CodingKida may contact me about this demo. See our <Link href="/privacy" className="underline font-bold">Privacy Policy</Link>.</span>
      </label>
      {error && <p className="rounded-2xl bg-[#FFE4E6] px-4 py-3 font-bold text-[#BE123C]">{error}</p>}
      <button type="submit" disabled={state === "sending"} className="w-full rounded-2xl bg-[#0EA5E9] px-6 py-4 text-lg font-black text-white border-b-[6px] border-[#0369A1] disabled:opacity-60">
        {state === "sending" ? "Sending…" : "Request a free demo →"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-[#374151]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

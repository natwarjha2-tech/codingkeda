"use client";
import { isMinorDob } from "@/app/lib/age";
import { PASSWORD_HINT } from "@/app/lib/password-rules";
import type { SignupField } from "@/app/lib/signup-errors";

export const CLASS_OPTIONS = [
  "Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6",
  "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12",
  "College", "Other",
];

/**
 * Date of birth, class, school, parent fields (shown only for under-18) and the
 * Terms / Privacy agreement box, for every website sign-up form. `dark` matches
 * the dark bottom-sheet on phones. `badField` marks the field with a problem in red.
 * The agreement box is NOT ticked by default: the student must tick it.
 */
export default function SignupExtraFields({
  dob, setDob, studentClass, setStudentClass, school, setSchool, agreed, setAgreed,
  parentName, setParentName, parentEmail, setParentEmail, parentPhone, setParentPhone,
  dark = false, badField = null,
}: {
  dob: string; setDob: (v: string) => void;
  studentClass: string; setStudentClass: (v: string) => void;
  school: string; setSchool: (v: string) => void;
  agreed: boolean; setAgreed: (v: boolean) => void;
  parentName: string; setParentName: (v: string) => void;
  parentEmail: string; setParentEmail: (v: string) => void;
  parentPhone: string; setParentPhone: (v: string) => void;
  dark?: boolean;
  badField?: SignupField;
}) {
  const minor = isMinorDob(dob) === true;
  const label = dark ? "text-xs font-semibold text-slate-300 block mb-1.5" : "text-sm font-semibold text-slate-700 block mb-1.5";
  const base = dark
    ? "w-full bg-white/5 border focus:border-purple-500 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder:text-slate-500 [color-scheme:dark]"
    : "w-full bg-slate-50 border focus:border-purple-500 rounded-xl px-4 py-3 text-slate-900 text-sm outline-none transition-colors placeholder:text-slate-400";
  const input = (f: SignupField) =>
    `${base} ${badField === f ? "border-red-500 ring-2 ring-red-200" : dark ? "border-white/10" : "border-slate-200"}`;
  const link = dark ? "text-purple-300 underline font-semibold" : "text-purple-600 underline font-semibold";
  return (
    <>
      <p className={dark ? "text-[11px] text-slate-400 -mt-2" : "text-xs text-slate-400 -mt-2"}>{PASSWORD_HINT}</p>
      <div>
        <label htmlFor="signup-dob" className={label}>Date of Birth</label>
        <input id="signup-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={input("dob")}
          aria-invalid={badField === "dob"} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="signup-studentClass" className={label}>Class</label>
          <select id="signup-studentClass" value={studentClass} onChange={(e) => setStudentClass(e.target.value)}
            className={input("studentClass")} aria-invalid={badField === "studentClass"}>
            <option value="">Select your class</option>
            {CLASS_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="signup-school" className={label}>School name</label>
          <input id="signup-school" type="text" placeholder="Your school or college" maxLength={150}
            value={school} onChange={(e) => setSchool(e.target.value)} className={input("school")} aria-invalid={badField === "school"} />
        </div>
      </div>
      {minor && (
        <div className={dark ? "rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 space-y-2.5" : "rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-3"}>
          <div>
            <p className={dark ? "text-sm font-bold text-white" : "text-sm font-bold text-slate-800"}>Parent or guardian</p>
            <p className={dark ? "text-xs text-slate-400 mt-0.5" : "text-xs text-slate-500 mt-0.5"}>
              You are under 18, so a parent or guardian must confirm. After you log in, we will send them a code.
            </p>
          </div>
          <input id="signup-parentName" type="text" placeholder="Parent or guardian name" aria-label="Parent or guardian name"
            value={parentName} onChange={(e) => setParentName(e.target.value)} className={input("parentName")} aria-invalid={badField === "parentName"} />
          <input id="signup-parentEmail" type="email" placeholder="Parent email" aria-label="Parent email"
            value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} className={input("parentEmail")} aria-invalid={badField === "parentEmail"} />
          <input id="signup-parentPhone" type="tel" placeholder="Parent phone (WhatsApp)" aria-label="Parent phone"
            value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} className={input("parentPhone")} aria-invalid={badField === "parentPhone"} />
        </div>
      )}
      <label
        htmlFor="signup-terms"
        className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer ${
          badField === "terms" ? "border-red-500 ring-2 ring-red-200" : dark ? "border-white/10" : "border-slate-200"
        }`}
      >
        <input id="signup-terms" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-purple-600 flex-shrink-0" aria-invalid={badField === "terms"} />
        <span className={dark ? "text-xs text-slate-300 leading-relaxed" : "text-xs text-slate-600 leading-relaxed"}>
          I have read and agree to the{" "}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className={link}>Terms &amp; Conditions</a> and{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className={link}>Privacy Policy</a>.
          {minor ? " My parent or guardian will also confirm." : ""}
        </span>
      </label>
    </>
  );
}

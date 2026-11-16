"use client";
import { isMinorDob } from "@/app/lib/age";
import { PASSWORD_HINT } from "@/app/lib/password-rules";
import type { SignupField } from "@/app/lib/signup-errors";

/**
 * Date of birth + parent fields (shown only for under-18) for every website
 * sign-up form. `dark` matches the dark bottom-sheet on phones. `badField`
 * marks the field that has a problem in red.
 */
export default function SignupExtraFields({
  dob, setDob, parentName, setParentName, parentEmail, setParentEmail, parentPhone, setParentPhone,
  dark = false, badField = null,
}: {
  dob: string; setDob: (v: string) => void;
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
  return (
    <>
      <p className={dark ? "text-[11px] text-slate-400 -mt-2" : "text-xs text-slate-400 -mt-2"}>{PASSWORD_HINT}</p>
      <div>
        <label htmlFor="signup-dob" className={label}>Date of Birth</label>
        <input id="signup-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={input("dob")}
          aria-invalid={badField === "dob"} />
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
    </>
  );
}

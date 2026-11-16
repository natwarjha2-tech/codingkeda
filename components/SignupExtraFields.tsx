"use client";
import { isMinorDob } from "@/app/lib/age";
import { PASSWORD_HINT } from "@/app/lib/password-rules";

/**
 * Date of birth + parent fields (shown only for under-18) for every website
 * sign-up form. `dark` matches the dark bottom-sheet on phones.
 */
export default function SignupExtraFields({
  dob, setDob, parentName, setParentName, parentEmail, setParentEmail, parentPhone, setParentPhone, dark = false,
}: {
  dob: string; setDob: (v: string) => void;
  parentName: string; setParentName: (v: string) => void;
  parentEmail: string; setParentEmail: (v: string) => void;
  parentPhone: string; setParentPhone: (v: string) => void;
  dark?: boolean;
}) {
  const minor = isMinorDob(dob) === true;
  const label = dark ? "text-xs font-semibold text-slate-300 block mb-1.5" : "text-sm font-semibold text-slate-700 block mb-1.5";
  const input = dark
    ? "w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder:text-slate-500 [color-scheme:dark]"
    : "w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-4 py-3 text-slate-900 text-sm outline-none transition-colors placeholder:text-slate-400";
  return (
    <>
      <p className={dark ? "text-[11px] text-slate-400 -mt-2" : "text-xs text-slate-400 -mt-2"}>{PASSWORD_HINT}</p>
      <div>
        <label className={label}>Date of Birth</label>
        <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={input} />
      </div>
      {minor && (
        <div className={dark ? "rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 space-y-2.5" : "rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-3"}>
          <div>
            <p className={dark ? "text-sm font-bold text-white" : "text-sm font-bold text-slate-800"}>Parent or guardian</p>
            <p className={dark ? "text-xs text-slate-400 mt-0.5" : "text-xs text-slate-500 mt-0.5"}>
              You are under 18, so a parent or guardian must confirm. After you log in, we will send them a code.
            </p>
          </div>
          <input type="text" placeholder="Parent or guardian name" value={parentName} onChange={(e) => setParentName(e.target.value)} className={input} />
          <input type="email" placeholder="Parent email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} className={input} />
          <input type="tel" placeholder="Parent phone (WhatsApp)" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} className={input} />
        </div>
      )}
    </>
  );
}

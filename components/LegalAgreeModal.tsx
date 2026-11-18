"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type LegalDoc = "terms" | "privacy";

/**
 * "Read the Terms" window for sign-up: Terms and Privacy Policy in two tabs,
 * on top of the form (the form and what the student typed stay as they are).
 * "Close" goes back to the form; "I agree" ticks the agreement box and closes.
 */
export default function LegalAgreeModal({
  open, initial = "terms", onClose, onAgree,
}: {
  open: boolean;
  initial?: LegalDoc;
  onClose: () => void;
  onAgree: () => void;
}) {
  const [tab, setTab] = useState<LegalDoc>(initial);
  useEffect(() => { if (open) setTab(initial); }, [open, initial]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  const tabBtn = (id: LegalDoc, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`flex-1 py-2.5 text-sm font-bold border-b-2 ${tab === id ? "border-purple-600 text-purple-700" : "border-transparent text-slate-500"}`}
      aria-pressed={tab === id}
    >
      {label}
    </button>
  );

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-3" role="dialog" aria-modal="true" aria-label="Terms and Privacy Policy">
      <div className="bg-white w-full max-w-2xl h-[88vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-3">
          <p className="font-extrabold text-slate-900">Please read before you sign up</p>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800 text-xl leading-none px-2" aria-label="Close">×</button>
        </div>
        <div className="flex px-2 mt-1 border-b border-slate-200">
          {tabBtn("terms", "Terms & Conditions")}
          {tabBtn("privacy", "Privacy Policy")}
        </div>
        <iframe
          key={tab}
          src={tab === "terms" ? "/terms?embed=1" : "/privacy?embed=1"}
          title={tab === "terms" ? "Terms and Conditions" : "Privacy Policy"}
          className="flex-1 w-full border-0"
        />
        <div className="flex gap-3 p-3 border-t border-slate-200 bg-slate-50">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 rounded-xl font-semibold text-sm text-slate-700 bg-white border border-slate-300 hover:bg-slate-100">
            ← Back to sign up
          </button>
          <button type="button" onClick={() => { onAgree(); onClose(); }}
            className="flex-1 py-3 rounded-xl font-bold text-sm text-white bg-purple-600 hover:bg-purple-700">
            I agree to both
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Result =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "invalid" }
  | { state: "valid"; code: string; studentName: string; courseTitle: string; percent: number; issuedAt: string };

/** Check a CodingKida certificate code with GET /api/certificates/verify. */
export default function VerifyCertificate() {
  const params = useSearchParams();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [result, setResult] = useState<Result>({ state: "idle" });

  const check = async (value: string) => {
    const c = value.trim().toUpperCase();
    if (!/^CK-\d{4}-[0-9A-F]{6,8}$/.test(c)) {
      setResult({ state: "error", message: "A code looks like CK-2026-1A2B3C4D. Please check and try again." });
      return;
    }
    setResult({ state: "loading" });
    try {
      const res = await fetch(`/api/certificates/verify?code=${encodeURIComponent(c)}`);
      const data = await res.json();
      if (!data.success) setResult({ state: "error", message: data.message || "Could not check this code." });
      else if (!data.valid) setResult({ state: "invalid" });
      else setResult({ state: "valid", code: data.code, studentName: data.studentName, courseTitle: data.courseTitle, percent: data.percent, issuedAt: data.issuedAt });
    } catch {
      setResult({ state: "error", message: "Network problem. Please try again." });
    }
  };

  // Links printed on certificates open with ?code=… — check straight away.
  useEffect(() => {
    const c = params.get("code");
    if (c) check(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-2xl mx-auto">
      <form
        onSubmit={(e) => { e.preventDefault(); check(code); }}
        className="rounded-[28px] bg-white border-2 border-[#EDE9FE] border-b-8 p-6 md:p-8"
      >
        <label htmlFor="cert" className="text-lg font-black">Certificate code</label>
        <div className="mt-3 flex flex-col sm:flex-row gap-3">
          <input
            id="cert"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="CK-2026-1A2B3C4D"
            className="flex-1 rounded-2xl border-2 border-[#E5E7EB] px-5 py-4 font-mono text-lg uppercase outline-none focus:border-[#7C3AED]"
          />
          <button
            type="submit"
            disabled={result.state === "loading"}
            className="rounded-2xl bg-[#7C3AED] px-7 py-4 text-lg font-black text-white border-b-[6px] border-[#5B21B6] disabled:opacity-60"
          >
            {result.state === "loading" ? "Checking…" : "Check"}
          </button>
        </div>
        <p className="mt-3 text-sm text-[#6B7280]">The code is printed at the bottom of every CodingKida certificate.</p>
      </form>

      {result.state === "valid" && (
        <div className="mt-6 rounded-[28px] bg-[#DCFCE7] border-2 border-[#86EFAC] border-b-8 p-6 md:p-8 text-center">
          <div className="text-6xl">🎓✅</div>
          <h2 className="mt-3 text-2xl font-black text-[#15803D]">This certificate is real</h2>
          <p className="mt-4 text-lg">
            <b>{result.studentName}</b> completed <b>{result.courseTitle}</b> with <b>{result.percent}%</b>.
          </p>
          <p className="mt-1 text-[#4B5563]">
            Issued on {new Date(result.issuedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} · {result.code}
          </p>
        </div>
      )}
      {result.state === "invalid" && (
        <div className="mt-6 rounded-[28px] bg-[#FFE4E6] border-2 border-[#FDA4AF] p-6 text-center">
          <div className="text-5xl">❌</div>
          <h2 className="mt-2 text-xl font-black text-[#BE123C]">We could not find this certificate</h2>
          <p className="text-[#4B5563]">Check the code for typing mistakes.</p>
        </div>
      )}
      {result.state === "error" && (
        <p className="mt-6 rounded-2xl bg-[#FFF7E6] border-2 border-[#FDE68A] p-4 font-bold text-[#92400E]">{result.message}</p>
      )}
    </div>
  );
}

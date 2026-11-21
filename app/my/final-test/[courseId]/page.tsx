"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "../../api";
import CertificateViewer from "@/components/my/CertificateViewer";

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const fmtDate = (iso: string) => { try { return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }); } catch { return iso; } };
const clock = (sec: number) => { sec = Math.max(0, Math.floor(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`; };

type Q = { id: string; question: string; options: string[] };
type RevItem = { question: string; options: string[]; selected: number | null; answer: number | null; correct: boolean; explanation?: string };
type View =
  | { k: "intro" } | { k: "test" } | { k: "submitting" }
  | { k: "result"; r: any; auto: boolean } | { k: "review"; d: any } | { k: "claim"; attemptId: string; suggested: string };

export default function FinalTestPage() {
  return <Suspense fallback={<div className="pt-10 text-center text-slate-400">Loading…</div>}><FinalTest /></Suspense>;
}

/** Final course test — same rules and API as the desktop app (final-test.js). */
function FinalTest() {
  const { courseId } = useParams<{ courseId: string }>();
  const claimParam = useSearchParams().get("claim") === "1";
  const [status, setStatus] = useState<any>(null);
  const [err, setErr] = useState("");
  const [view, setView] = useState<View>({ k: "intro" });
  const [cert, setCert] = useState<{ code: string; percent?: number } | null>(null);

  // test state
  const [attemptId, setAttemptId] = useState("");
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [idx, setIdx] = useState(0);
  const [left, setLeft] = useState(0);
  const endsAt = useRef(0);
  const offset = useRef(0);
  const submitted = useRef(false);

  const loadStatus = useCallback(() => {
    api(`/api/final-test?courseId=${encodeURIComponent(courseId)}`)
      .then((s) => {
        setStatus(s);
        if (claimParam && s.pendingCertificate) setView({ k: "claim", attemptId: s.pendingCertificate.attemptId, suggested: s.pendingCertificate.suggestedName || "" });
      })
      .catch((e) => setErr(e.message));
  }, [courseId, claimParam]);
  useEffect(loadStatus, [loadStatus]);

  const submit = useCallback(async (auto: boolean) => {
    if (submitted.current) return;
    submitted.current = true;
    setView({ k: "submitting" });
    try {
      const r = await api("/api/final-test/submit", { method: "POST", json: { attemptId, answers } });
      try { localStorage.removeItem(`ck_final_answers_${attemptId}`); } catch { /* ignore */ }
      setView({ k: "result", r, auto });
      loadStatus();
    } catch (e) {
      submitted.current = false;
      window.alert(`Submit failed: ${e instanceof Error ? e.message : "error"}\nYour answers are saved — try again.`);
      setView({ k: "test" });
    }
  }, [attemptId, answers, loadStatus]);

  // timer
  useEffect(() => {
    if (view.k !== "test") return;
    const tick = () => {
      const l = (endsAt.current - (Date.now() + offset.current)) / 1000;
      setLeft(l);
      if (l <= 0) submit(true);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [view.k, submit]);

  const start = async () => {
    try {
      const t = await api("/api/final-test/start", { method: "POST", json: { courseId } });
      let saved: Record<string, number> = {};
      try { saved = JSON.parse(localStorage.getItem(`ck_final_answers_${t.attemptId}`) || "{}") || {}; } catch { /* ignore */ }
      setAttemptId(t.attemptId); setQuestions(t.questions || []); setAnswers(saved); setIdx(0);
      endsAt.current = new Date(t.endsAt).getTime();
      offset.current = new Date(t.serverNow).getTime() - Date.now();
      submitted.current = false;
      setView({ k: "test" });
    } catch (e) { window.alert(e instanceof Error ? e.message : "Could not start."); }
  };

  const pick = (qid: string, i: number) => {
    setAnswers((a) => {
      const n = { ...a, [qid]: i };
      try { localStorage.setItem(`ck_final_answers_${attemptId}`, JSON.stringify(n)); } catch { /* ignore */ }
      return n;
    });
  };

  const openReview = async (id: string) => {
    try { setView({ k: "review", d: await api(`/api/final-test/review?attemptId=${encodeURIComponent(id)}`) }); }
    catch (e) { window.alert(`Could not load this attempt: ${e instanceof Error ? e.message : ""}`); }
  };

  const shell = (title: string, right: React.ReactNode, body: React.ReactNode) => (
    <div className="mx-auto max-w-3xl pt-2">
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-violet-400/20 bg-[#12121f] px-4 py-3">
        <b>{title}</b><div className="flex items-center gap-2">{right}</div>
      </div>
      {body}
      {cert && <CertificateViewer code={cert.code} courseTitle={status?.courseTitle} percent={cert.percent} onClose={() => setCert(null)} />}
    </div>
  );
  const back = <Link href={`/my/courses/${courseId}`} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold">✕ Close</Link>;

  if (err) return shell("🎓 Final Test", back, <div className="py-10 text-center text-amber-300">{err}</div>);
  if (!status) return shell("🎓 Final Test", back, <div className="py-10 text-center text-slate-400">Loading…</div>);

  /* ── test ── */
  if (view.k === "test" && questions.length) {
    const q = questions[idx];
    const n = questions.length;
    const answered = Object.keys(answers).length;
    return shell(`Question ${idx + 1}/${n}`,
      <>
        <span className={`rounded-lg px-3 py-1 font-mono text-sm font-bold ${left < 300 ? "bg-red-500/20 text-red-300" : "bg-white/10"}`}>⏱ {clock(left)}</span>
        <button onClick={() => { if (window.confirm("Leave the test? Your answers are saved and the timer keeps running. You can resume from the course page.")) window.location.href = `/my/courses/${courseId}`; }} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold">Leave</button>
      </>,
      <div>
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-violet-500 to-pink-500" style={{ width: `${(answered / n) * 100}%` }} /></div>
        <div className="rounded-2xl border border-white/10 bg-[#161626] p-5">
          <div className="mb-4 text-lg font-bold">{q.question}</div>
          <div className="space-y-2">
            {q.options.map((o, i) => (
              <button key={i} onClick={() => pick(q.id, i)} className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm ${answers[q.id] === i ? "border-violet-400 bg-violet-500/20" : "border-white/10 bg-white/5 hover:border-violet-400/40"}`}>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-xs font-extrabold">{LETTERS[i] || i + 1}</span>{o}
              </button>
            ))}
          </div>
          <div className="mt-5 text-xs text-slate-400">{answered}/{n} answered — jump to any question:</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {questions.map((qq, i) => (
              <button key={qq.id} onClick={() => setIdx(i)} className={`h-8 w-8 rounded-lg text-xs font-bold ${i === idx ? "ring-2 ring-violet-400" : ""} ${answers[qq.id] !== undefined ? "bg-emerald-500/30" : "bg-white/10"}`}>{i + 1}</button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex justify-between">
          <button disabled={idx === 0} onClick={() => setIdx(idx - 1)} className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-bold disabled:opacity-40">‹ Prev</button>
          {idx < n - 1
            ? <button onClick={() => setIdx(idx + 1)} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold">Next ›</button>
            : <button onClick={() => { const un = n - answered; if (window.confirm(un > 0 ? `You have ${un} unanswered question(s). Submit anyway?` : "Submit your answers now?")) submit(false); }} className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-extrabold text-[#052e16]">✓ Submit</button>}
        </div>
      </div>);
  }

  if (view.k === "submitting") return shell("🎓 Final Test", null, <div className="py-20 text-center text-slate-400">⏳ Checking your answers…</div>);

  /* ── result ── */
  if (view.k === "result") {
    const r = view.r;
    return shell("Result", back,
      <div>
        <div className="rounded-2xl border border-white/10 bg-[#161626] p-6 text-center">
          <div className="text-5xl">{r.passed ? "🎉" : "💪"}</div>
          <div className="text-5xl font-extrabold" style={{ color: r.passed ? "#22c55e" : "#f59e0b" }}>{r.percent}%</div>
          <h2 className="text-xl font-extrabold">{r.passed ? "You passed!" : "Not passed yet"}</h2>
          <p className="text-sm text-slate-400">{r.score}/{r.total} correct · pass mark {r.passPercent}%{r.late ? " · Submitted after the time limit — answers were not counted." : ""}{view.auto ? " · Time was up — submitted automatically." : ""}</p>
          <div className="mt-4">
            {r.passed ? (r.certificate
              ? <button onClick={() => setCert({ code: r.certificate.code, percent: r.percent })} className="rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-6 py-3 font-bold">📜 View Certificate</button>
              : r.needsCertificate ? <button onClick={() => setView({ k: "claim", attemptId, suggested: r.suggestedName || "" })} className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-3 font-extrabold text-[#431407]">🎓 Get Your Certificate</button> : null)
              : <p className="text-amber-300">Revise the lessons you missed and try again{r.nextAttemptAt ? ` after ${fmtDate(r.nextAttemptAt)}` : ""}.</p>}
          </div>
        </div>
        <Review items={r.review || []} />
        {!r.passed && <p className="mt-3 text-center text-sm text-slate-400">Correct answers are shown once you pass.</p>}
      </div>);
  }

  /* ── review of a past attempt ── */
  if (view.k === "review") {
    const d = view.d;
    return shell("Attempt review", <button onClick={() => setView({ k: "intro" })} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold">‹ Back</button>,
      <div>
        <div className="rounded-2xl border border-white/10 bg-[#161626] p-6 text-center">
          <div className="text-5xl font-extrabold" style={{ color: d.passed ? "#22c55e" : "#f59e0b" }}>{d.percent}%</div>
          <h2 className="text-xl font-extrabold">{d.passed ? "Passed" : "Not passed"}</h2>
          <p className="text-sm text-slate-400">{d.score}/{d.total} correct · {fmtDate(d.submittedAt)}</p>
        </div>
        <Review items={d.review || []} />
        {!d.answersRevealed && <p className="mt-3 text-center text-sm text-slate-400">Correct answers are shown once you pass the test.</p>}
      </div>);
  }

  /* ── claim certificate ── */
  if (view.k === "claim") return shell("Your Certificate", back, <Claim attemptId={view.attemptId} suggested={view.suggested} onIssued={(c) => { setCert(c); loadStatus(); setView({ k: "intro" }); }} />);

  /* ── intro ── */
  const s = status;
  const cooling = s.nextAttemptAt && !s.inProgress;
  return shell("🎓 Final Test", back,
    <div className="rounded-2xl border border-white/10 bg-[#161626] p-6 text-center">
      <div className="text-6xl">🎓</div>
      <h2 className="mt-2 text-2xl font-extrabold">{s.courseTitle}</h2>
      <div className="text-xs font-bold tracking-wider text-violet-300">FINAL COURSE TEST</div>
      <div className="mx-auto my-5 max-w-md rounded-xl bg-white/5 p-4 text-left text-sm leading-7">
        ❓ {s.totalQuestions} multiple-choice questions from every lesson<br />
        ⏱ {s.timeLimitMin} minutes — submitted automatically when time ends<br />
        🎯 Score {s.passPercent}% or more to pass and earn your certificate<br />
        🔁 Failed? You can retake it after 24 hours
      </div>
      {s.bestPercent !== null && <p className="text-sm text-slate-400">Attempts: {s.attemptsCount} · Best score: {s.bestPercent}%</p>}
      {s.attempts?.length > 0 && (
        <div className="mx-auto my-4 max-w-md text-left">
          <div className="mb-2 text-[11px] font-bold tracking-wider text-slate-400">MY ATTEMPTS · CLICK TO REVIEW ANSWERS</div>
          {s.attempts.map((a: any, i: number) => (
            <button key={a.attemptId} onClick={() => openReview(a.attemptId)} className="mb-1.5 flex w-full items-center gap-3 rounded-xl bg-white/5 p-3 text-left hover:bg-white/10">
              <div className="flex-1"><div className="font-bold">Attempt {s.attempts.length - i} · {a.percent}%</div><div className="text-xs text-slate-500">{a.score}/{a.total} correct · {fmtDate(a.submittedAt)}</div></div>
              <span className={`text-xs font-extrabold ${a.passed ? "text-emerald-400" : "text-amber-400"}`}>{a.passed ? "✅ Passed" : "Not passed"}</span><span>›</span>
            </button>
          ))}
        </div>
      )}
      {s.certificate && <button onClick={() => setCert({ code: s.certificate.code, percent: s.certificate.percent })} className="mb-3 mr-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-5 py-2.5 text-sm font-bold text-amber-300">📜 View Certificate</button>}
      {!s.unlocked ? <div className="text-amber-300">🔒 Complete all lessons to unlock the final test ({s.completedLessons}/{s.totalLessons} done).</div>
        : cooling ? <div className="text-amber-300">⏳ You can retake the test after {fmtDate(s.nextAttemptAt)}.</div>
        : <button onClick={start} className="rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-8 py-3 text-base font-bold">{s.inProgress ? "▶ Resume Test" : s.passed ? "🔁 Practice Again" : "▶ Start Final Test"}</button>}
    </div>);
}

function Review({ items }: { items: RevItem[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-5">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-violet-300">Review</h3>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className={`rounded-xl border p-3 text-sm ${it.correct ? "border-emerald-400/30 bg-emerald-400/5" : "border-red-400/30 bg-red-400/5"}`}>
            <b>{it.correct ? "✅" : "❌"} {i + 1}. {it.question}</b>
            <div>Your answer: {it.selected !== null && it.selected !== undefined ? `${LETTERS[it.selected]}. ${it.options[it.selected] || ""}` : "Not answered"}</div>
            {it.answer !== null && it.answer !== undefined && !it.correct && <div className="text-emerald-400">Correct: {LETTERS[it.answer]}. {it.options[it.answer] || ""}</div>}
            {it.explanation && !it.correct && <div className="text-slate-400">{it.explanation}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Claim({ attemptId, suggested, onIssued }: { attemptId: string; suggested: string; onIssued: (c: { code: string; percent?: number }) => void }) {
  const [name, setName] = useState(suggested);
  const [busy, setBusy] = useState(false);
  const issue = async () => {
    const n = name.replace(/\s+/g, " ").trim();
    if (!/^[A-Za-z][A-Za-z .'-]{1,59}$/.test(n)) { window.alert("Use English letters only (spaces, . ' - allowed), 2–60 characters."); return; }
    if (!window.confirm(`Your certificate will show:\n\n${n}\n\nThis cannot be changed later. Continue?`)) return;
    setBusy(true);
    try { const d = await api("/api/certificates", { method: "POST", json: { attemptId, name: n } }); onIssued({ code: d.certificate.code, percent: d.certificate.percent }); }
    catch (e) { window.alert(e instanceof Error ? e.message : "Could not issue the certificate."); setBusy(false); }
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-[#161626] p-6 text-center">
      <div className="text-5xl">📜</div>
      <h2 className="text-xl font-extrabold">Name on your certificate</h2>
      <p className="text-sm text-slate-400">Check the spelling — the certificate can&apos;t be edited after it is issued.</p>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Full name" className="mx-auto mt-4 block w-full max-w-sm rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center text-lg outline-none focus:border-violet-400" />
      <button onClick={issue} disabled={busy} className="mt-4 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-7 py-3 font-extrabold text-[#431407] disabled:opacity-60">Get Certificate</button>
    </div>
  );
}

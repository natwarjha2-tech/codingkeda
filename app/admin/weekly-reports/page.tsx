"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Send, MessageCircle, ShieldCheck, AlertTriangle, RefreshCw } from "lucide-react";
import Navbar from "@/components/Navbar";

interface Preview {
  week: { start: string; label: string };
  autoEnabled: boolean;
  settings: { testMode: boolean; testNumbers: number; testAsText: boolean; configured: boolean; otpConfigured: boolean; dryRun: boolean; templateName: string; language: string; dailyLimit: number };
  totals: { consented: number; ready: number; noNumber: number; notVerified: number; inactive: number; alreadySent: number; failed: number };
  samples: { studentName: string; to: string | null; text: string }[];
  recentFailures: { userId: string; error: string | null; toLast4: string | null }[];
}
interface BatchResult {
  dryRun: boolean; configured: boolean; wouldSend: number; remaining: number; sent: number; failed: number; capReached: boolean;
  failures: { studentName: string; error: string }[];
}

export default function WeeklyReportsPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [data, setData] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [testTo, setTestTo] = useState("");
  const [testMsg, setTestMsg] = useState("");
  const [testing, setTesting] = useState(false);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<null | "send" | "retry">(null);
  const stop = useRef(false);

  useEffect(() => {
    const t = localStorage.getItem("token") || "";
    setToken(t);
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      setAllowed(u.role === "super-admin");
    } catch { setAllowed(false); }
  }, []);

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {}) } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) throw new Error(json.message || `Request failed (${res.status})`);
    return json;
  }, [token]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await api("/api/admin/weekly-reports")); }
    catch (e) { setError((e as Error).message); }
    setLoading(false);
  }, [api]);

  useEffect(() => { if (allowed && token) load(); else if (allowed === false) setLoading(false); }, [allowed, token, load]);

  const [autoBusy, setAutoBusy] = useState(false);
  const toggleAuto = async () => {
    if (!data) return;
    setAutoBusy(true);
    try {
      await api("/api/admin/weekly-reports/auto", { method: "POST", body: JSON.stringify({ enabled: !data.autoEnabled }) });
      await load();
    } catch (e) { setError((e as Error).message); }
    setAutoBusy(false);
  };

  const sendTest = async () => {
    setTesting(true); setTestMsg("");
    try {
      const r = await api("/api/admin/weekly-reports/test", { method: "POST", body: JSON.stringify({ to: testTo }) });
      setTestMsg(r.dryRun ? `Dry run — nothing was sent. This is what ${r.to} would receive:\n\n${r.text}` : `✅ Sent to ${r.to}. Check WhatsApp.`);
    } catch (e) { setTestMsg(`⚠️ ${(e as Error).message}`); }
    setTesting(false);
  };

  const runSend = async (retryFailed: boolean) => {
    setConfirm(null); setRunning(true); stop.current = false; setLog([]);
    const add = (s: string) => setLog((l) => [...l, s]);
    const maxRounds = Math.ceil(Math.max(1, (retryFailed ? data?.totals.failed : data?.totals.ready) || 1) / 50) + 2;
    try {
      for (let round = 1; round <= maxRounds && !stop.current; round++) {
        const r: BatchResult = await api("/api/admin/weekly-reports/send", { method: "POST", body: JSON.stringify({ limit: 50, retryFailed }) });
        if (r.dryRun) {
          add(`Dry run — ${r.wouldSend} message(s) would be sent in this batch, ${r.remaining} more after that. Nothing was sent.${r.configured ? "" : " (WhatsApp is not configured on the server.)"}`);
          break;
        }
        add(`Batch ${round}: sent ${r.sent}, failed ${r.failed}, ${r.remaining} left.`);
        r.failures.slice(0, 5).forEach((f) => add(`   ⚠️ ${f.studentName}: ${f.error}`));
        if (r.capReached) { add("Daily sending limit reached. Run again later (it continues where it stopped)."); break; }
        if (r.remaining <= 0) { add("✅ All done."); break; }
      }
    } catch (e) { add(`⚠️ ${(e as Error).message}`); }
    setRunning(false);
    load();
  };

  if (allowed === false) {
    return (<><Navbar /><main className="min-h-screen bg-[#0f0f1a] pt-28 px-6 text-center text-slate-300">This page is for super admins only.</main></>);
  }

  const t = data?.totals;
  const live = data && !data.settings.dryRun && data.settings.configured;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0f0f1a] px-6 py-8 pt-24">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => router.push("/admin/dashboard")} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6">
            <ArrowLeft size={15} /> Back to dashboard
          </button>

          <div className="flex items-center gap-3 mb-1">
            <span className="bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1"><MessageCircle size={12} /> WhatsApp</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white">Weekly parent reports</h1>
          <p className="text-slate-400 text-sm mt-1 mb-8">Sends each consenting parent a short progress summary for the last week.</p>

          {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl mb-6">⚠️ {error}</div>}

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 size={28} className="text-purple-400 animate-spin" /></div>
          ) : data && t && (
            <>
              {data.settings.testMode && (
                <div className="bg-blue-500/10 border border-blue-500/30 text-blue-300 text-sm px-4 py-3 rounded-xl mb-6">
                  🧪 <b>TEST MODE.</b> Only the {data.settings.testNumbers} test number{data.settings.testNumbers === 1 ? "" : "s"} on the server’s test list can be messaged, and
                  nobody else. Consent and verification are skipped for them, students with no activity are still included, and the same week can be sent again.
                  {data.settings.testAsText ? " Reports go out as a plain message (each test number must have messaged the test number in the last 24 hours)." : " The message sent is the template named on the server."}
                </div>
              )}

              {/* Status */}
              <div className="grid sm:grid-cols-3 gap-3 mb-6">
                <div className="bg-[#16213e] border border-white/10 rounded-2xl p-4">
                  <div className="text-slate-400 text-xs mb-1">Week being reported</div>
                  <div className="text-white font-bold">{data.week.label}</div>
                </div>
                <div className={`border rounded-2xl p-4 ${live ? "bg-red-500/10 border-red-500/30" : "bg-yellow-500/10 border-yellow-500/30"}`}>
                  <div className="text-slate-400 text-xs mb-1">Mode</div>
                  <div className={`font-bold flex items-center gap-2 ${live ? "text-red-400" : "text-yellow-400"}`}>
                    {live ? <><Send size={14} /> LIVE — messages will be sent</> : <><ShieldCheck size={14} /> Dry run — nothing is sent</>}
                  </div>
                </div>
                <div className="bg-[#16213e] border border-white/10 rounded-2xl p-4">
                  <div className="text-slate-400 text-xs mb-1">WhatsApp setup</div>
                  <div className={`font-bold ${data.settings.configured ? "text-green-400" : "text-red-400"}`}>
                    {data.settings.configured ? `Ready · template “${data.settings.templateName}”` : "Not configured on the server"}
                  </div>
                </div>
              </div>

              {/* Numbers */}
              <div className="bg-[#16213e] border border-white/10 rounded-2xl p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white font-bold">Who will get a message</h2>
                  <button onClick={load} className="text-slate-400 hover:text-white text-xs flex items-center gap-1"><RefreshCw size={12} /> Refresh</button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <Stat label="Switched on by student" value={t.consented} />
                  <Stat label="Ready to send" value={t.ready} accent="text-green-400" />
                  <Stat label="Already sent" value={t.alreadySent} />
                  <Stat label="Number not verified" value={t.notVerified} accent={t.notVerified ? "text-yellow-400" : undefined} />
                  <Stat label="No valid number" value={t.noNumber} />
                  <Stat label="No activity this week" value={t.inactive} />
                  <Stat label="Failed" value={t.failed} accent={t.failed ? "text-red-400" : undefined} />
                </div>
                <p className="text-slate-500 text-xs mt-4">
                  Daily limit: {data.settings.dailyLimit} different parents per 24 hours (Meta’s limit for the account). If there are more, the rest are sent the next time you run this.
                </p>
              </div>

              {/* Automatic weekly sending */}
              <div className="bg-[#16213e] border border-white/10 rounded-2xl p-5 mb-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-white font-bold">Automatic weekly sending</h2>
                    <p className="text-slate-400 text-xs mt-1">
                      When ON, the server sends the reports by itself every Sunday evening (and finishes any left over on Monday and Tuesday). Only verified parents are messaged.
                    </p>
                  </div>
                  <button onClick={toggleAuto} disabled={autoBusy}
                    className={`shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60 ${data.autoEnabled ? "bg-green-600 text-white" : "bg-white/10 text-slate-300"}`}>
                    {autoBusy ? "…" : data.autoEnabled ? "ON" : "OFF"}
                  </button>
                </div>
                {data.autoEnabled && data.settings.dryRun && (
                  <p className="text-yellow-400 text-xs mt-3">Automatic sending is ON but the server is still in dry-run, so nothing will be sent yet.</p>
                )}
                {!data.settings.otpConfigured && (
                  <p className="text-yellow-400 text-xs mt-2">The verification-code template isn’t set on the server, so parents can’t be verified for live sending yet.</p>
                )}
              </div>

              {/* Samples */}
              {data.samples.length > 0 && (
                <div className="bg-[#16213e] border border-white/10 rounded-2xl p-5 mb-6">
                  <h2 className="text-white font-bold mb-3">Sample messages</h2>
                  <div className="space-y-3">
                    {data.samples.map((s, i) => (
                      <div key={i} className="bg-[#0f1a14] border border-green-500/20 rounded-xl p-4">
                        <div className="text-green-400 text-xs mb-2">{s.studentName}{s.to ? ` → ${s.to}` : ""}</div>
                        <pre className="text-slate-200 text-sm whitespace-pre-wrap font-sans">{s.text}</pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Test */}
              <div className="bg-[#16213e] border border-white/10 rounded-2xl p-5 mb-6">
                <h2 className="text-white font-bold mb-1">Send a test to my number</h2>
                <p className="text-slate-400 text-xs mb-3">Sends one sample report with made-up numbers. Nothing is saved.</p>
                <div className="flex flex-wrap gap-2">
                  <input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="+91 98765 43210"
                    className="flex-1 min-w-[200px] bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl px-4 py-2.5 text-white text-sm outline-none" />
                  <button onClick={sendTest} disabled={testing || !testTo.trim()}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2">
                    {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send test
                  </button>
                </div>
                {testMsg && <pre className="mt-3 text-sm text-slate-200 whitespace-pre-wrap font-sans bg-white/5 rounded-xl p-3">{testMsg}</pre>}
              </div>

              {/* Send */}
              <div className="bg-[#16213e] border border-white/10 rounded-2xl p-5">
                <h2 className="text-white font-bold mb-3">Send this week’s reports</h2>
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => setConfirm("send")} disabled={running || t.ready === 0}
                    className="px-6 py-3 rounded-xl font-semibold text-white text-sm disabled:opacity-50 flex items-center gap-2"
                    style={{ background: "linear-gradient(135deg,#16a34a,#22c55e)" }}>
                    {running ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {data.settings.dryRun ? `Preview send (${t.ready})` : `Send to ${t.ready} parent${t.ready === 1 ? "" : "s"}`}
                  </button>
                  {t.failed > 0 && (
                    <button onClick={() => setConfirm("retry")} disabled={running}
                      className="px-5 py-3 rounded-xl font-semibold text-white text-sm bg-white/10 hover:bg-white/15 disabled:opacity-50">
                      Retry {t.failed} failed
                    </button>
                  )}
                  {running && <button onClick={() => { stop.current = true; }} className="px-5 py-3 rounded-xl text-sm text-slate-300 bg-white/5">Stop after this batch</button>}
                </div>
                {log.length > 0 && <pre className="mt-4 text-xs text-slate-300 whitespace-pre-wrap font-mono bg-black/30 rounded-xl p-3">{log.join("\n")}</pre>}
              </div>

              {data.recentFailures.length > 0 && (
                <div className="mt-6 bg-red-500/5 border border-red-500/20 rounded-2xl p-5">
                  <h2 className="text-red-400 font-bold mb-2 flex items-center gap-2"><AlertTriangle size={16} /> Recent failures</h2>
                  <ul className="text-xs text-slate-300 space-y-1">
                    {data.recentFailures.map((f, i) => <li key={i}>…{f.toLast4 || "????"}: {f.error || "failed"}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {confirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.75)" }}
            onClick={(e) => e.target === e.currentTarget && setConfirm(null)}>
            <div className="w-full max-w-md rounded-2xl p-6 bg-[#16213e] border border-white/10">
              <h3 className="text-white font-bold text-lg mb-2">{data?.settings.dryRun ? "Preview only" : "Send to parents?"}</h3>
              <p className="text-slate-300 text-sm mb-5">
                {data?.settings.dryRun
                  ? "The server is in dry-run mode: nothing will be sent. You will see how many messages would go out."
                  : `This sends a real WhatsApp message to ${confirm === "retry" ? t?.failed : t?.ready} parent(s) for ${data?.week.label}. Each message is billed by Meta. This can’t be undone.`}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirm(null)} className="flex-1 py-2.5 rounded-xl text-sm text-slate-300 bg-white/5">Cancel</button>
                <button onClick={() => runSend(confirm === "retry")} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700">
                  {data?.settings.dryRun ? "Run preview" : "Yes, send"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="bg-white/5 rounded-xl p-3">
      <div className={`text-2xl font-extrabold ${accent || "text-white"}`}>{value}</div>
      <div className="text-slate-400 text-xs mt-0.5">{label}</div>
    </div>
  );
}

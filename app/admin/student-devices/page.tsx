"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Search, Smartphone, Monitor, Unlink, RotateCcw } from "lucide-react";
import Navbar from "@/components/Navbar";

interface Device {
  deviceId: string; kind: string; name: string; platform: string; appVersion: string;
  createdAt: string; lastSeenAt: string; active: boolean; revokedAt: string | null; revokedBy: string | null;
}
interface DeviceEvent { action: string; kind: string; actor: string; detail: string; createdAt: string }
interface Detail {
  user: { id: string; name: string; email: string };
  devices: Device[];
  events: DeviceEvent[];
  switchesLeft: { mobile: number; desktop: number; any: number };
  settings: { enabled: boolean; blockOldApps: boolean; switchLimit: number; windowDays: number; mode: "single" | "per-kind" };
}

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
const ACTIONS: Record<string, string> = {
  register: "Signed in on a new device",
  switch: "Replaced a device",
  admin_unlink: "Admin unlinked a device",
  admin_reset: "Admin reset all devices",
};

export default function StudentDevicesPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; email: string }[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setToken(localStorage.getItem("token") || "");
    try { setAllowed(JSON.parse(localStorage.getItem("user") || "{}").role === "super-admin"); }
    catch { setAllowed(false); }
  }, []);

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {}) } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) throw new Error(json.message || `Request failed (${res.status})`);
    return json;
  }, [token]);

  const search = async () => {
    setBusy(true); setError(""); setMsg(""); setDetail(null);
    try {
      const r = await api(`/api/admin/student-devices?q=${encodeURIComponent(q.trim())}`);
      setResults(r.users);
      if (!r.users.length) setMsg("No student found.");
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };

  const open = async (userId: string) => {
    setBusy(true); setError(""); setMsg("");
    try { setDetail(await api(`/api/admin/student-devices?userId=${encodeURIComponent(userId)}`)); }
    catch (e) { setError((e as Error).message); }
    setBusy(false);
  };

  const unlink = async (deviceId: string | null) => {
    if (!detail) return;
    const text = deviceId
      ? "Unlink this device? It will be signed out, and the student can sign in on a new one."
      : "Unlink ALL devices of this student and reset the switch count? Every device will be signed out.";
    if (!window.confirm(text)) return;
    setBusy(true); setError(""); setMsg("");
    try {
      const r = await api("/api/admin/student-devices", {
        method: "POST",
        body: JSON.stringify(deviceId ? { userId: detail.user.id, deviceId } : { userId: detail.user.id, all: true }),
      });
      setDetail({ ...detail, ...r });
      setMsg(deviceId ? "Device unlinked." : "All devices unlinked and the switch count was reset.");
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };

  if (allowed === false) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-white"><Navbar />
        <p className="p-10 text-center text-slate-400">Only super-admins can open this page.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 pt-24 pb-16">
        <button onClick={() => router.push("/admin/dashboard")} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6">
          <ArrowLeft size={16} /> Back to dashboard
        </button>
        <h1 className="text-2xl font-bold mb-1">Student devices</h1>
        <p className="text-slate-400 text-sm mb-6">
          Each student can use one device at a time (a phone or a computer). Unlink a device when a student lost their phone or can&apos;t switch any more.
        </p>

        <div className="flex gap-2 mb-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && q.trim().length >= 2) search(); }}
            placeholder="Student email or name"
            className="flex-1 px-4 py-3 rounded-xl bg-[#16213e] border border-white/10 focus:border-purple-500 outline-none text-sm" />
          <button onClick={search} disabled={busy || q.trim().length < 2}
            className="px-5 py-3 rounded-xl bg-purple-600 disabled:opacity-50 flex items-center gap-2 text-sm font-semibold">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Search
          </button>
        </div>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
        {msg && <p className="mb-4 text-sm text-green-400">{msg}</p>}

        {!detail && results.length > 0 && (
          <div className="rounded-2xl border border-white/10 divide-y divide-white/5 mb-6">
            {results.map((u) => (
              <button key={u.id} onClick={() => open(u.id)} className="w-full text-left px-4 py-3 hover:bg-white/5">
                <span className="block text-sm font-semibold">{u.name || "(no name)"}</span>
                <span className="block text-xs text-slate-400">{u.email}</span>
              </button>
            ))}
          </div>
        )}

        {detail && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold">{detail.user.name || "(no name)"}</p>
                <p className="text-xs text-slate-400">{detail.user.email}</p>
              </div>
              <button onClick={() => setDetail(null)} className="text-xs text-slate-400 hover:text-white">Back to results</button>
            </div>

            <p className="text-xs text-slate-400">
              {detail.settings.mode === "single"
                ? `One device in total (phone or computer). Device changes left in this ${detail.settings.windowDays}-day period: ${detail.switchesLeft.any} of ${detail.settings.switchLimit}.`
                : `Switches left (every ${detail.settings.windowDays} days): phone ${detail.switchesLeft.mobile} of ${detail.settings.switchLimit}, computer ${detail.switchesLeft.desktop} of ${detail.settings.switchLimit}.`}
              {!detail.settings.enabled && " The device limit is currently switched OFF on the server."}
            </p>

            <div className="rounded-2xl border border-white/10 divide-y divide-white/5">
              {detail.devices.length === 0 && <p className="p-4 text-sm text-slate-400">No devices registered yet.</p>}
              {detail.devices.map((d) => (
                <div key={d.deviceId} className="p-4 flex items-center gap-3">
                  {d.kind === "mobile" ? <Smartphone size={20} className="text-purple-400" /> : <Monitor size={20} className="text-purple-400" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{d.name || (d.kind === "mobile" ? "Phone" : "Computer")}</p>
                    <p className="text-xs text-slate-400">
                      {d.kind === "mobile" ? "Phone/tablet" : "Computer"}{d.platform ? ` · ${d.platform}` : ""}{d.appVersion ? ` · app ${d.appVersion}` : ""}
                    </p>
                    <p className="text-xs text-slate-500">First used {fmt(d.createdAt)} · last used {fmt(d.lastSeenAt)}</p>
                    {!d.active && d.revokedAt && (
                      <p className="text-xs text-amber-400">Signed out {fmt(d.revokedAt)} ({d.revokedBy === "switch" ? "replaced by the student" : "by an admin"})</p>
                    )}
                  </div>
                  {d.active ? (
                    <button onClick={() => unlink(d.deviceId)} disabled={busy}
                      className="px-3 py-2 rounded-lg border border-red-500/40 text-red-300 text-xs flex items-center gap-1 disabled:opacity-50">
                      <Unlink size={14} /> Unlink
                    </button>
                  ) : <span className="text-xs text-slate-500">Inactive</span>}
                </div>
              ))}
            </div>

            <button onClick={() => unlink(null)} disabled={busy}
              className="w-full py-3 rounded-xl border border-red-500/40 text-red-300 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              <RotateCcw size={16} /> Reset all devices and the switch count
            </button>

            {detail.events.length > 0 && (
              <div>
                <p className="text-sm font-bold mb-2">History</p>
                <ul className="space-y-1">
                  {detail.events.map((e, i) => (
                    <li key={i} className="text-xs text-slate-400">
                      {fmt(e.createdAt)} · {ACTIONS[e.action] ?? e.action}{e.detail ? ` · ${e.detail}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

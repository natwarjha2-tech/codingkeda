"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Page header used by every Profile sub-page (same look as the desktop app). */
export function PageHeader({ icon, title, sub, right, back = "/my/profile" }: { icon: React.ReactNode; title: React.ReactNode; sub?: string; right?: React.ReactNode; back?: string | null }) {
  return (
    <div className="relative mb-5 overflow-hidden rounded-2xl border border-violet-400/15 bg-[#12121f]/90 p-5 md:p-6">
      <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-violet-600/10 blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {back && <Link href={back} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:bg-violet-500/20" aria-label="Back"><ArrowLeft size={16} /></Link>}
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-400/25 bg-violet-500/10 text-xl">{icon}</div>
          <div>
            <h1 className="text-xl font-extrabold md:text-2xl">{title}</h1>
            {sub && <p className="text-sm text-slate-400">{sub}</p>}
          </div>
        </div>
        {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
      </div>
    </div>
  );
}

export function Panel({ title, icon, sub, right, children, className = "" }: { title?: React.ReactNode; icon?: React.ReactNode; sub?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-[#161626]/75 p-5 ${className}`}>
      {(title || right) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {icon && <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-sm">{icon}</span>}
            <div>
              <div className="font-bold">{title}</div>
              {sub && <div className="text-xs text-slate-500">{sub}</div>}
            </div>
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; color: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#161626]/75 p-4">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl text-lg" style={{ background: `${color}18`, color }}>{icon}</div>
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-sm font-semibold text-slate-300">{label}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function Loading({ text = "Loading…" }: { text?: string }) {
  return <div className="py-14 text-center text-slate-400">⏳ {text}</div>;
}

export function EmptyState({ icon, title, text, action }: { icon: string; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-400/15 bg-violet-500/10 text-3xl">{icon}</div>
      <div className="font-bold">{title}</div>
      {text && <div className="mx-auto mt-1 max-w-sm text-sm text-slate-400">{text}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stars({ value, size = "text-lg" }: { value: number; size?: string }) {
  return <span className={size}>{[1, 2, 3, 4, 5].map((i) => <span key={i} className={i <= Math.round(value) ? "text-amber-400" : "text-white/15"}>★</span>)}</span>;
}

export function Bar({ pct, from = "from-violet-500", to = "to-pink-500", h = "h-2" }: { pct: number; from?: string; to?: string; h?: string }) {
  return <div className={`${h} overflow-hidden rounded-full bg-white/10`}><div className={`h-full rounded-full bg-gradient-to-r ${from} ${to}`} style={{ width: `${Math.max(0, Math.min(100, pct || 0))}%` }} /></div>;
}

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
export const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} • ${d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}`;
};
export const btn = "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition";

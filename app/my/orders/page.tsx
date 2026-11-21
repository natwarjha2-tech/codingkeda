"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { api } from "../api";
import { EmptyState, Kpi, Loading, PageHeader, fmtDateTime } from "@/components/my/ui";

type Order = { id: string; courseId?: string | null; courseTitle: string; amount: number; status: string; createdAt: string };
const PER = 6;

export default function OrdersPage() {
  const [data, setData] = useState<{ orders: Order[]; totalSpent: number } | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<"latest" | "oldest">("latest");
  const [page, setPage] = useState(1);

  useEffect(() => { api("/api/student/orders").then((d) => setData({ orders: d.orders || [], totalSpent: d.totalSpent || 0 })).catch(() => setData({ orders: [], totalSpent: 0 })); }, []);

  const num = useMemo(() => {
    const m = new Map<string, number>();
    [...(data?.orders || [])].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)).forEach((o, i) => m.set(o.id, i + 1));
    return m;
  }, [data]);
  const oid = (o: Order) => `#CKD-ORD-${String(num.get(o.id) || 0).padStart(4, "0")}`;

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    const isId = /[0-9#]/.test(s) || s.includes("ord") || s.includes("ckd");
    return (data?.orders || [])
      .filter((o) => filter === "all" || (filter === "pending" ? o.status !== "success" && o.status !== "failed" : o.status === filter))
      .filter((o) => !s || o.courseTitle.toLowerCase().includes(s) || (isId && oid(o).toLowerCase().includes(s.replace(/\s+/g, ""))))
      .sort((a, b) => (sort === "oldest" ? +new Date(a.createdAt) - +new Date(b.createdAt) : +new Date(b.createdAt) - +new Date(a.createdAt)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, q, filter, sort, num]);

  useEffect(() => setPage(1), [q, filter, sort]);

  const header = (
    <PageHeader icon="🧾" title="My Orders" sub="Your purchase history and subscription details"
      right={<>
        <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search orders..." className="rounded-xl border border-white/10 bg-white/5 py-2 pl-8 pr-3 text-sm outline-none focus:border-violet-400" /></div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-xl border border-white/10 bg-[#1a1a2e] px-3 py-2 text-sm">
          <option value="all">All Orders</option><option value="success">Successful</option><option value="pending">Pending</option><option value="failed">Failed</option>
        </select>
      </>} />
  );
  if (!data) return <div className="mx-auto max-w-4xl pt-2">{header}<Loading text="Loading orders..." /></div>;
  if (data.orders.length === 0) {
    return <div className="mx-auto max-w-4xl pt-2">{header}<EmptyState icon="🛍️" title="No orders yet" text="Your purchased courses will appear here." action={<Link href="/my/courses" className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold">Explore Courses</Link>} /></div>;
  }

  const success = data.orders.filter((o) => o.status === "success").length;
  const pages = Math.max(1, Math.ceil(filtered.length / PER));
  const cur = Math.min(page, pages);
  const show = filtered.slice((cur - 1) * PER, cur * PER);

  return (
    <div className="mx-auto max-w-4xl space-y-5 pt-2">
      {header}
      <div className="grid grid-cols-3 gap-3">
        <Kpi icon="🛍️" color="#22c55e" label="Purchased" value={success} sub="Total orders" />
        <Kpi icon="👛" color="#ec4899" label="Total Spent" value={`₹${data.totalSpent}`} sub="Across all orders" />
        <Kpi icon="⏳" color="#f59e0b" label="Pending" value={data.orders.length - success} sub="Awaiting completion" />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold">Order History</span>
        <label className="flex items-center gap-2 text-xs text-slate-500">Sort by:
          <select value={sort} onChange={(e) => setSort(e.target.value as "latest" | "oldest")} className="rounded-lg border border-white/10 bg-[#1a1a2e] px-2 py-1 text-sm text-white"><option value="latest">Latest First</option><option value="oldest">Oldest First</option></select>
        </label>
      </div>
      {show.length === 0 ? <EmptyState icon="🔍" title="No orders found" text="Try a different search term or change the filter." /> : (
        <div className="space-y-3">
          {show.map((o) => {
            const ok = o.status === "success", bad = o.status === "failed";
            const c = ok ? "#22c55e" : bad ? "#ef4444" : "#f59e0b";
            return (
              <div key={o.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-[#161626]/75 p-4" style={{ borderLeft: `3px solid ${c}` }}>
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-xl">{/java(?!script)/i.test(o.courseTitle) ? "☕" : /python/i.test(o.courseTitle) ? "🐍" : "📘"}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{o.courseTitle}</div>
                  <div className="text-xs text-slate-400">Order ID: {oid(o)}</div>
                  <div className="text-xs text-slate-500">📅 {fmtDateTime(o.createdAt)}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-extrabold">₹{o.amount}</div>
                  <span className="rounded-full border px-2.5 py-0.5 text-[11px] font-bold" style={{ color: c, borderColor: `${c}40`, background: `${c}15` }}>{ok ? "✓ Successful" : bad ? "✗ Failed" : "● Pending"}</span>
                </div>
                <Link href={o.courseId ? `/my/courses/${o.courseId}` : "/my/courses"} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/5">View Details ›</Link>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>Showing {filtered.length ? (cur - 1) * PER + 1 : 0} to {Math.min(cur * PER, filtered.length)} of {filtered.length} orders</span>
        {pages > 1 && (
          <div className="flex gap-1">
            <button disabled={cur <= 1} onClick={() => setPage(cur - 1)} className="rounded-lg border border-white/10 px-2.5 py-1 disabled:opacity-40">‹</button>
            {Array.from({ length: pages }, (_, i) => <button key={i} onClick={() => setPage(i + 1)} className={`rounded-lg border px-2.5 py-1 ${cur === i + 1 ? "border-violet-400 bg-violet-500/20 text-white" : "border-white/10"}`}>{i + 1}</button>)}
            <button disabled={cur >= pages} onClick={() => setPage(cur + 1)} className="rounded-lg border border-white/10 px-2.5 py-1 disabled:opacity-40">›</button>
          </div>
        )}
      </div>
    </div>
  );
}

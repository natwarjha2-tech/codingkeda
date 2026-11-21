"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getToken } from "@/services/auth";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function useAuthed<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "login" | "error">("loading");
  useEffect(() => {
    const token = getToken();
    if (!token) { setState("login"); return; }
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (r.status === 401) { setState("login"); return; }
        const d = await r.json();
        if (!d?.success) { setState("error"); return; }
        setData(d); setState("ready");
      })
      .catch(() => setState("error"));
  }, [url]);
  return { data, state };
}

function Gate({ state, back }: { state: string; back: string }) {
  if (state === "loading") return <div className="h-48 rounded-[28px] bg-[#F3F0FF] animate-pulse" />;
  if (state === "login") return (
    <div className="rounded-[28px] bg-white border-2 border-[#EDE9FE] p-8 text-center">
      <div className="text-5xl">🔐</div>
      <p className="mt-3 text-xl font-black">Please log in to see this page</p>
      <Link href={`/login?redirect=${encodeURIComponent(back)}`} className="mt-4 inline-block rounded-2xl bg-[#7C3AED] px-6 py-3 font-black text-white">Log in</Link>
    </div>
  );
  return <p className="rounded-2xl bg-[#FFE4E6] p-4 font-bold text-[#BE123C]">Could not load this right now. Please refresh the page.</p>;
}

function AccountTabs({ active }: { active: "subscription" | "billing" }) {
  const tab = (id: string, label: string, href: string) => (
    <Link href={href} className={`rounded-full px-5 py-2 font-extrabold border-2 ${active === id ? "bg-[#7C3AED] border-[#7C3AED] text-white" : "bg-white border-[#E5E7EB]"}`}>{label}</Link>
  );
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {tab("profile", "👤 Profile", "/profile")}
      {tab("subscription", "⭐ Subscription", "/account/subscription")}
      {tab("billing", "🧾 Billing", "/account/billing")}
      <Link href="/dashboard" className="rounded-full px-5 py-2 font-extrabold border-2 bg-white border-[#E5E7EB]">🏠 Dashboard</Link>
    </div>
  );
}

type SubResp = { subscription: { plan: string; status: string; memberSince: string | null; coursesEnrolled: number; totalSpent: number; lastPaymentDate: string | null;
  enrolledCourses: { courseId: string; title: string; enrolledAt: string; accessEndsAt: string | null; plan: string | null }[] } };

export function SubscriptionPanel() {
  const { data, state } = useAuthed<SubResp>("/api/student/subscription");
  return (
    <>
      <AccountTabs active="subscription" />
      {state !== "ready" || !data ? <Gate state={state} back="/account/subscription" /> : (() => {
        const s = data.subscription;
        const now = Date.now();
        return (
          <div className="space-y-5">
            <div className={`rounded-[28px] border-2 border-b-8 p-6 ${s.status === "active" ? "bg-[#DCFCE7] border-[#86EFAC]" : "bg-[#FEF3C7] border-[#FDE68A]"}`}>
              <p className="text-sm font-black uppercase tracking-wider text-[#6B7280]">Current plan</p>
              <h2 className="mt-1 text-3xl font-black">{s.status === "active" ? "✅ Active" : "No active plan"}</h2>
              <p className="mt-1 text-[#374151]">
                {s.coursesEnrolled} course{s.coursesEnrolled === 1 ? "" : "s"}
                {s.memberSince ? ` · member since ${fmt(s.memberSince)}` : ""}
                {s.lastPaymentDate ? ` · last payment ${fmt(s.lastPaymentDate)}` : ""}
              </p>
              <p className="mt-2 text-sm text-[#6B7280]">Plans are paid once and do not renew by themselves.</p>
              <Link href="/pricing" className="mt-4 inline-block rounded-2xl bg-[#7C3AED] px-5 py-3 font-black text-white">{s.status === "active" ? "Extend or add a plan" : "Choose a plan"}</Link>
            </div>
            <div className="rounded-[28px] bg-white border-2 border-[#EDE9FE] p-6">
              <h3 className="text-xl font-black">My courses</h3>
              {s.enrolledCourses.length === 0 ? <p className="mt-2 text-[#6B7280]">No courses yet.</p> : (
                <ul className="mt-4 space-y-2">
                  {s.enrolledCourses.map((e) => {
                    const expired = !!e.accessEndsAt && new Date(e.accessEndsAt).getTime() <= now;
                    return (
                      <li key={e.courseId} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#FAFAFF] px-4 py-3">
                        <span className="font-black">{e.title}</span>
                        <span className={`text-sm font-bold ${expired ? "text-[#BE123C]" : "text-[#15803D]"}`}>
                          {expired ? `Ended ${fmt(e.accessEndsAt!)}` : e.accessEndsAt ? `Active until ${fmt(e.accessEndsAt)}` : "Active (no end date)"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
}

type OrdersResp = { orders: { id: string; courseTitle: string; amount: number; status: string; razorpayOrderId: string; razorpayPaymentId: string | null; createdAt: string }[]; totalSpent: number; totalOrders: number };

const STATUS: Record<string, string> = { success: "bg-[#DCFCE7] text-[#15803D]", pending: "bg-[#FEF3C7] text-[#B45309]", failed: "bg-[#FFE4E6] text-[#BE123C]", refunded: "bg-[#E0F2FE] text-[#0369A1]" };

export function BillingPanel() {
  const { data, state } = useAuthed<OrdersResp>("/api/student/orders?page=1&limit=50");
  return (
    <>
      <AccountTabs active="billing" />
      {state !== "ready" || !data ? <Gate state={state} back="/account/billing" /> : (
        <div className="rounded-[28px] bg-white border-2 border-[#EDE9FE] p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-black">Payment history</h2>
            <p className="font-bold text-[#6B7280]">Total paid: <b className="text-[#1E1B4B]">₹{data.totalSpent.toLocaleString("en-IN")}</b></p>
          </div>
          {data.orders.length === 0 ? <p className="mt-4 text-[#6B7280]">No payments yet.</p> : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="text-[#6B7280]"><th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Plan</th><th className="py-2 pr-4">Amount</th><th className="py-2 pr-4">Status</th><th className="py-2">Order / Payment ID</th></tr></thead>
                <tbody>
                  {data.orders.map((o) => (
                    <tr key={o.id} className="border-t border-[#F3F4F6]">
                      <td className="py-3 pr-4 whitespace-nowrap">{fmt(o.createdAt)}</td>
                      <td className="py-3 pr-4 font-bold">{o.courseTitle}</td>
                      <td className="py-3 pr-4 font-bold">₹{o.amount.toLocaleString("en-IN")}</td>
                      <td className="py-3 pr-4"><span className={`rounded-full px-3 py-1 text-xs font-black capitalize ${STATUS[o.status] ?? "bg-[#F3F4F6]"}`}>{o.status}</span></td>
                      <td className="py-3 font-mono text-xs text-[#6B7280] break-all">{o.razorpayOrderId}{o.razorpayPaymentId ? <><br />{o.razorpayPaymentId}</> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-4 text-sm text-[#6B7280]">A payment stuck on “pending” unlocks by itself once the bank confirms. Questions? <Link href="/contact" className="underline font-bold">Contact us</Link>.</p>
        </div>
      )}
    </>
  );
}

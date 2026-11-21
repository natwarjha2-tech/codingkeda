"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getToken } from "@/services/auth";

type Mode = "success" | "pending" | "failed";
type Order = { razorpayOrderId: string; status: string; courseTitle: string; amount: number; razorpayPaymentId: string | null; createdAt: string };

/**
 * Shows the real state of an order. Access is only granted by the verified
 * Razorpay webhook on the server; this page just reads /api/student/orders
 * and waits until the order is marked "success".
 */
export default function PaymentStatus({ mode }: { mode: Mode }) {
  const params = useSearchParams();
  const orderId = params.get("order");
  const courseId = params.get("courseId");
  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState<"checking" | "success" | "pending" | "failed" | "unknown" | "login">(mode === "failed" ? "failed" : "checking");
  const tries = useRef(0);

  useEffect(() => {
    const token = getToken();
    if (!token) { setStatus("login"); return; }
    let timer: ReturnType<typeof setTimeout>;
    let stop = false;

    const check = async () => {
      try {
        const res = await fetch("/api/student/orders?page=1&limit=10", { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        const list: Order[] = data?.orders ?? [];
        const o = orderId ? list.find((x) => x.razorpayOrderId === orderId) ?? null : list[0] ?? null;
        if (stop) return;
        setOrder(o);
        if (o?.status === "success") { setStatus("success"); return; }
        if (o?.status === "failed") { setStatus("failed"); return; }
        if (mode === "failed" && !o) { setStatus("failed"); return; }
      } catch { /* keep trying */ }
      tries.current += 1;
      // Check every 3 s for about a minute, then show the pending state.
      if (tries.current < 20) timer = setTimeout(check, 3000);
      else setStatus(mode === "failed" ? "failed" : "pending");
    };
    check();
    return () => { stop = true; clearTimeout(timer); };
  }, [orderId, mode]);

  const retryHref = courseId ? `/payment?courseId=${encodeURIComponent(courseId)}` : "/payment";

  return (
    <div className="max-w-xl mx-auto">
      {status === "checking" && (
        <Card tone="blue" emoji="⏳" title="Confirming your payment…" text="We are waiting for the bank to confirm. This usually takes a few seconds. Please keep this page open." />
      )}
      {status === "success" && (
        <Card tone="green" emoji="🎉" title="Payment successful! Your plan is active" text={`${order?.courseTitle ?? "Your course"} is unlocked. Open the CodingKida app to start learning.`}>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/dashboard" className="rounded-2xl bg-[#7C3AED] px-6 py-3 font-black text-white border-b-[5px] border-[#5B21B6]">Go to my dashboard</Link>
            <Link href="/download" className="rounded-2xl bg-white px-6 py-3 font-black text-[#6D28D9] border-2 border-[#DDD6FE]">Get the app</Link>
          </div>
        </Card>
      )}
      {status === "pending" && (
        <Card tone="amber" emoji="🕒" title="Payment is still being confirmed" text="Some banks take a few minutes. Your course unlocks automatically once the payment is confirmed. You do not need to pay again.">
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button onClick={() => window.location.reload()} className="rounded-2xl bg-[#F59E0B] px-6 py-3 font-black text-white border-b-[5px] border-[#B45309]">Check again</button>
            <Link href="/account/billing" className="rounded-2xl bg-white px-6 py-3 font-black text-[#B45309] border-2 border-[#FDE68A]">See my payments</Link>
            <Link href="/contact" className="rounded-2xl bg-white px-6 py-3 font-black text-[#6B7280] border-2 border-[#E5E7EB]">Contact support</Link>
          </div>
        </Card>
      )}
      {status === "failed" && (
        <Card tone="red" emoji="😕" title="Payment did not go through" text="No money was taken for a failed payment. If money left your account, it is usually returned by your bank within a few days.">
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href={retryHref} className="rounded-2xl bg-[#7C3AED] px-6 py-3 font-black text-white border-b-[5px] border-[#5B21B6]">Try again</Link>
            <Link href="/contact" className="rounded-2xl bg-white px-6 py-3 font-black text-[#6B7280] border-2 border-[#E5E7EB]">Contact support</Link>
          </div>
        </Card>
      )}
      {status === "login" && (
        <Card tone="blue" emoji="🔐" title="Please log in" text="Log in to see the status of your payment.">
          <div className="mt-5 text-center">
            <Link href={`/login?redirect=${encodeURIComponent(`/payment/${mode}${orderId ? `?order=${orderId}` : ""}`)}`} className="rounded-2xl bg-[#7C3AED] px-6 py-3 font-black text-white">Log in</Link>
          </div>
        </Card>
      )}

      {order && status !== "login" && (
        <div className="mt-6 rounded-[24px] bg-white border-2 border-[#EDE9FE] p-5">
          <h2 className="font-black">Order summary</h2>
          <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-[#6B7280]">Plan</dt><dd className="font-bold text-right">{order.courseTitle}</dd>
            <dt className="text-[#6B7280]">Amount</dt><dd className="font-bold text-right">₹{order.amount.toLocaleString("en-IN")}</dd>
            <dt className="text-[#6B7280]">Order ID</dt><dd className="font-mono text-xs text-right break-all">{order.razorpayOrderId}</dd>
            {order.razorpayPaymentId && (<><dt className="text-[#6B7280]">Payment ID</dt><dd className="font-mono text-xs text-right break-all">{order.razorpayPaymentId}</dd></>)}
            <dt className="text-[#6B7280]">Status</dt><dd className="font-black text-right capitalize">{order.status}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}

function Card({ tone, emoji, title, text, children }: { tone: "green" | "amber" | "red" | "blue"; emoji: string; title: string; text: string; children?: React.ReactNode }) {
  const t = {
    green: "bg-[#DCFCE7] border-[#86EFAC]",
    amber: "bg-[#FEF3C7] border-[#FDE68A]",
    red: "bg-[#FFE4E6] border-[#FDA4AF]",
    blue: "bg-[#E0F2FE] border-[#BAE6FD]",
  }[tone];
  return (
    <div className={`${t} rounded-[28px] border-2 border-b-8 p-8 text-center`}>
      <div className="text-6xl">{emoji}</div>
      <h1 className="mt-3 text-2xl md:text-3xl font-black">{title}</h1>
      <p className="mt-2 text-[#374151]">{text}</p>
      {children}
    </div>
  );
}

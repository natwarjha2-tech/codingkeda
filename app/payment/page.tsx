"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Shield, Loader2, CheckCircle, ArrowRight, AlertCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import { priceFor, rupees, COUPON_MAX_PERCENT } from "@/app/lib/pricing";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const ZENALPHA_FEATURES = [
  "4 subjects: AI, Cyber Safety, Robotics and GreenTech",
  "Live mentor support and doubt sessions",
  "Quizzes, exercises, projects and coins",
  "Certificate on completion",
  "3 months of full access",
  "Works on the website, mobile app and desktop app",
];
const COURSE_FEATURES = [
  "Full course: all lessons, notes and quizzes",
  "Live mentor support and doubt sessions",
  "Certificate on completion",
  "3 months of full access",
  "Works on the website, mobile app and desktop app",
];

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("ck_token") ||
    sessionStorage.getItem("ck_token") ||
    null
  );
}

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseIdParam = searchParams.get("courseId") || null;
  // Opened from the phone/desktop app: after paying, send the student back to the app.
  const fromApp = searchParams.get("from") === "app";
  // Opened from the PHONE app: after paying, jump back to it (this also closes the browser tab).
  const toMobileApp = fromApp && searchParams.get("return") === "mobile";
  const mobileReturnUrl = `codingkida://payment-done?status=success${courseIdParam ? `&courseId=${encodeURIComponent(courseIdParam)}` : ""}`;
  // A "package" link (no courseId) is the ZenAlpha bundle. A course link is that one subject,
  // unless the course is part of ZenAlpha (the server then sells ZenAlpha).
  const [courseTitle, setCourseTitle] = useState<string | null>(null);
  const [courseInBundle, setCourseInBundle] = useState(false);
  const isZenAlpha = !courseIdParam || courseInBundle;
  const planName = isZenAlpha ? "ZenAlpha" : courseTitle || "this course";
  const planTag = isZenAlpha ? "4 subjects in one plan" : "Single subject";
  const planEmoji = isZenAlpha ? "⚡" : "📘";
  const planFeatures = isZenAlpha ? ZENALPHA_FEATURES : COURSE_FEATURES;

  const [paying, setPaying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [enrollError, setEnrollError] = useState("");

  // Coupon available for this user (from CK Mall). The server caps it at 30%.
  type Discount = { id: string; percent: number; label: string; source: string };
  const [availableDiscount, setAvailableDiscount] = useState<Discount | null>(null);
  const [discountApplied, setDiscountApplied] = useState(false);

  const couponPct = discountApplied && availableDiscount ? availableDiscount.percent : 0;
  const price = priceFor(couponPct); // same numbers the server charges
  const finalPrice = price.finalPrice;

  useEffect(() => {
    const currentToken = getToken();

    // Server-side token validation — redirect to login if invalid/expired
    if (!currentToken) {
      const returnUrl = typeof window !== "undefined" ? window.location.href : "/payment";
      router.replace(`/login?redirect=${encodeURIComponent(returnUrl)}`);
      return;
    }

    // Verify token with server
    fetch("/api/student", { headers: { Authorization: `Bearer ${currentToken}` } })
      .then(res => {
        if (!res.ok) {
          // Token invalid/expired — redirect to login
          const returnUrl = typeof window !== "undefined" ? window.location.href : "/payment";
          router.replace(`/login?redirect=${encodeURIComponent(returnUrl)}`);
          return;
        }
        // Token valid — proceed
        setToken(currentToken);

        // Fetch any redeemed discount the user can apply to this purchase.
        fetch("/api/discount", { headers: { Authorization: `Bearer ${currentToken}` } })
          .then(r => r.json())
          .then(data => {
            if (data.success && data.discount) {
              setAvailableDiscount(data.discount as Discount);
              setDiscountApplied(true); // auto-apply the best available discount
            }
          })
          .catch(() => {});

        // What is being bought (title, and whether it is sold as ZenAlpha)
        if (courseIdParam) {
          fetch(`/api/courses/${encodeURIComponent(courseIdParam)}`, { headers: { Authorization: `Bearer ${currentToken}` } })
            .then(r => r.json())
            .then(data => {
              if (data.success && data.course) {
                setCourseTitle(data.course.title || null);
                setCourseInBundle(data.course.purchase?.plan === "zenalpha");
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        const returnUrl = typeof window !== "undefined" ? window.location.href : "/payment";
        router.replace(`/login?redirect=${encodeURIComponent(returnUrl)}`);
      });
  }, [courseIdParam, router]);

  const handlePayment = async () => {
    setEnrollError("");
    const currentToken = getToken();

    if (!currentToken) {
      const returnUrl = encodeURIComponent(window.location.href);
      router.push(`/login?redirect=${returnUrl}`);
      return;
    }

    setPaying(true);

    try {
      // Step 1: Create Razorpay order via backend
      const orderRes = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        // No amount: the server decides the price.
        body: JSON.stringify({
          plan: isZenAlpha ? "zenalpha" : "course",
          courseId: courseIdParam || undefined,
          discountId: couponPct > 0 && availableDiscount ? availableDiscount.id : undefined,
        }),
      });

      if (!orderRes.ok) {
        const errorData = await orderRes.json().catch(() => null);
        throw new Error(errorData?.message || "Failed to create payment order");
      }

      const orderData = await orderRes.json();
      if (!orderData.success) {
        throw new Error(orderData.message || "Order creation failed");
      }

      // Step 2: Open Razorpay Checkout Modal
      if (!window.Razorpay) {
        throw new Error("Razorpay script not loaded");
      }

      const razorpayOptions = {
        key: orderData.keyId,
        amount: orderData.amount * 100, // Convert to paisa
        currency: orderData.currency,
        name: "CodingKida",
        description: `${orderData.title || planName} - 3 months access`,
        order_id: orderData.orderId,
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          // Payment successful - webhook will handle enrollment
          setPaying(false);
          setSuccess(true);
          // The desktop app's payment window watches for this title and closes itself.
          if (fromApp) document.title = "Payment successful – CodingKida";
          // Phone app: show the success screen briefly, then go back to the app.
          if (toMobileApp) setTimeout(() => { window.location.href = mobileReturnUrl; }, 1500);
          // Website: show the verified status (access is granted only by the server webhook).
          if (!fromApp) {
            const q = new URLSearchParams({ order: response.razorpay_order_id || orderData.orderId });
            if (courseIdParam) q.set("courseId", courseIdParam);
            setTimeout(() => router.replace(`/payment/success?${q.toString()}`), 1500);
          }
        },
        prefill: {
          name: orderData.userName,
          email: orderData.userEmail,
        },
        theme: {
          color: "#7c3aed",
        },
        modal: {
          ondismiss: () => {
            setPaying(false);
            setEnrollError("Payment cancelled. Please try again.");
          },
        },
      };

      const razorpay = new window.Razorpay(razorpayOptions);
      // Website only: a failed payment opens the "Payment failed" page (apps keep their own flow).
      if (!fromApp && typeof razorpay.on === "function") {
        razorpay.on("payment.failed", () => {
          setPaying(false);
          const q = new URLSearchParams({ order: orderData.orderId });
          if (courseIdParam) q.set("courseId", courseIdParam);
          router.push(`/payment/failed?${q.toString()}`);
        });
      }
      razorpay.open();
    } catch (error) {
      setPaying(false);
      setEnrollError(
        error instanceof Error ? error.message : "Payment failed. Please try again."
      );
      console.error("Payment error:", error);
    }
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen flex items-center justify-center px-4 py-12 pt-24 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg,#0a0118 0%,#0d0221 60%,#0f0f1a 100%)" }}>

      {/* Blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle,rgba(124,58,237,0.12) 0%,transparent 70%)", filter: "blur(60px)" }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle,rgba(236,72,153,0.08) 0%,transparent 70%)", filter: "blur(60px)" }} />

      <AnimatePresence mode="wait">
        {success ? (
          /* ── Success Screen ── */
          <motion.div key="success"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="text-center relative z-10"
          >
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: "rgba(34,197,94,0.15)", border: "2px solid rgba(34,197,94,0.4)", boxShadow: "0 0 30px rgba(34,197,94,0.2)" }}
            >
              <CheckCircle size={40} className="text-green-400" />
            </motion.div>
            <h2 className="text-3xl font-extrabold text-white mb-2">Payment Successful! 🎉</h2>
            <p className="text-slate-400 text-sm mb-2">Welcome to <span className="text-purple-300 font-semibold">{planName}</span></p>
            {toMobileApp ? (
              <>
                <a
                  href={mobileReturnUrl}
                  className="inline-flex items-center justify-center gap-2 mt-4 w-full max-w-xs px-6 py-4 rounded-2xl font-bold text-white text-base"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)", boxShadow: "0 8px 28px rgba(124,58,237,0.45)" }}
                >
                  Open the CodingKida app <ArrowRight size={16} />
                </a>
                <p className="text-slate-500 text-xs mt-3">Your course is ready there.</p>
              </>
            ) : (
              <p className="text-slate-500 text-xs">
                {fromApp
                  ? "Close this window to go back to the CodingKida app. Your course unlocks in a few seconds."
                  : "Redirecting to your dashboard..."}
              </p>
            )}
            <div className="flex justify-center gap-1.5 mt-6">
              {[0,1,2].map(i => (
                <motion.div key={i}
                  animate={{ opacity: [0.3,1,0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  className="w-2 h-2 rounded-full bg-purple-400"
                />
              ))}
            </div>
          </motion.div>
        ) : (
          /* ── Payment Page ── */
          <motion.div key="payment"
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md relative z-10"
          >
            {/* Header — matches recommendation page */}
            <div className="flex items-center gap-2 mb-6">
              <Shield size={16} className="text-purple-400" />
              <p className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "rgba(167,139,250,0.8)" }}>
                Your Personalized Recommendation 🎯
              </p>
            </div>

            {/* Package card — same structure as recommendation page */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-3xl p-7 mb-5"
              style={{
                background: "linear-gradient(135deg,rgba(124,58,237,0.18),rgba(236,72,153,0.08))",
                border: "1px solid rgba(124,58,237,0.3)",
                backdropFilter: "blur(20px)",
                boxShadow: "0 24px 80px rgba(0,0,0,0.5), 0 0 40px rgba(124,58,237,0.3)",
              }}
            >
              {/* Course header */}
              <div className="flex items-center gap-4 mb-4 pb-4 border-b border-white/8">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                  style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)" }}>
                  {planEmoji}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-extrabold text-white">{planName}</h2>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(124,58,237,0.2)", color: "#c4b5fd" }}>
                    {planTag}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 line-through">{rupees(price.listPrice)}</p>
                  <p className="text-xl font-extrabold text-white">{rupees(price.price)}</p>
                  <span className="text-[10px] font-bold text-green-400">{price.offPercent}% OFF</span>
                </div>
              </div>

              <p className="text-slate-300 text-sm mb-5">3 months of full access. One payment, no auto-renewal.</p>

              {/* Features */}
              <ul className="space-y-2.5 mb-6">
                {planFeatures.map((f, i) => (
                  <motion.li key={i}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.06 }}
                    className="flex items-center gap-3 text-sm text-slate-300"
                  >
                    <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(124,58,237,0.25)" }}>
                      <Check size={10} strokeWidth={3} className="text-purple-300" />
                    </span>
                    {f}
                  </motion.li>
                ))}
              </ul>

              {/* Redeemed discount from CK Mall */}
              {availableDiscount && (
                <div
                  className="rounded-2xl px-4 py-3 mb-4"
                  style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg">🎟️</span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-green-400 truncate">
                          {Math.min(availableDiscount.percent, COUPON_MAX_PERCENT)}% coupon available
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {availableDiscount.label || "Redeemed from CK Mall"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDiscountApplied(v => !v)}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all"
                      style={
                        discountApplied
                          ? { background: "rgba(34,197,94,0.2)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.5)" }
                          : { background: "rgba(255,255,255,0.06)", color: "#cbd5e1", border: "1px solid rgba(255,255,255,0.15)" }
                      }
                    >
                      {discountApplied ? "Applied ✓" : "Apply"}
                    </button>
                  </div>
                  {discountApplied && (
                    <div className="mt-3 pt-3 flex items-center justify-between text-sm" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <span className="text-slate-300">Coupon ({price.couponPercent}%)</span>
                      <span className="font-bold text-green-400">-{rupees(price.couponOff)}</span>
                    </div>
                  )}
                </div>
              )}

              {enrollError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2 rounded-lg mb-4"
                >
                  <AlertCircle size={14} />
                  {enrollError}
                </motion.div>
              )}

              {!token && (
                <p className="text-amber-400 text-xs text-center mb-3">
                  🔒 You need to <span className="underline cursor-pointer" onClick={() => router.push(`/login?redirect=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '/payment')}`)}> log in</span> to purchase this course.
                </p>
              )}

              {/* Pay button */}
              <motion.button
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                whileHover={!paying ? { scale: 1.03, boxShadow: "0 12px 36px rgba(124,58,237,0.5)" } : {}}
                whileTap={!paying ? { scale: 0.97 } : {}}
                onClick={handlePayment}
                disabled={paying}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-white text-sm transition-all duration-200 disabled:opacity-70"
                style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)", boxShadow: "0 6px 24px rgba(124,58,237,0.35)" }}
              >
                {paying ? (
                  <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Loader2 size={16} />
                  </motion.div> Processing...</>
                ) : token ? (
                  <>Pay {rupees(finalPrice)} for 3 months <ArrowRight size={15} /></>
                ) : (
                  <>Login to Purchase <ArrowRight size={15} /></>
                )}
              </motion.button>
            </motion.div>

            {/* Footer — matches recommendation page */}
            <p className="text-center text-slate-600 text-xs">
              Not the right fit?{" "}
              <span onClick={() => router.back()} className="text-purple-400 cursor-pointer hover:underline">Go back</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      </main>
    </>
  );
}

export default function PaymentPage() {
  return (
    <Suspense>
      <PaymentContent />
    </Suspense>
  );
}

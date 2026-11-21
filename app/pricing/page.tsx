import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import KidsPage, { PageHeader } from "@/components/site/KidsPage";
import { getPublicCourse } from "@/app/services/home.service";
import { PLAN_LIST_PRICE, PLAN_OFF_PERCENT, PLAN_PRICE, ACCESS_DAYS, COUPON_MAX_PERCENT, ZENALPHA_NAME, rupees } from "@/app/lib/pricing";

export const metadata: Metadata = {
  title: "Plans and pricing | CodingKida",
  description: `One simple price: ${rupees(PLAN_PRICE)} for ${Math.round(ACCESS_DAYS / 30)} months of full access. Compare free and paid.`,
  alternates: { canonical: "/pricing" },
};

const months = Math.round(ACCESS_DAYS / 30);
type Props = { searchParams: Promise<{ course?: string }> };

const COMPARE: { f: string; free: string; paid: string }[] = [
  { f: "Free sample video lessons", free: "✅", paid: "✅" },
  { f: "Free tutorials, puzzles and code playground", free: "✅", paid: "✅" },
  { f: "Weekly coding challenge", free: "👀 View", paid: "✅ Solve + win" },
  { f: "Every lesson video in the course", free: "—", paid: "✅" },
  { f: "Quizzes after every lesson", free: "—", paid: "✅" },
  { f: "Coding exercises checked by the computer", free: "—", paid: "✅" },
  { f: "Medals, coins, XP and leaderboards", free: "—", paid: "✅" },
  { f: "Live classes with a teacher", free: "—", paid: "✅" },
  { f: "AI doubt helper (Codo)", free: "—", paid: "✅" },
  { f: "Download videos to learn offline", free: "—", paid: "✅" },
  { f: "Certificate when you finish", free: "—", paid: "✅" },
];

export default async function PricingPage({ searchParams }: Props) {
  await connection();
  const { course: courseId } = await searchParams;
  const course = courseId ? await getPublicCourse(courseId) : null;
  // A course that is part of ZenAlpha is sold as the ZenAlpha plan (same as the payment page).
  const singleHref = course ? `/payment?courseId=${encodeURIComponent(course.id)}` : "/courses";

  return (
    <KidsPage>
      <PageHeader
        badge="💳 Simple, fair prices"
        title={<>One price. <span className="text-[#7C3AED]">Everything</span> unlocked.</>}
        text={`Pay once for ${months} months of full access. No monthly bills, and it does not renew by itself.`}
      />

      <section className="px-5 py-12">
        <div className="max-w-5xl mx-auto">
          {course && (
            <p className="mb-6 rounded-2xl bg-[#F5F3FF] border-2 border-[#DDD6FE] px-5 py-3 font-bold text-center">
              You picked <b>{course.title}</b>{course.inZenAlpha ? ` — it is part of the ${ZENALPHA_NAME} plan.` : "."}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <PlanCard
              highlight
              badge="⭐ Best value"
              title={`${ZENALPHA_NAME} plan ⚡`}
              text="4 subjects in one plan: AI, Cyber Safety, Robotics and GreenTech."
              features={["All 4 ZenAlpha subjects", "Live classes, quizzes and coding exercises", "Medals, coins, XP and certificate", "Phone app and computer app"]}
              href="/payment"
              cta={`Choose ${ZENALPHA_NAME} →`}
            />
            <PlanCard
              badge={course && !course.inZenAlpha ? "👉 Your pick" : undefined}
              title={course && !course.inZenAlpha ? course.title : "One subject 📘"}
              text={course && !course.inZenAlpha ? "Full access to this one course." : "Pick any one course, like Python, Java or C."}
              features={["The full course", "Live classes, quizzes and coding exercises", "Medals, coins, XP and certificate", "Phone app and computer app"]}
              href={course?.inZenAlpha ? "/payment" : singleHref}
              cta={course && !course.inZenAlpha ? "Choose this course →" : "Pick a course →"}
            />
          </div>
          <p className="mt-6 text-center text-sm text-[#6B7280]">
            Coupons from CK Mall take up to {COUPON_MAX_PERCENT}% off at checkout. One plan gives access to one student account; a parent can pay for their child.
          </p>
        </div>
      </section>

      <section className="px-5 pb-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black text-center">Free vs paid</h2>
          <div className="mt-6 overflow-hidden rounded-[24px] border-2 border-[#EDE9FE] bg-white">
            <table className="w-full text-left">
              <thead className="bg-[#F5F3FF]">
                <tr>
                  <th className="px-5 py-4 font-black">What you get</th>
                  <th className="px-5 py-4 font-black text-center text-[#15803D]">Free</th>
                  <th className="px-5 py-4 font-black text-center text-[#6D28D9]">Plan</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((r, i) => (
                  <tr key={r.f} className={i % 2 ? "bg-[#FAFAFF]" : ""}>
                    <td className="px-5 py-3 font-semibold text-[#374151]">{r.f}</td>
                    <td className="px-5 py-3 text-center font-bold">{r.free}</td>
                    <td className="px-5 py-3 text-center font-bold">{r.paid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-center text-sm text-[#6B7280]">
            🌐 The website has the course pages, free lessons and billing. 📱 Full lessons, quizzes, exercises and live classes are in the CodingKida app.
          </p>
        </div>
      </section>

      <section className="px-5 pb-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-black text-center">Payment questions</h2>
          <div className="mt-6 space-y-3">
            {[
              { q: "Does it renew automatically?", a: `No. You pay once and get ${months} months. Near the end you can buy again if you want to continue.` },
              { q: "What happens when my plan ends?", a: "Free lessons, tutorials and the playground stay open. Paid lessons lock until you renew. Your coins, medals and progress are kept." },
              { q: "How do I pay?", a: "By UPI, card or net banking through Razorpay, a secure payment provider. We never see your card details." },
              { q: "My payment went through but the course is locked", a: "Activation can take a minute after the bank confirms. If it still is not unlocked after 10 minutes, contact us with your order details." },
              { q: "Can I get a refund?", a: "Please read the refunds section of our Terms." },
            ].map((f) => (
              <details key={f.q} className="group rounded-[20px] border-2 border-[#EDE9FE] bg-white px-6 py-4 open:bg-[#F5F3FF]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-black">
                  {f.q}
                  <span className="w-8 h-8 shrink-0 rounded-full bg-[#7C3AED] text-white flex items-center justify-center transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-[#4B5563]">
                  {f.a} {f.q.startsWith("Can I get") && <Link href="/terms#refunds" className="font-black text-[#7C3AED] underline">Read the refund policy</Link>}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </KidsPage>
  );
}

function PlanCard({ highlight = false, badge, title, text, features, href, cta }: {
  highlight?: boolean; badge?: string; title: string; text: string; features: string[]; href: string; cta: string;
}) {
  return (
    <div className={`relative rounded-[32px] p-8 border-b-[10px] ${highlight ? "bg-[#7C3AED] text-white border-[#5B21B6]" : "bg-white border-2 border-[#E5E7EB]"}`}>
      {badge && (
        <span className="absolute -top-4 left-8 rounded-full bg-[#FFD84D] px-4 py-1 text-sm font-black text-[#7C2D12] border-b-4 border-[#E0A800]">{badge}</span>
      )}
      <h3 className="text-2xl font-black">{title}</h3>
      <p className={`mt-1 ${highlight ? "text-white/85" : "text-[#6B7280]"}`}>{text}</p>
      <div className="mt-6 flex items-end gap-3 flex-wrap">
        <span className="text-5xl font-black">{rupees(PLAN_PRICE)}</span>
        <span className={`pb-1 text-xl font-bold line-through ${highlight ? "text-white/60" : "text-[#9CA3AF]"}`}>{rupees(PLAN_LIST_PRICE)}</span>
        <span className="mb-1 rounded-full bg-[#22C55E] px-3 py-1 text-sm font-black text-white">{PLAN_OFF_PERCENT}% OFF</span>
        <span className={`w-full text-sm font-bold ${highlight ? "text-white/85" : "text-[#6B7280]"}`}>for {months} months of full access</span>
      </div>
      <ul className="mt-6 space-y-3">
        {features.map((t) => (
          <li key={t} className="flex items-center gap-3 font-semibold">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${highlight ? "bg-white text-[#7C3AED]" : "bg-[#DCFCE7] text-[#15803D]"}`}>✓</span>
            {t}
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className={`mt-8 block text-center rounded-2xl px-6 py-4 text-lg font-black border-b-[6px] active:translate-y-0.5 transition-all ${
          highlight ? "bg-white text-[#5B21B6] border-[#DDD6FE]" : "bg-[#F97316] text-white border-[#C2410C] hover:brightness-110"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}

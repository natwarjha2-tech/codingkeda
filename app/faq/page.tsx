import type { Metadata } from "next";
import Link from "next/link";
import KidsPage, { PageHeader } from "@/components/site/KidsPage";
import { PLAN_PRICE, ACCESS_DAYS, COUPON_MAX_PERCENT, rupees } from "@/app/lib/pricing";

export const metadata: Metadata = {
  title: "Frequently asked questions | CodingKida",
  description: "Answers about CodingKida courses, prices, free learning, live classes, the apps and safety.",
  alternates: { canonical: "/faq" },
};

const months = Math.round(ACCESS_DAYS / 30);

const GROUPS: { title: string; items: { q: string; a: string }[] }[] = [
  {
    title: "🎒 About learning",
    items: [
      { q: "Which class is CodingKida for?", a: "School students from Class 4 to Class 12. No coding experience is needed." },
      { q: "What is in a course?", a: "Short video lessons, a quiz after each lesson, coding exercises checked by the computer, an AI helper, and a certificate when you finish." },
      { q: "Can I try before paying?", a: "Yes. Free lessons, free tutorials, the code playground and the weekly challenge are all free. See Free Learning." },
      { q: "Can my child learn offline?", a: "Yes. Videos can be downloaded in the mobile and desktop apps and watched without internet." },
    ],
  },
  {
    title: "💳 Plans and payment",
    items: [
      { q: "How much does it cost?", a: `${rupees(PLAN_PRICE)} for ${months} months of full access. You pay once; it does not renew on its own.` },
      { q: "What is ZenAlpha?", a: "One plan that unlocks 4 subjects together: AI, Cyber Safety, Robotics and GreenTech." },
      { q: "Can I use a coupon?", a: `Yes. Coupons from CK Mall take up to ${COUPON_MAX_PERCENT}% off at checkout.` },
      { q: "Who gets the access?", a: "One plan gives access to one student account. A parent can pay for their child." },
      { q: "What if a payment fails?", a: "No money is taken for a failed payment. If money left your account but the course did not unlock within a few minutes, contact us with your order details." },
      { q: "What is the refund policy?", a: "See the refunds section of our Terms." },
    ],
  },
  {
    title: "🛡️ Safety and apps",
    items: [
      { q: "Is it safe for children?", a: "Student profiles are verified with a parent. There is no public chat with strangers, and the AI helper answers from the course material." },
      { q: "Where do lessons play?", a: "Free lessons play on this website. Full courses, quizzes, exercises and live classes are in the CodingKida mobile and desktop apps." },
      { q: "Can schools use CodingKida?", a: "Yes. Schools can request a demo on the For Schools page." },
    ],
  },
];

export default function FaqPage() {
  return (
    <KidsPage>
      <PageHeader badge="🙋 Help" title="Questions and answers" text="Everything parents and students usually ask us." />
      <section className="px-5 py-12">
        <div className="max-w-3xl mx-auto space-y-10">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <h2 className="text-2xl font-black">{g.title}</h2>
              <div className="mt-4 space-y-3">
                {g.items.map((f) => (
                  <details key={f.q} className="group rounded-[20px] border-2 border-[#EDE9FE] bg-white px-6 py-4 open:bg-[#F5F3FF]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-black">
                      {f.q}
                      <span className="w-8 h-8 shrink-0 rounded-full bg-[#7C3AED] text-white flex items-center justify-center transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-3 text-[#4B5563] leading-relaxed">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          ))}
          <div className="rounded-[24px] bg-[#FFF7E6] border-2 border-[#FDE68A] p-6 text-center">
            <p className="text-lg font-black">Still have a question?</p>
            <Link href="/contact" className="mt-3 inline-block rounded-2xl bg-[#7C3AED] px-6 py-3 font-black text-white border-b-[5px] border-[#5B21B6]">Contact us</Link>
          </div>
        </div>
      </section>
    </KidsPage>
  );
}

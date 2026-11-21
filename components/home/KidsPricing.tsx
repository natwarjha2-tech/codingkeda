import { PLAN_LIST_PRICE, PLAN_OFF_PERCENT, PLAN_PRICE, ACCESS_DAYS, COUPON_MAX_PERCENT, rupees } from "@/app/lib/pricing";

const months = Math.round(ACCESS_DAYS / 30);

/** One simple price, read from the same numbers the server charges. */
export default function KidsPricing() {
  return (
    <section id="pricing" className="px-5 py-16 md:py-20">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-5xl font-black text-[#1E1B4B]">One simple price 🎁</h2>
          <p className="mt-3 text-lg text-[#6B7280]">No monthly bills. Pay once, learn for {months} months.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ZenAlpha */}
          <div className="relative rounded-[32px] bg-[#7C3AED] text-white p-8 border-b-[10px] border-[#5B21B6]">
            <span className="absolute -top-4 left-8 rounded-full bg-[#FFD84D] px-4 py-1 text-sm font-black text-[#7C2D12] border-b-4 border-[#E0A800]">
              ⭐ Best value
            </span>
            <h3 className="text-2xl font-black">ZenAlpha plan ⚡</h3>
            <p className="mt-1 text-white/85">4 subjects in one plan: AI, Cyber Safety, Robotics and GreenTech.</p>
            <PriceBlock light />
            <Features light items={["All 4 subjects", "Videos, quizzes and coding exercises", "Medals, coins and XP", "Certificate on completion", "Phone app and computer app"]} />
            <a href="/payment" className="mt-8 block text-center rounded-2xl bg-white text-[#5B21B6] px-6 py-4 text-lg font-black border-b-[6px] border-[#DDD6FE] hover:bg-[#FAF5FF] active:translate-y-0.5 transition-all">
              Get ZenAlpha →
            </a>
          </div>

          {/* Single subject */}
          <div className="rounded-[32px] bg-white p-8 border-2 border-[#E5E7EB] border-b-[10px]">
            <h3 className="text-2xl font-black text-[#1E1B4B]">One subject 📘</h3>
            <p className="mt-1 text-[#6B7280]">Pick any one course, like Python, Java or C.</p>
            <PriceBlock />
            <Features items={["The full course", "Videos, quizzes and coding exercises", "Medals, coins and XP", "Certificate on completion", "Phone app and computer app"]} />
            <a href="#courses" className="mt-8 block text-center rounded-2xl bg-[#F97316] text-white px-6 py-4 text-lg font-black border-b-[6px] border-[#C2410C] hover:brightness-110 active:translate-y-0.5 transition-all">
              Choose a course →
            </a>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-[#6B7280]">
          Have a coupon from CK Mall? You can save up to {COUPON_MAX_PERCENT}% more at checkout.
        </p>
      </div>
    </section>
  );
}

function PriceBlock({ light = false }: { light?: boolean }) {
  return (
    <div className="mt-6 flex items-end gap-3 flex-wrap">
      <span className={`text-5xl font-black ${light ? "text-white" : "text-[#1E1B4B]"}`}>{rupees(PLAN_PRICE)}</span>
      <span className={`pb-1 text-xl font-bold line-through ${light ? "text-white/60" : "text-[#9CA3AF]"}`}>{rupees(PLAN_LIST_PRICE)}</span>
      <span className="mb-1 rounded-full bg-[#22C55E] px-3 py-1 text-sm font-black text-white">{PLAN_OFF_PERCENT}% OFF</span>
      <span className={`w-full text-sm font-bold ${light ? "text-white/85" : "text-[#6B7280]"}`}>for {months} months of full access</span>
    </div>
  );
}

function Features({ items, light = false }: { items: string[]; light?: boolean }) {
  return (
    <ul className="mt-6 space-y-3">
      {items.map((t) => (
        <li key={t} className={`flex items-center gap-3 font-semibold ${light ? "text-white" : "text-[#374151]"}`}>
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${light ? "bg-white text-[#7C3AED]" : "bg-[#DCFCE7] text-[#15803D]"}`}>✓</span>
          {t}
        </li>
      ))}
    </ul>
  );
}

import { PLAN_PRICE, ACCESS_DAYS, rupees } from "@/app/lib/pricing";

const months = Math.round(ACCESS_DAYS / 30);

const FAQS = [
  { q: "Which class is CodingKida for?", a: "For school students from Class 4 to Class 12. Beginners are welcome; no coding experience is needed." },
  { q: "Does my child need a laptop?", a: "No. Lessons, quizzes and coding work on the CodingKida phone app. The desktop app on a laptop or computer gives a bigger screen for coding." },
  { q: "How much does it cost?", a: `A plan costs ${rupees(PLAN_PRICE)} for ${months} months of full access. You pay once; there is no monthly bill.` },
  { q: "What are medals, coins and XP?", a: "Top quiz and coding scores win Gold, Silver or Bronze medals and coins. Coins can be used in CK Mall. XP is earned for every video, quiz and exercise, and every 100 XP is a new level." },
  { q: "Can children learn offline?", a: "Yes. Videos can be downloaded in the app and watched without internet." },
  { q: "Is there a certificate?", a: "Yes. Students get a certificate when they complete a course." },
];

/** Common questions, using native <details> so it works without JavaScript. */
export default function HomeFaq() {
  return (
    <section id="faq" className="px-5 py-16 md:py-20 bg-white">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-center text-3xl md:text-5xl font-black text-[#1E1B4B]">Questions? 🙋</h2>
        <div className="mt-10 space-y-4">
          {FAQS.map((f) => (
            <details key={f.q} className="group rounded-[20px] border-2 border-[#EDE9FE] bg-[#FAFAFF] px-6 py-4 open:bg-[#F5F3FF]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-black text-[#1E1B4B]">
                {f.q}
                <span className="w-8 h-8 shrink-0 rounded-full bg-[#7C3AED] text-white flex items-center justify-center transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-[#4B5563] leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

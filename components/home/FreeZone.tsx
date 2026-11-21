import Link from "next/link";
import { LANGUAGES } from "@/app/lib/tutorials";

/** Free things to try right now: tutorials, playground, weekly challenge, certificate check. */
export default function FreeZone() {
  const lessonCount = LANGUAGES.reduce((s, l) => s + l.topics.length, 0);
  const cards = [
    { e: "📖", t: "Free tutorials", d: `${lessonCount} short lessons in Python, Java and C, each with a quick quiz.`, href: "/learn", cta: "Start learning", bg: "bg-[#DCFCE7]", edge: "border-[#86EFAC]", ink: "text-[#15803D]" },
    { e: "🧪", t: "Code playground", d: "Write and run real code in your browser. No setup needed.", href: "/playground", cta: "Open playground", bg: "bg-[#EDE9FE]", edge: "border-[#C4B5FD]", ink: "text-[#6D28D9]" },
    { e: "🔥", t: "Weekly challenge", d: "A new problem every Monday. Be first and become Weekly Champion!", href: "/weekly-challenge", cta: "See this week", bg: "bg-[#FFEDD5]", edge: "border-[#FDBA74]", ink: "text-[#C2410C]" },
  ];

  return (
    <section id="free" className="px-5 py-16 md:py-20">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <span className="inline-block rounded-full bg-[#22C55E] px-4 py-1.5 text-sm font-black text-white">FREE</span>
          <h2 className="mt-3 text-3xl md:text-5xl font-black text-[#1E1B4B]">Try it now, for free 🎈</h2>
          <p className="mt-3 text-lg text-[#6B7280]">No payment needed. Start coding in the next minute.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((c) => (
            <Link key={c.t} href={c.href} className={`${c.bg} ${c.edge} group rounded-[28px] border-2 border-b-8 p-7 hover:-translate-y-1 transition-transform`}>
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-4xl shadow-sm">{c.e}</div>
              <h3 className={`mt-4 text-2xl font-black ${c.ink}`}>{c.t}</h3>
              <p className="mt-2 text-[#374151]">{c.d}</p>
              <p className={`mt-4 font-black ${c.ink}`}>{c.cta} →</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

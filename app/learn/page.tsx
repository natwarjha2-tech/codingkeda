import type { Metadata } from "next";
import Link from "next/link";
import KidsPage, { PageHeader } from "@/components/site/KidsPage";
import { LANGUAGES } from "@/app/lib/tutorials";

export const metadata: Metadata = {
  title: "Free coding tutorials for kids: Python, Java, C | CodingKida",
  description: "Learn to code for free with short, simple tutorials. Run every example in your browser and check yourself with a quick quiz.",
  alternates: { canonical: "/learn" },
};

export default function LearnPage() {
  return (
    <KidsPage>
      <PageHeader
        badge="🆓 Free tutorials"
        title={<>Learn to code, <span className="text-[#22C55E]">free</span> 🎈</>}
        text="Short lessons in simple English. Every example runs in your browser, and each lesson ends with a quick quiz."
        tint="from-[#DCFCE7] via-[#FFFBF5] to-[#E0F2FE]"
      />
      <section className="px-5 py-12">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {LANGUAGES.map((l) => (
            <div key={l.id} className={`${l.color.bg} ${l.color.edge} rounded-[28px] border-2 border-b-8 p-6 flex flex-col`}>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-4xl shadow-sm">{l.emoji}</div>
                <div>
                  <h2 className={`text-2xl font-black ${l.color.ink}`}>{l.name}</h2>
                  <p className="text-sm font-bold text-[#6B7280]">{l.topics.length} lessons</p>
                </div>
              </div>
              <p className="mt-3 text-[#374151]">{l.tagline}</p>
              <ol className="mt-5 space-y-2">
                {l.topics.map((t, i) => (
                  <li key={t.slug}>
                    <Link href={`/learn/${l.id}/${t.slug}`} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 font-bold hover:translate-x-1 transition-transform">
                      <span className="w-7 h-7 shrink-0 rounded-full bg-[#F3F4F6] text-xs font-black flex items-center justify-center">{i + 1}</span>
                      <span>{t.emoji}</span>
                      <span className="flex-1">{t.title}</span>
                      <span className={l.color.ink}>›</span>
                    </Link>
                  </li>
                ))}
              </ol>
              <div className="mt-auto pt-6">
                <Link href={`/learn/${l.id}/${l.topics[0].slug}`} className={`${l.color.btn} block text-center rounded-2xl border-b-[5px] px-5 py-3 font-black text-white hover:brightness-110`}>
                  Start {l.name} →
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="max-w-6xl mx-auto mt-10 rounded-[28px] bg-white border-2 border-[#EDE9FE] p-8 flex flex-col md:flex-row items-center gap-6">
          <div className="text-6xl">🏆</div>
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-2xl font-black">Want more than the basics?</h2>
            <p className="text-[#6B7280]">Full courses have video lessons, coding exercises checked by the computer, medals and a certificate.</p>
          </div>
          <Link href="/courses" className="rounded-2xl bg-[#7C3AED] px-7 py-4 font-black text-white border-b-[6px] border-[#5B21B6]">See courses →</Link>
        </div>
      </section>
    </KidsPage>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import KidsPage, { PageHeader } from "@/components/site/KidsPage";

export const metadata: Metadata = {
  title: "About CodingKida",
  description: "CodingKida teaches school students to code with short videos, quizzes, real coding practice and rewards.",
  alternates: { canonical: "/about" },
};

const VALUES = [
  { e: "🧒", t: "Made for school kids", d: "Simple English, short lessons and examples kids care about: games, scores and stories." },
  { e: "🛠️", t: "Learn by doing", d: "Every lesson ends with a quiz and real code that the computer checks." },
  { e: "🎉", t: "Fun keeps you going", d: "Medals, coins, XP, levels and a weekly challenge make practice something to look forward to." },
  { e: "🛡️", t: "Safe and trusted", d: "Parent verification, no public chat with strangers, and AI help that sticks to the course." },
];

export default function AboutPage() {
  return (
    <KidsPage>
      <PageHeader
        badge="👋 About us"
        title={<>We help kids <span className="text-[#7C3AED]">love</span> coding</>}
        text="CodingKida is an Indian learning platform for students from Class 4 to Class 12. We turn coding into small, winnable steps."
      />
      <section className="px-5 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-[28px] bg-white border-2 border-[#EDE9FE] p-8">
            <h2 className="text-3xl font-black">Our mission 🎯</h2>
            <p className="mt-4 text-lg leading-relaxed text-[#374151]">
              Every child can learn to think like a programmer. Coding builds logic, patience and creativity, the same skills that help in maths,
              science and everyday problem solving. We want learning to code to feel like playing a game you get better at every day.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
            {VALUES.map((v) => (
              <div key={v.t} className="rounded-[24px] bg-[#FAFAFF] border-2 border-[#EDE9FE] p-6">
                <div className="text-4xl">{v.e}</div>
                <h3 className="mt-3 text-xl font-black">{v.t}</h3>
                <p className="mt-1 text-[#4B5563]">{v.d}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[28px] bg-[#7C3AED] text-white p-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            {[
              { e: "📱", t: "Phone app" },
              { e: "💻", t: "Desktop app" },
              { e: "🌐", t: "Website + playground" },
            ].map((p) => (
              <div key={p.t}><div className="text-5xl">{p.e}</div><p className="mt-2 text-lg font-black">{p.t}</p></div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/courses" className="rounded-2xl bg-[#7C3AED] px-7 py-4 font-black text-white border-b-[6px] border-[#5B21B6]">See courses →</Link>
            <Link href="/contact" className="rounded-2xl bg-white px-7 py-4 font-black text-[#6D28D9] border-2 border-[#DDD6FE]">Contact us</Link>
          </div>
        </div>
      </section>
    </KidsPage>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import KidsPage from "@/components/site/KidsPage";
import FreeCodingQuestions from "@/components/site/FreeCodingQuestions";
import { exampleFor } from "@/app/lib/tutorials";

export const metadata: Metadata = {
  title: "Online code playground for kids: Python, Java, C | CodingKida",
  description: "Write and run Python, Java, C and JavaScript code in a real code editor in your browser. Free, no sign-up needed.",
  alternates: { canonical: "/playground" },
};

type Props = { searchParams: Promise<{ example?: string }> };

const FEATURES = [
  { e: "▶️", t: "Run real code", d: "Python, Java, C and JavaScript, with input and output." },
  { e: "🧩", t: "Coding problems", d: "Practice questions with test cases and Submit." },
  { e: "💡", t: "Hints and Codo AI", d: "Stuck? Get a hint or ask Codo for help." },
  { e: "🪙", t: "Coins and medals", d: "Solve problems and earn rewards as you learn." },
];

/**
 * Public playground page. The editor itself is the classroom code editor
 * (/my/code), opened in a NEW TAB through /try/editor, so visitors get a guest
 * session and this page (or the tutorial) stays open. Tutorial "Try it" links
 * arrive here with ?example=python/loops.
 */
async function Hero({ searchParams }: Props) {
  await connection();
  const { example } = await searchParams;
  const ex = exampleFor(example ?? null);
  const href = `/try/editor${ex && example ? `?example=${encodeURIComponent(example)}` : ""}`;
  return (
    <section className="px-5 py-12">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div>
          <span className="rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-black text-[#15803D]">🆓 FREE · NO SIGN-UP NEEDED</span>
          <h1 className="mt-3 text-4xl md:text-6xl font-black">Code playground 🧪</h1>
          <p className="mt-3 text-lg text-[#4B5563]">
            {ex
              ? <>Example: <b>{ex.title}</b>. Open it in the editor, press Run, then change it and run it again!</>
              : "A real code editor, the same one CodingKida students use. Write code, press Run, see what happens."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={href} target="_blank" rel="noopener" prefetch={false}
              className="rounded-2xl bg-[#7C3AED] px-7 py-4 text-lg font-black text-white border-b-[6px] border-[#5B21B6] hover:brightness-110">
              🚀 {ex ? "Open this example in the editor" : "Open the code editor"}
            </Link>
            <Link href="/learn" className="rounded-2xl bg-white px-6 py-4 font-black text-[#6D28D9] border-2 border-[#DDD6FE] border-b-[6px]">📖 Free tutorials</Link>
          </div>
          <p className="mt-3 text-sm font-bold text-[#6B7280]">The editor opens in a new tab, so you can keep this page open.</p>
        </div>

        {ex ? (
          <div className="rounded-[24px] overflow-hidden border-4 border-white shadow-xl bg-[#1E1B4B]">
            <div className="flex items-center gap-2 px-4 py-3 bg-[#16133A]">
              <span className="w-3 h-3 rounded-full bg-[#EF4444]" /><span className="w-3 h-3 rounded-full bg-[#FFB020]" /><span className="w-3 h-3 rounded-full bg-[#22C55E]" />
              <span className="ml-3 text-xs font-bold text-white/70">{ex.title} · {ex.lang}</span>
            </div>
            <pre className="max-h-[360px] overflow-auto p-5 font-mono text-sm leading-6 text-white whitespace-pre">{ex.code}</pre>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f.t} className="rounded-[24px] bg-white border-2 border-[#EDE9FE] p-5">
                <div className="text-3xl">{f.e}</div>
                <b className="mt-2 block">{f.t}</b>
                <span className="text-sm text-[#6B7280]">{f.d}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function PlaygroundPage(props: Props) {
  return (
    <KidsPage>
      <Suspense fallback={<div className="h-[50vh]" />}>
        <Hero {...props} />
      </Suspense>

      <Suspense fallback={null}>
        <FreeCodingQuestions newTab title="🧩 Try a free coding question" />
      </Suspense>

      <section className="px-5 pb-16">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { e: "📖", t: "New to coding?", d: "Start with our free tutorials.", href: "/learn", cta: "Open tutorials" },
            { e: "🔥", t: "Weekly challenge", d: "A new problem every Monday.", href: "/weekly-challenge", cta: "See this week" },
            { e: "🏆", t: "Win medals", d: "Solve course exercises to win Coding Gold.", href: "/courses", cta: "See courses" },
          ].map((c) => (
            <Link key={c.t} href={c.href} className="rounded-[20px] bg-white border-2 border-[#EDE9FE] p-5 flex gap-4 hover:-translate-y-0.5 transition-transform">
              <span className="text-3xl">{c.e}</span>
              <span><b className="block">{c.t}</b><span className="text-[#6B7280]">{c.d}</span> <span className="font-black text-[#7C3AED]">{c.cta} →</span></span>
            </Link>
          ))}
        </div>
      </section>
    </KidsPage>
  );
}

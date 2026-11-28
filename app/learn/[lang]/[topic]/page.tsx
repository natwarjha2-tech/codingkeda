import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import KidsPage from "@/components/site/KidsPage";
import MiniQuiz from "@/components/site/MiniQuiz";
import { LANGUAGES, getTopic } from "@/app/lib/tutorials";

type Props = { params: Promise<{ lang: string; topic: string }> };

export function generateStaticParams() {
  return LANGUAGES.flatMap((l) => l.topics.map((t) => ({ lang: l.id, topic: t.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, topic } = await params;
  const found = getTopic(lang, topic);
  if (!found) return { title: "Tutorial not found | CodingKida" };
  return {
    title: `${found.topic.title} in ${found.language.name} for kids | CodingKida`,
    description: found.topic.summary,
    alternates: { canonical: `/learn/${lang}/${topic}` },
  };
}

export default async function TopicPage({ params }: Props) {
  const { lang, topic } = await params;
  const found = getTopic(lang, topic);
  if (!found) notFound();
  const { language: l, topic: t, prev, next } = found;
  const index = l.topics.findIndex((x) => x.slug === t.slug);

  return (
    <KidsPage>
      <div className="max-w-6xl mx-auto px-5 py-10 grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Lesson list */}
        <aside className="lg:sticky lg:top-24 self-start">
          <Link href="/learn" className="text-sm font-bold text-[#6B7280] hover:text-[#7C3AED]">← All tutorials</Link>
          <div className={`${l.color.bg} mt-3 rounded-[24px] p-4`}>
            <p className={`text-lg font-black ${l.color.ink}`}>{l.emoji} {l.name}</p>
            <ol className="mt-3 space-y-1">
              {l.topics.map((x, i) => (
                <li key={x.slug}>
                  <Link
                    href={`/learn/${l.id}/${x.slug}`}
                    className={`block rounded-xl px-3 py-2 text-sm font-bold ${x.slug === t.slug ? "bg-white text-[#1E1B4B] shadow-sm" : "text-[#374151] hover:bg-white/60"}`}
                  >
                    {i + 1}. {x.title}
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </aside>

        <article className="lg:col-span-3">
          <p className={`text-sm font-black uppercase tracking-wider ${l.color.ink}`}>{l.name} · Lesson {index + 1} of {l.topics.length}</p>
          <h1 className="mt-1 text-4xl md:text-5xl font-black">{t.emoji} {t.title}</h1>
          <p className="mt-3 text-xl text-[#4B5563]">{t.summary}</p>

          <div className="mt-8 space-y-5">
            {t.blocks.map((b, i) =>
              b.kind === "text" ? (
                <p key={i} className="text-lg leading-relaxed text-[#374151]">{b.text}</p>
              ) : b.kind === "tip" ? (
                <p key={i} className="rounded-2xl bg-[#E0F2FE] border-2 border-[#BAE6FD] px-5 py-4 font-bold text-[#0369A1]">💡 {b.text}</p>
              ) : (
                <div key={i} className="rounded-[24px] overflow-hidden border-4 border-white shadow-lg">
                  <pre className="bg-[#1E1B4B] text-white font-mono text-sm md:text-[15px] leading-7 p-5 overflow-x-auto"><code>{b.code}</code></pre>
                  {b.output && (
                    <div className="bg-[#0F0D2E] px-5 py-3 font-mono text-sm text-[#86EFAC] whitespace-pre-wrap">
                      <span className="text-[#9CA3AF] text-xs font-sans font-bold block mb-1">OUTPUT</span>{b.output}
                    </div>
                  )}
                </div>
              ),
            )}
          </div>

          <div className="mt-8 rounded-[28px] bg-[#EDE9FE] border-2 border-[#C4B5FD] border-b-8 p-6 flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <h2 className="text-xl font-black">✏️ Your turn</h2>
              <p className="text-[#4B5563]">Open this example in the code editor, change it and run it. It opens in a new tab, so this lesson stays open.</p>
            </div>
            <Link
              href={`/try/editor?example=${l.id}/${t.slug}`}
              target="_blank"
              rel="noopener"
              prefetch={false}
              className="rounded-2xl bg-[#7C3AED] px-6 py-4 text-center font-black text-white border-b-[6px] border-[#5B21B6] hover:brightness-110"
            >
              ▶ Try it yourself
            </Link>
          </div>

          <div className="mt-8">
            <MiniQuiz {...t.quiz} />
          </div>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-between">
            {prev ? (
              <Link href={`/learn/${l.id}/${prev.slug}`} className="rounded-2xl bg-white px-6 py-4 font-black border-2 border-[#E5E7EB] border-b-[6px]">← {prev.title}</Link>
            ) : <span />}
            {next ? (
              <Link href={`/learn/${l.id}/${next.slug}`} className={`${l.color.btn} rounded-2xl px-6 py-4 font-black text-white border-b-[6px] text-right`}>Next: {next.title} →</Link>
            ) : (
              <Link href="/courses" className="rounded-2xl bg-[#7C3AED] px-6 py-4 font-black text-white border-b-[6px] border-[#5B21B6]">🎉 Done! See full courses →</Link>
            )}
          </div>
        </article>
      </div>
    </KidsPage>
  );
}

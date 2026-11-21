import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import KidsPage, { PageHeader } from "@/components/site/KidsPage";
import CourseIcon from "@/components/site/CourseIcon";
import { getFreeLessons } from "@/app/services/free-learning.service";
import { LANGUAGES } from "@/app/lib/tutorials";

export const metadata: Metadata = {
  title: "Free coding lessons for kids | CodingKida",
  description: "Watch free sample video lessons, read free tutorials, play coding puzzles and run code online. No payment needed.",
  alternates: { canonical: "/free-learning" },
};

type Props = { searchParams: Promise<{ course?: string }> };

async function FreeLessons({ searchParams }: Props) {
  await connection();
  const { course } = await searchParams;
  const all = await getFreeLessons();
  const lessons = course ? all.filter((l) => l.courseId === course) : all;
  const filtered = !!course && lessons.length > 0;

  // Group by course.
  const groups = new Map<string, typeof lessons>();
  for (const l of lessons) {
    const g = groups.get(l.courseId);
    if (g) g.push(l); else groups.set(l.courseId, [l]);
  }

  return (
    <section className="px-5 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-3xl font-black">🎬 Free video lessons</h2>
          {filtered && <Link href="/free-learning" className="font-black text-[#7C3AED]">Show all free lessons →</Link>}
        </div>
        {course && !filtered && (
          <p className="mt-3 rounded-2xl bg-[#FFF7E6] border-2 border-[#FDE68A] px-5 py-3 font-bold text-[#92400E]">
            This course has no free video lesson yet. Here are free lessons from other courses.
          </p>
        )}
        {(filtered ? lessons : all).length === 0 ? (
          <p className="mt-4 rounded-[24px] bg-white border-2 border-dashed border-[#DDD6FE] p-8 text-center font-bold text-[#6B7280]">
            Free video lessons are coming soon. Meanwhile, try the tutorials and puzzles below!
          </p>
        ) : (
          <div className="mt-6 space-y-6">
            {Array.from((filtered ? groups : groupAll(all)).values()).map((g) => (
              <div key={g[0].courseId} className="rounded-[28px] bg-white border-2 border-[#EDE9FE] p-6">
                <div className="flex items-center gap-4">
                  <CourseIcon icon={g[0].courseIcon} color={g[0].courseColor} size={52} />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-black">{g[0].courseTitle}</h3>
                    <p className="text-sm font-bold text-[#6B7280]">{g.length} free lesson{g.length === 1 ? "" : "s"}</p>
                  </div>
                  <Link href={`/courses/${g[0].courseId}`} className="hidden sm:inline font-black text-[#7C3AED]">About the course →</Link>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {g.map((l) => (
                    <Link key={l.id} href={`/free-learning/${l.id}`} className="flex items-center gap-3 rounded-2xl bg-[#FAFAFF] px-4 py-3 hover:bg-[#F5F3FF] transition-colors">
                      <span className="w-10 h-10 shrink-0 rounded-full bg-[#22C55E] text-white flex items-center justify-center font-black">▶</span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-black truncate">{l.title}</span>
                        <span className="block text-xs font-bold text-[#6B7280] truncate">{l.moduleTitle}{l.duration ? ` · ${l.duration}` : ""}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function groupAll(all: Awaited<ReturnType<typeof getFreeLessons>>) {
  const m = new Map<string, typeof all>();
  for (const l of all) {
    const g = m.get(l.courseId);
    if (g) g.push(l); else m.set(l.courseId, [l]);
  }
  return m;
}

export default function FreeLearningPage(props: Props) {
  const tutorialCount = LANGUAGES.reduce((s, l) => s + l.topics.length, 0);
  return (
    <KidsPage>
      <PageHeader
        badge="🆓 100% free · no payment"
        title={<>Start learning <span className="text-[#22C55E]">free</span> 🎈</>}
        text="Sample video lessons, simple tutorials, puzzles and a real code playground. Sign in only when you want to save your work."
        tint="from-[#DCFCE7] via-[#FFFBF5] to-[#E0F2FE]"
      />

      <Suspense fallback={<div className="max-w-6xl mx-auto px-5 py-12"><div className="h-64 rounded-[28px] bg-[#F3F0FF] animate-pulse" /></div>}>
        <FreeLessons {...props} />
      </Suspense>

      <section className="px-5 pb-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-black">More free things to try</h2>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { e: "📖", t: "Free tutorials", d: `${tutorialCount} lessons in Python, Java and C`, href: "/learn", bg: "bg-[#DCFCE7]", ink: "text-[#15803D]" },
              { e: "🧪", t: "Code playground", d: "Write and run real code", href: "/playground", bg: "bg-[#EDE9FE]", ink: "text-[#6D28D9]" },
              { e: "🎮", t: "Coding puzzles", d: "Guess the output, fix a line", href: "/#play", bg: "bg-[#FEF3C7]", ink: "text-[#B45309]" },
              { e: "🔥", t: "Weekly challenge", d: "A new problem every Monday", href: "/weekly-challenge", bg: "bg-[#FFEDD5]", ink: "text-[#C2410C]" },
            ].map((c) => (
              <Link key={c.t} href={c.href} className={`${c.bg} rounded-[24px] p-6 hover:-translate-y-1 transition-transform`}>
                <div className="text-4xl">{c.e}</div>
                <h3 className={`mt-3 text-xl font-black ${c.ink}`}>{c.t}</h3>
                <p className="text-[#374151]">{c.d}</p>
              </Link>
            ))}
          </div>

          <div className="mt-10 rounded-[28px] bg-[#7C3AED] text-white p-8 flex flex-col md:flex-row items-center gap-6">
            <div className="text-6xl">🚀</div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-black">Ready for the full course?</h2>
              <p className="text-white/85">Every lesson, quizzes, coding exercises, medals, live classes and a certificate.</p>
            </div>
            <Link href="/pricing" className="rounded-2xl bg-[#FFD84D] px-7 py-4 font-black text-[#7C2D12] border-b-[6px] border-[#E0A800]">See plans →</Link>
          </div>
        </div>
      </section>
    </KidsPage>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import KidsPage from "@/components/site/KidsPage";
import FreeLessonPlayer from "@/components/site/FreeLessonPlayer";
import { getFreeLesson } from "@/app/services/free-learning.service";

type Props = { params: Promise<{ lessonId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const { lessonId } = await params;
  const found = await getFreeLesson(lessonId);
  if (!found) return { title: "Lesson not found | CodingKida" };
  return {
    title: `${found.lesson.title} (free lesson) | CodingKida`,
    description: `Free sample lesson from ${found.lesson.courseTitle}.`,
    alternates: { canonical: `/free-learning/${lessonId}` },
  };
}

export default async function FreeLessonPage({ params }: Props) {
  await connection();
  const { lessonId } = await params;
  const found = await getFreeLesson(lessonId);
  if (!found) notFound();
  const { lesson: l, next } = found;

  return (
    <KidsPage>
      <section className="px-5 py-10">
        <div className="max-w-5xl mx-auto">
          <nav className="text-sm font-bold text-[#6B7280]">
            <Link href="/free-learning" className="hover:text-[#7C3AED]">Free learning</Link> <span>›</span>{" "}
            <Link href={`/courses/${l.courseId}`} className="hover:text-[#7C3AED]">{l.courseTitle}</Link>
          </nav>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-black text-[#15803D]">FREE LESSON</span>
            <span className="text-sm font-bold text-[#6B7280]">{l.moduleTitle}{l.duration ? ` · ${l.duration}` : ""}</span>
          </div>
          <h1 className="mt-2 text-3xl md:text-5xl font-black">{l.title}</h1>

          <div className="mt-6">
            <FreeLessonPlayer
              lessonId={l.id}
              nextHref={next ? `/free-learning/${next.id}` : null}
              nextTitle={next?.title ?? null}
            />
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href={`/courses/${l.courseId}`} className="rounded-[20px] bg-white border-2 border-[#EDE9FE] p-5 font-black hover:-translate-y-0.5 transition-transform">📚 See the full course →</Link>
            {next ? (
              <Link href={`/free-learning/${next.id}`} className="rounded-[20px] bg-white border-2 border-[#BBF7D0] p-5 font-black hover:-translate-y-0.5 transition-transform">▶ Next free lesson →</Link>
            ) : (
              <Link href="/learn" className="rounded-[20px] bg-white border-2 border-[#BBF7D0] p-5 font-black hover:-translate-y-0.5 transition-transform">📖 Free tutorials →</Link>
            )}
            <Link href="/pricing" className="rounded-[20px] bg-[#7C3AED] text-white p-5 font-black hover:-translate-y-0.5 transition-transform">💳 Unlock everything →</Link>
          </div>
        </div>
      </section>
    </KidsPage>
  );
}

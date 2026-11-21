import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import KidsPage from "@/components/site/KidsPage";
import CourseIcon from "@/components/site/CourseIcon";
import { getPublicCourse, getHomeCourses } from "@/app/services/home.service";
import CourseCard from "@/components/site/CourseCard";
import { PLAN_LIST_PRICE, PLAN_OFF_PERCENT, PLAN_PRICE, ACCESS_DAYS, rupees } from "@/app/lib/pricing";
import { SITE_URL } from "@/app/lib/site";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const { id } = await params;
  const c = await getPublicCourse(id);
  if (!c) return { title: "Course not found | CodingKida" };
  const description = c.subtitle || `${c.title}: video lessons, quizzes and coding exercises for school students.`;
  return {
    title: `${c.title} for kids | CodingKida`,
    description,
    alternates: { canonical: `/courses/${c.id}` },
    openGraph: { title: `${c.title} | CodingKida`, description, url: `${SITE_URL}/courses/${c.id}`, type: "website" },
  };
}

const months = Math.round(ACCESS_DAYS / 30);

export default async function CoursePage({ params }: Props) {
  await connection();
  const { id } = await params;
  const c = await getPublicCourse(id);
  if (!c) notFound();

  const freeCount = c.modules.reduce((s, m) => s + m.lessons.filter((l) => l.isFree).length, 0);
  const all = await getHomeCourses();
  const others = [
    ...all.filter((o) => o.id !== c.id && o.category === c.category),
    ...all.filter((o) => o.id !== c.id && o.category !== c.category),
  ].slice(0, 3);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: c.title,
    description: c.subtitle || c.title,
    provider: { "@type": "Organization", name: "CodingKida", sameAs: SITE_URL },
    url: `${SITE_URL}/courses/${c.id}`,
    inLanguage: "en",
    ...(c.rating > 0 && c.studentCount > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: c.rating.toFixed(1), ratingCount: c.studentCount } }
      : {}),
    offers: { "@type": "Offer", price: PLAN_PRICE, priceCurrency: "INR", category: "Paid" },
  };

  return (
    <KidsPage>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      {/* Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#EDE9FE] via-[#FFF7E6] to-[#E0F2FE] px-5 py-12 md:py-16">
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 w-72 h-72 rounded-full bg-white/50" />
        <div className="relative max-w-6xl mx-auto">
          <nav className="text-sm font-bold text-[#6B7280]">
            <Link href="/" className="hover:text-[#7C3AED]">Home</Link> <span>›</span>{" "}
            <Link href="/courses" className="hover:text-[#7C3AED]">Courses</Link> <span>›</span>{" "}
            <span className="text-[#1E1B4B]">{c.title}</span>
          </nav>
          <div className="mt-6 flex flex-col md:flex-row gap-6 md:items-center">
            <CourseIcon icon={c.icon} color={c.color} size={96} />
            <div>
              {c.category && <span className="text-sm font-black uppercase tracking-wider text-[#7C3AED]">{c.category}</span>}
              <h1 className="text-4xl md:text-5xl font-black leading-tight">{c.title}</h1>
              {c.subtitle && <p className="mt-3 text-lg text-[#4B5563] max-w-3xl">{c.subtitle}</p>}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 text-sm font-extrabold">
            {c.lessonCount > 0 && <Chip>🎬 {c.lessonCount} video lessons</Chip>}
            {c.quizCount > 0 && <Chip>🧠 {c.quizCount} quiz questions</Chip>}
            {c.exerciseCount > 0 && <Chip>💻 {c.exerciseCount} coding exercises</Chip>}
            {c.totalHours > 0 && <Chip>⏱ {c.totalHours} hours</Chip>}
            {c.rating > 0 && <Chip>⭐ {c.rating.toFixed(1)} rating</Chip>}
            {c.studentCount > 0 && <Chip>👦 {c.studentCount} students</Chip>}
            {c.hasCert && <Chip>🎓 Certificate</Chip>}
          </div>
        </div>
      </section>

      <section className="px-5 py-12">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Syllabus */}
          <div className="lg:col-span-2">
            <h2 className="text-3xl font-black">What you will learn 🗺️</h2>
            <p className="mt-2 text-[#6B7280]">
              {c.modules.length} module{c.modules.length === 1 ? "" : "s"} · {c.lessonCount} lesson{c.lessonCount === 1 ? "" : "s"}
              {freeCount > 0 && <> · <b className="text-[#15803D]">{freeCount} free to watch</b></>}
            </p>
            <div className="mt-6 space-y-4">
              {c.modules.map((m, i) => (
                <details key={m.id} open={i === 0} className="group rounded-[24px] bg-white border-2 border-[#EDE9FE] px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center gap-4">
                    <span className="w-10 h-10 shrink-0 rounded-full bg-[#7C3AED] text-white font-black flex items-center justify-center">{i + 1}</span>
                    <span className="flex-1 text-lg font-black">{m.title}</span>
                    <span className="text-sm font-bold text-[#6B7280]">{m.lessons.length} lessons</span>
                    <span className="text-[#7C3AED] transition-transform group-open:rotate-180">▼</span>
                  </summary>
                  <ol className="mt-4 space-y-2">
                    {m.lessons.map((l, j) => (
                      <li key={l.id} className="flex items-center gap-3 rounded-2xl bg-[#FAFAFF] px-4 py-3">
                        <span className="text-sm font-black text-[#9CA3AF] w-6">{j + 1}</span>
                        <span className="flex-1 font-semibold text-[#374151]">{l.title}</span>
                        {l.isFree && <span className="rounded-full bg-[#DCFCE7] px-3 py-0.5 text-xs font-black text-[#15803D]">FREE</span>}
                        {l.duration && <span className="text-xs font-bold text-[#6B7280]">{l.duration}</span>}
                      </li>
                    ))}
                  </ol>
                </details>
              ))}
              {c.modules.length === 0 && <p className="text-[#6B7280]">Lessons are being added. Check back soon!</p>}
            </div>

            <h2 className="mt-12 text-3xl font-black">Every lesson includes</h2>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { e: "🎬", t: "Short video", d: "Clear explanation with examples." },
                { e: "🧠", t: "Quiz", d: "Win Quiz Gold, Silver or Bronze for top scores." },
                { e: "💻", t: "Coding exercise", d: "Your code is checked against test cases." },
                { e: "🤖", t: "AI helper", d: "Ask Codo when you are stuck." },
              ].map((f) => (
                <div key={f.t} className="rounded-[20px] bg-white border-2 border-[#EDE9FE] p-5 flex gap-4">
                  <span className="text-3xl">{f.e}</span>
                  <div><h3 className="font-black">{f.t}</h3><p className="text-[#6B7280]">{f.d}</p></div>
                </div>
              ))}
            </div>
          </div>

          {/* Buy box */}
          <aside className="lg:sticky lg:top-24 self-start rounded-[28px] bg-white border-2 border-[#E5E7EB] border-b-[10px] p-6">
            {c.inZenAlpha && (
              <span className="inline-block rounded-full bg-[#FFD84D] px-3 py-1 text-xs font-black text-[#7C2D12]">✨ Part of the ZenAlpha plan</span>
            )}
            <div className="mt-3 flex items-end gap-3 flex-wrap">
              <span className="text-4xl font-black">{rupees(PLAN_PRICE)}</span>
              <span className="pb-1 text-lg font-bold line-through text-[#9CA3AF]">{rupees(PLAN_LIST_PRICE)}</span>
              <span className="mb-1 rounded-full bg-[#22C55E] px-3 py-1 text-xs font-black text-white">{PLAN_OFF_PERCENT}% OFF</span>
            </div>
            <p className="mt-1 text-sm font-bold text-[#6B7280]">
              {months} months of full access{c.inZenAlpha ? " to all 4 ZenAlpha subjects" : ""}
            </p>
            <a
              href={`/payment?courseId=${encodeURIComponent(c.id)}`}
              className="mt-6 block text-center rounded-2xl bg-[#7C3AED] px-6 py-4 text-lg font-black text-white border-b-[6px] border-[#5B21B6] hover:brightness-110 active:translate-y-0.5 transition-all"
            >
              Enroll now →
            </a>
            <Link
              href={`/free-learning?course=${encodeURIComponent(c.id)}`}
              className="mt-3 block text-center rounded-2xl bg-[#22C55E] px-6 py-3 font-black text-white border-b-[5px] border-[#15803D] hover:brightness-110"
            >
              🎈 Try free{freeCount > 0 ? ` · ${freeCount} free lesson${freeCount === 1 ? "" : "s"}` : ""}
            </Link>
            <Link
              href="/download"
              className="mt-3 block text-center rounded-2xl bg-white px-6 py-3 font-black text-[#6D28D9] border-2 border-[#DDD6FE] hover:bg-[#FAF5FF]"
            >
              ⬇ Get the app
            </Link>
            <ul className="mt-6 space-y-2 text-sm font-semibold text-[#374151]">
              <li>✅ Learn on phone or computer</li>
              <li>✅ Download videos and learn offline</li>
              {c.hasCert && <li>✅ Certificate when you finish</li>}
              <li>✅ Coins, medals, XP and leaderboards</li>
            </ul>
            {(c.instructor || c.institute) && (
              <p className="mt-6 border-t border-[#F3F4F6] pt-4 text-sm text-[#6B7280]">
                Taught by <b className="text-[#1E1B4B]">{c.instructor || "CodingKida Team"}</b>{c.institute ? `, ${c.institute}` : ""}
              </p>
            )}
          </aside>
        </div>
      </section>

      {/* Where things happen: website vs app */}
      <section className="px-5 pb-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-black">Website or app? 📱💻</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-[24px] bg-white border-2 border-[#BBF7D0] p-6">
              <h3 className="text-xl font-black text-[#15803D]">🌐 On this website</h3>
              <ul className="mt-3 space-y-2 text-[#374151] font-semibold">
                <li>✅ See the full syllabus</li>
                <li>✅ Watch free sample lessons</li>
                <li>✅ Free tutorials and the code playground</li>
                <li>✅ Buy a plan and see your billing</li>
              </ul>
            </div>
            <div className="rounded-[24px] bg-white border-2 border-[#DDD6FE] p-6">
              <h3 className="text-xl font-black text-[#6D28D9]">📱 In the CodingKida app</h3>
              <ul className="mt-3 space-y-2 text-[#374151] font-semibold">
                <li>✅ Every lesson video, offline downloads</li>
                <li>✅ Quizzes, coding exercises and medals</li>
                <li>✅ Live classes and the AI helper</li>
                <li>✅ Certificate when you finish</li>
              </ul>
            </div>
          </div>

          <h2 className="mt-12 text-3xl font-black">Questions about this course</h2>
          <div className="mt-6 space-y-3">
            {[
              { q: "Do I need to know coding already?", a: "No. Lessons start from the basics and get harder step by step." },
              { q: "How long do I get access?", a: `${months} months of full access from the day you pay.${c.inZenAlpha ? " The ZenAlpha plan also unlocks the other ZenAlpha subjects." : ""}` },
              { q: "Can I try it first?", a: freeCount > 0 ? `Yes. ${freeCount} lesson${freeCount === 1 ? " is" : "s are"} free to watch on the website.` : "Yes. Try our free tutorials and the code playground." },
              { q: "Is there a certificate?", a: c.hasCert ? "Yes, when you finish the course." : "This course does not include a certificate." },
            ].map((f) => (
              <details key={f.q} className="group rounded-[20px] border-2 border-[#EDE9FE] bg-white px-6 py-4 open:bg-[#F5F3FF]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-black">
                  {f.q}
                  <span className="w-8 h-8 shrink-0 rounded-full bg-[#7C3AED] text-white flex items-center justify-center transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-[#4B5563]">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {others.length > 0 && (
        <section className="px-5 pb-16">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-3xl font-black">Other courses you may like</h2>
              <Link href="/courses" className="font-black text-[#7C3AED]">All courses →</Link>
            </div>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {others.map((o, i) => <CourseCard key={o.id} course={o} index={i + 1} />)}
            </div>
          </div>
        </section>
      )}
    </KidsPage>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-white px-4 py-2 text-[#374151] border-2 border-white shadow-sm">{children}</span>;
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import KidsPage from "@/components/site/KidsPage";
import { classTime } from "@/components/site/LiveClassCard";
import LiveClassAccess from "@/components/site/LiveClassAccess";
import { getPublicLiveClass } from "@/app/services/live-public.service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const { id } = await params;
  const c = await getPublicLiveClass(id);
  return c
    ? { title: `${c.title || "Live class"} | CodingKida`, description: c.agenda || `Live class for ${c.courseTitle}.`, robots: { index: false } }
    : { title: "Class not found | CodingKida" };
}

export default async function LiveClassPage({ params }: Props) {
  await connection();
  const { id } = await params;
  const c = await getPublicLiveClass(id);
  if (!c) notFound();
  const live = c.status === "live";

  return (
    <KidsPage>
      <section className="px-5 py-10">
        <div className="max-w-4xl mx-auto">
          <Link href="/live-classes" className="text-sm font-bold text-[#6B7280] hover:text-[#7C3AED]">← All live classes</Link>
          <div className={`mt-4 rounded-[32px] border-2 border-b-[10px] p-7 md:p-10 ${live ? "bg-[#FFE4E6] border-[#FDA4AF]" : "bg-white border-[#EDE9FE]"}`}>
            {live ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-[#EF4444] px-3 py-1 text-sm font-black text-white">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> LIVE NOW
              </span>
            ) : (
              <span className="rounded-full bg-[#EDE9FE] px-3 py-1 text-sm font-black text-[#6D28D9]">UPCOMING CLASS</span>
            )}
            <h1 className="mt-4 text-3xl md:text-5xl font-black leading-tight">{c.title || "Live class"}</h1>
            <p className="mt-2 font-bold text-[#6B7280]">
              Part of <Link href={`/courses/${c.courseId}`} className="text-[#7C3AED] underline">{c.courseTitle}</Link>
            </p>
            {c.agenda && <p className="mt-5 text-lg leading-relaxed text-[#374151] whitespace-pre-line">{c.agenda}</p>}
            <dl className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Info label="When" value={classTime(c.scheduledAt)} />
              <Info label="Length" value={c.durationMinutes ? `${c.durationMinutes} minutes` : "About an hour"} />
              <Info label="Teacher" value={c.instructorName || "CodingKida teacher"} />
            </dl>
            <div className="mt-8">
              <LiveClassAccess courseId={c.courseId} live={live} />
            </div>
          </div>
        </div>
      </section>
    </KidsPage>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#FAFAFF] p-4">
      <dt className="text-xs font-black uppercase text-[#6B7280]">{label}</dt>
      <dd className="mt-1 font-black">{value}</dd>
    </div>
  );
}

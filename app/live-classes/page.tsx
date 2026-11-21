import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import KidsPage, { PageHeader } from "@/components/site/KidsPage";
import LiveClassCard from "@/components/site/LiveClassCard";
import { getPublicLiveClasses } from "@/app/services/live-public.service";

export const metadata: Metadata = {
  title: "Live coding classes for kids | CodingKida",
  description: "Join live coding classes with real teachers. Ask questions and code together with other students.",
  alternates: { canonical: "/live-classes" },
};

async function Classes() {
  await connection();
  const classes = await getPublicLiveClasses();
  if (classes.length === 0) {
    return (
      <div className="rounded-[28px] bg-white border-2 border-dashed border-[#FDBA74] p-10 text-center">
        <div className="text-6xl">📅</div>
        <h2 className="mt-3 text-2xl font-black">No classes scheduled right now</h2>
        <p className="mt-1 text-[#6B7280]">New classes are added every week. Students see them in the app as soon as they are scheduled.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/free-learning" className="rounded-2xl bg-[#22C55E] px-6 py-3 font-black text-white border-b-[5px] border-[#15803D]">Learn free meanwhile</Link>
          <Link href="/download" className="rounded-2xl bg-white px-6 py-3 font-black text-[#6D28D9] border-2 border-[#DDD6FE]">Get the app</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {classes.map((c) => <LiveClassCard key={c.id} c={c} />)}
    </div>
  );
}

export default function LiveClassesPage() {
  return (
    <KidsPage>
      <PageHeader
        badge="🔴 Live with a real teacher"
        title={<>Live <span className="text-[#EF4444]">classes</span></>}
        text="Learn with a teacher in real time. Ask questions, share your screen and code together."
        tint="from-[#FFE4E6] via-[#FFFBF5] to-[#FFEDD5]"
      />
      <section className="px-5 py-12">
        <div className="max-w-6xl mx-auto">
          <Suspense fallback={<div className="h-64 rounded-[28px] bg-[#FFF1F2] animate-pulse" />}>
            <Classes />
          </Suspense>

          <h2 className="mt-14 text-3xl font-black">How it works</h2>
          <ol className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { e: "🔎", t: "Pick a class", d: "Choose a class from the list." },
              { e: "🔐", t: "Log in", d: "Use your CodingKida account." },
              { e: "🎟️", t: "Check access", d: "Classes are open to students of that course." },
              { e: "🎥", t: "Join", d: "Join from the CodingKida app when the teacher goes live." },
            ].map((s, i) => (
              <li key={s.t} className="rounded-[24px] bg-white border-2 border-[#FED7AA] p-5">
                <span className="text-sm font-black text-[#C2410C]">Step {i + 1}</span>
                <div className="mt-1 text-3xl">{s.e}</div>
                <h3 className="mt-2 font-black">{s.t}</h3>
                <p className="text-[#6B7280]">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </KidsPage>
  );
}

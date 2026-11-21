import Link from "next/link";
import KidsPage from "@/components/site/KidsPage";

export default function NotFound() {
  return (
    <KidsPage>
      <section className="px-5 py-24 text-center">
        <div className="text-8xl">🛸</div>
        <h1 className="mt-4 text-5xl font-black">Oops! Page not found</h1>
        <p className="mt-3 text-lg text-[#6B7280]">This page flew away. Let&apos;s get you back on track.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link href="/" className="rounded-2xl bg-[#7C3AED] px-7 py-4 text-lg font-black text-white border-b-[6px] border-[#5B21B6]">Go home</Link>
          <Link href="/courses" className="rounded-2xl bg-white px-7 py-4 text-lg font-black text-[#6D28D9] border-2 border-[#DDD6FE]">See courses</Link>
          <Link href="/free-learning" className="rounded-2xl bg-[#22C55E] px-7 py-4 text-lg font-black text-white border-b-[6px] border-[#15803D]">Learn free</Link>
        </div>
      </section>
    </KidsPage>
  );
}

import Link from "next/link";
import KidsPage from "@/components/site/KidsPage";

export default function CourseNotFound() {
  return (
    <KidsPage>
      <section className="px-5 py-24 text-center">
        <div className="text-7xl">🔭</div>
        <h1 className="mt-4 text-4xl font-black">We could not find that course</h1>
        <p className="mt-3 text-lg text-[#6B7280]">It may have moved. Have a look at all our courses.</p>
        <Link href="/courses" className="mt-8 inline-block rounded-2xl bg-[#7C3AED] px-7 py-4 text-lg font-black text-white border-b-[6px] border-[#5B21B6]">
          See all courses →
        </Link>
      </section>
    </KidsPage>
  );
}

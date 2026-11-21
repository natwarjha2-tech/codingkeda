import Link from "next/link";

/** Two banners: live classes and the school demo. */
export default function LiveAndSchools() {
  return (
    <section className="px-5 py-12">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#EF4444] to-[#F97316] p-8 text-white">
          <div aria-hidden className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/15" />
          <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-sm font-black">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" /> LIVE
          </span>
          <h3 className="mt-4 text-3xl font-black">Live classes with real teachers</h3>
          <p className="mt-2 text-white/90 text-lg">Ask questions, code together and learn with other students.</p>
          <Link href="/live-classes" className="mt-6 inline-block rounded-2xl bg-white px-6 py-3 font-black text-[#C2410C] border-b-[5px] border-[#FED7AA]">
            See upcoming classes →
          </Link>
        </div>
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#0EA5E9] to-[#6366F1] p-8 text-white">
          <div aria-hidden className="absolute -bottom-12 -right-6 w-48 h-48 rounded-full bg-white/15" />
          <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-sm font-black">🏫 For schools</span>
          <h3 className="mt-4 text-3xl font-black">Bring CodingKida to your school</h3>
          <p className="mt-2 text-white/90 text-lg">Ready-made coding lessons, quizzes and progress reports for every class.</p>
          <Link href="/for-schools" className="mt-6 inline-block rounded-2xl bg-[#FFD84D] px-6 py-3 font-black text-[#7C2D12] border-b-[5px] border-[#E0A800]">
            Request a free demo →
          </Link>
        </div>
      </div>
    </section>
  );
}

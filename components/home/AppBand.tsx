import Link from "next/link";

/** Get the app + final call to action. */
export default function AppBand() {
  return (
    <section className="px-5 py-16">
      <div className="max-w-6xl mx-auto relative overflow-hidden rounded-[36px] bg-gradient-to-br from-[#7C3AED] via-[#6D28D9] to-[#0EA5E9] px-8 py-12 md:px-14 md:py-16 text-white">
        <div aria-hidden className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10" />
        <div aria-hidden className="absolute -bottom-20 left-10 w-48 h-48 rounded-full bg-[#FFD84D]/20" />
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          <div className="md:col-span-2">
            <h2 className="text-3xl md:text-5xl font-black leading-tight">Ready to write your first program? 🎉</h2>
            <p className="mt-4 text-lg text-white/90">
              Get the CodingKida app on your phone or computer and start your first lesson today.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/download" className="rounded-2xl bg-[#FFD84D] px-7 py-4 text-lg font-black text-[#7C2D12] border-b-[6px] border-[#E0A800] hover:brightness-105 active:translate-y-0.5 transition-all">
                ⬇ Download the app
              </Link>
              <Link href="/login?mode=signup" className="rounded-2xl bg-white/15 px-7 py-4 text-lg font-black text-white border-2 border-white/40 hover:bg-white/25 transition-all">
                Create free account
              </Link>
            </div>
          </div>
          <div className="flex md:justify-end gap-3 text-6xl md:text-7xl select-none" aria-hidden>
            <span className="floating">📱</span>
            <span className="floating [animation-delay:0.6s]">💻</span>
          </div>
        </div>
      </div>
    </section>
  );
}

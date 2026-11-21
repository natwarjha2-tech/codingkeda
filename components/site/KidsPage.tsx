import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { kidsFont } from "@/app/lib/fonts";

/** Shared frame for the bright public pages: navbar, cream background, footer. */
export default function KidsPage({ children }: { children: ReactNode }) {
  return (
    <main className={`${kidsFont.className} min-h-screen bg-[#FFFBF5] text-[#1E1B4B]`}>
      <Navbar />
      <div className="pt-16">{children}</div>
      <Footer />
    </main>
  );
}

/** Big friendly page header used at the top of each public page. */
export function PageHeader({ badge, title, text, tint = "from-[#EDE9FE] via-[#FFF7E6] to-[#E0F2FE]" }: {
  badge?: string; title: ReactNode; text?: ReactNode; tint?: string;
}) {
  return (
    <section className={`relative overflow-hidden bg-gradient-to-br ${tint} px-5 py-14 md:py-20`}>
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/50" />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-[#FFD84D]/30" />
      <div className="relative max-w-5xl mx-auto text-center">
        {badge && (
          <span className="inline-block rounded-full bg-white px-4 py-1.5 text-sm font-black text-[#6D28D9] border-2 border-[#DDD6FE]">{badge}</span>
        )}
        <h1 className="mt-4 text-4xl md:text-6xl font-black leading-tight text-[#1E1B4B]">{title}</h1>
        {text && <p className="mt-4 text-lg md:text-xl text-[#4B5563] max-w-3xl mx-auto">{text}</p>}
      </div>
    </section>
  );
}

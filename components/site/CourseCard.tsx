import Link from "next/link";
import type { HomeCourse } from "@/app/services/home.service";
import CourseIcon from "@/components/site/CourseIcon";

// Bright card colours, used in turn.
export const CARD_PALETTE = [
  { bg: "bg-[#EDE9FE]", edge: "border-[#C4B5FD]", ink: "text-[#6D28D9]", btn: "bg-[#7C3AED] border-[#5B21B6]" },
  { bg: "bg-[#E0F2FE]", edge: "border-[#7DD3FC]", ink: "text-[#0369A1]", btn: "bg-[#0EA5E9] border-[#0369A1]" },
  { bg: "bg-[#FFEDD5]", edge: "border-[#FDBA74]", ink: "text-[#C2410C]", btn: "bg-[#F97316] border-[#C2410C]" },
  { bg: "bg-[#DCFCE7]", edge: "border-[#86EFAC]", ink: "text-[#15803D]", btn: "bg-[#22C55E] border-[#15803D]" },
  { bg: "bg-[#FCE7F3]", edge: "border-[#F9A8D4]", ink: "text-[#BE185D]", btn: "bg-[#EC4899] border-[#BE185D]" },
];

/** One bright course card: View course · Try free · Subscribe. */
export default function CourseCard({ course: c, index }: { course: HomeCourse; index: number }) {
  const p = CARD_PALETTE[index % CARD_PALETTE.length];
  const href = `/courses/${encodeURIComponent(c.id)}`;
  return (
    <article className={`${p.bg} ${p.edge} rounded-[28px] border-2 border-b-8 p-6 flex flex-col hover:-translate-y-1 transition-transform`}>
      <Link href={href} className="flex items-start gap-4">
        <CourseIcon icon={c.icon} color={c.color} />
        <div className="min-w-0">
          {c.category && <span className={`text-xs font-black uppercase tracking-wider ${p.ink}`}>{c.category}</span>}
          <h3 className="text-xl font-black text-[#1E1B4B] leading-tight hover:underline">{c.title}</h3>
        </div>
      </Link>
      {c.subtitle && <p className="mt-3 text-[#4B5563] leading-relaxed line-clamp-3">{c.subtitle}</p>}

      <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold">
        {c.lessonCount > 0 && <span className="rounded-full bg-white px-3 py-1 text-[#374151]">🎬 {c.lessonCount} lessons</span>}
        {c.totalHours > 0 && <span className="rounded-full bg-white px-3 py-1 text-[#374151]">⏱ {c.totalHours} hrs</span>}
        {c.rating > 0 && <span className="rounded-full bg-white px-3 py-1 text-[#374151]">⭐ {c.rating.toFixed(1)}</span>}
        {c.hasCert && <span className="rounded-full bg-white px-3 py-1 text-[#374151]">🎓 Certificate</span>}
        {c.inZenAlpha && <span className="rounded-full bg-[#FFD84D] px-3 py-1 text-[#7C2D12]">✨ In ZenAlpha</span>}
      </div>

      <div className="mt-auto pt-6 space-y-2">
        <Link href={href} className={`${p.btn} block text-center rounded-2xl border-b-[5px] px-5 py-3 font-extrabold text-white hover:brightness-110 transition-all`}>
          View course →
        </Link>
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/free-learning?course=${encodeURIComponent(c.id)}`} className="text-center rounded-xl bg-white px-3 py-2 text-sm font-black text-[#15803D] border-2 border-white hover:border-[#86EFAC]">
            🎈 Try free
          </Link>
          <Link href={`/pricing?course=${encodeURIComponent(c.id)}`} className="text-center rounded-xl bg-white px-3 py-2 text-sm font-black text-[#6D28D9] border-2 border-white hover:border-[#C4B5FD]">
            💳 Subscribe
          </Link>
        </div>
      </div>
    </article>
  );
}

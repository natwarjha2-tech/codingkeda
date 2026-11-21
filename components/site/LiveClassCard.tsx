import Link from "next/link";
import type { PublicLiveClass } from "@/app/services/live-public.service";

export function classTime(iso: string | null) {
  if (!iso) return "Time to be announced";
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata",
  }) + " IST";
}

export default function LiveClassCard({ c }: { c: PublicLiveClass }) {
  const live = c.status === "live";
  return (
    <Link
      href={`/live-classes/${c.id}`}
      className={`block rounded-[28px] border-2 border-b-8 p-6 hover:-translate-y-1 transition-transform ${live ? "bg-[#FFE4E6] border-[#FDA4AF]" : "bg-white border-[#EDE9FE]"}`}
    >
      <div className="flex items-center gap-2">
        {live ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-[#EF4444] px-3 py-1 text-xs font-black text-white">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> LIVE NOW
          </span>
        ) : (
          <span className="rounded-full bg-[#EDE9FE] px-3 py-1 text-xs font-black text-[#6D28D9]">UPCOMING</span>
        )}
        <span className="text-xs font-bold text-[#6B7280] truncate">{c.courseTitle}</span>
      </div>
      <h3 className="mt-3 text-xl font-black leading-tight">{c.title || "Live class"}</h3>
      {c.agenda && <p className="mt-2 text-[#4B5563] line-clamp-2">{c.agenda}</p>}
      <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold">
        <span className="rounded-full bg-[#FFF7E6] px-3 py-1">🗓 {classTime(c.scheduledAt)}</span>
        {c.durationMinutes ? <span className="rounded-full bg-[#F3F4F6] px-3 py-1">⏱ {c.durationMinutes} min</span> : null}
        {c.instructorName && <span className="rounded-full bg-[#E0F2FE] px-3 py-1">👩‍🏫 {c.instructorName}</span>}
      </div>
    </Link>
  );
}

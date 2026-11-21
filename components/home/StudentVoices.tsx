import { connection } from "next/server";
import { getSocialProof } from "@/app/services/social-proof.service";

/** Real ratings and student reviews from the apps. Hidden when there is nothing real to show. */
export default async function StudentVoices() {
  await connection();
  const p = await getSocialProof();
  if (p.ratingCount === 0 && p.reviews.length === 0 && p.lessonsThisWeek === 0) return null;

  return (
    <section id="reviews" className="px-5 py-16 bg-[#F5F3FF]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center">
          <h2 className="text-3xl md:text-5xl font-black text-[#1E1B4B]">Kids love learning here 💜</h2>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {p.ratingCount > 0 && (
              <span className="rounded-full bg-white px-5 py-2 font-black text-[#B45309] border-2 border-[#FDE68A]">
                ⭐ {p.avgRating.toFixed(1)} / 5 from {p.ratingCount} rating{p.ratingCount === 1 ? "" : "s"}
              </span>
            )}
            {p.lessonsThisWeek > 0 && (
              <span className="rounded-full bg-white px-5 py-2 font-black text-[#15803D] border-2 border-[#86EFAC]">
                🎬 {p.lessonsThisWeek} lesson{p.lessonsThisWeek === 1 ? "" : "s"} finished this week
              </span>
            )}
          </div>
        </div>

        {p.reviews.length > 0 && (
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {p.reviews.map((r, i) => (
              <figure key={i} className="rounded-[24px] bg-white border-2 border-[#EDE9FE] border-b-[6px] p-6">
                <div className="text-[#F59E0B] text-lg" aria-label={`${r.rating} out of 5 stars`}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
                <blockquote className="mt-3 text-lg text-[#374151] leading-relaxed">“{r.text}”</blockquote>
                <figcaption className="mt-4 text-sm font-black text-[#1E1B4B]">
                  {r.name}
                  {r.lessonTitle && <span className="block text-xs font-bold text-[#6B7280]">on “{r.lessonTitle}”</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
        <p className="mt-6 text-center text-xs font-bold text-[#9CA3AF]">Real ratings from students in the CodingKida apps.</p>
      </div>
    </section>
  );
}

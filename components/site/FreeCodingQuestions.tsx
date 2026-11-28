import Link from "next/link";
import { connection } from "next/server";
import CourseIcon from "@/components/site/CourseIcon";
import { getFreeCodingProblems } from "@/app/services/free-learning.service";

const DIFF: Record<string, string> = {
  easy: "bg-[#DCFCE7] text-[#15803D]",
  medium: "bg-[#FEF3C7] text-[#B45309]",
  hard: "bg-[#FEE2E2] text-[#B91C1C]",
};

/**
 * Up to 5 free coding questions per subject (coding exercises of free lessons).
 * Each opens in the classroom code editor; visitors get a guest session first.
 * `newTab`: open the editor in a new tab (playground page), so this page stays open.
 */
export default async function FreeCodingQuestions({ newTab = false, title = "💻 Free coding questions" }: { newTab?: boolean; title?: string }) {
  await connection();
  const problems = await getFreeCodingProblems();
  if (problems.length === 0) return null;
  const groups = new Map<string, typeof problems>();
  for (const p of problems) {
    const g = groups.get(p.courseId);
    if (g) g.push(p); else groups.set(p.courseId, [p]);
  }
  return (
    <section className="px-5 pb-12">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-black">{title}</h2>
        <p className="mt-1 font-bold text-[#6B7280]">
          Solve real problems in our code editor. Run your code, submit it against test cases, and earn coins. No sign-up needed.
        </p>
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
          {Array.from(groups.values()).map((g) => (
            <div key={g[0].courseId} className="rounded-[28px] bg-white border-2 border-[#EDE9FE] p-6">
              <div className="flex items-center gap-4">
                <CourseIcon icon={g[0].courseIcon} color={g[0].courseColor} size={44} />
                <div className="min-w-0">
                  <h3 className="text-lg font-black truncate">{g[0].courseTitle}</h3>
                  <p className="text-sm font-bold text-[#6B7280]">{g.length} free question{g.length === 1 ? "" : "s"}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {g.map((p, i) => (
                  <Link key={p.id} prefetch={false}
                    href={`/try/${p.lessonId}?course=${encodeURIComponent(p.courseId)}&exercise=${encodeURIComponent(p.id)}`}
                    {...(newTab ? { target: "_blank", rel: "noopener" } : {})}
                    className="flex items-center gap-3 rounded-2xl bg-[#FAFAFF] px-4 py-3 hover:bg-[#F5F3FF] transition-colors">
                    <span className="w-9 h-9 shrink-0 rounded-xl bg-[#7C3AED] text-white flex items-center justify-center font-black text-sm">{i + 1}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-black truncate">{p.title}</span>
                      <span className="block text-xs font-bold text-[#6B7280] truncate">From: {p.lessonTitle}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-black capitalize ${DIFF[p.difficulty] || DIFF.medium}`}>{p.difficulty}</span>
                    <span className="hidden sm:inline shrink-0 font-black text-[#7C3AED]">Solve →</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

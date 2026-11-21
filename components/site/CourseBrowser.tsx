"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import type { HomeCourse } from "@/app/services/home.service";
import CourseCard from "@/components/site/CourseCard";

const PAGE_SIZE = 9;
type Sort = "popular" | "rating" | "newest" | "az";
const SORTS: { id: Sort; label: string }[] = [
  { id: "popular", label: "Most popular" },
  { id: "rating", label: "Top rated" },
  { id: "newest", label: "Newest" },
  { id: "az", label: "A → Z" },
];

/** Course list: search, subject chips, sorting and pages. Filtering happens in the browser. */
export default function CourseBrowser({ courses }: { courses: HomeCourse[] }) {
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState(params.get("subject") ?? "All");
  const [sort, setSort] = useState<Sort>("popular");
  const [page, setPage] = useState(1);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(courses.map((c) => c.category).filter(Boolean)))],
    [courses],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    // courses arrive oldest first; keep that index for "newest"
    const list = courses
      .map((c, i) => ({ c, i }))
      .filter(({ c }) =>
        (category === "All" || c.category === category) &&
        (!q || `${c.title} ${c.subtitle} ${c.category}`.toLowerCase().includes(q)));
    list.sort((a, b) => {
      if (sort === "rating") return b.c.rating - a.c.rating || b.c.studentCount - a.c.studentCount;
      if (sort === "newest") return b.i - a.i;
      if (sort === "az") return a.c.title.localeCompare(b.c.title);
      return b.c.studentCount - a.c.studentCount || b.c.rating - a.c.rating;
    });
    return list.map((x) => x.c);
  }, [courses, query, category, sort]);

  useEffect(() => { setPage(1); }, [query, category, sort]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const visible = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <section className="px-5 py-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="flex items-center gap-3 rounded-2xl bg-white border-2 border-[#E5E7EB] px-4 py-3 sm:w-80 focus-within:border-[#7C3AED]">
              <Search size={20} className="text-[#7C3AED]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Python, Java, AI…"
                className="w-full bg-transparent outline-none text-base font-semibold text-[#1E1B4B] placeholder:text-[#9CA3AF]"
                aria-label="Search courses"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Clear search" className="text-[#9CA3AF] hover:text-[#1E1B4B]"><X size={18} /></button>
              )}
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label="Sort courses"
              className="rounded-2xl bg-white border-2 border-[#E5E7EB] px-4 py-3 font-bold text-[#1E1B4B] outline-none focus:border-[#7C3AED]"
            >
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Subjects">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`rounded-full px-4 py-2 text-sm font-extrabold border-2 transition-colors ${
                  category === cat ? "bg-[#7C3AED] border-[#7C3AED] text-white" : "bg-white border-[#E5E7EB] text-[#374151] hover:border-[#C4B5FD]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-6 text-sm font-bold text-[#6B7280]">{shown.length} course{shown.length === 1 ? "" : "s"}</p>

        {shown.length === 0 ? (
          <div className="mt-6 rounded-[28px] bg-white border-2 border-dashed border-[#DDD6FE] p-12 text-center">
            <div className="text-5xl">🔍</div>
            <p className="mt-3 text-lg font-black">No course matches “{query}”.</p>
            <p className="text-[#6B7280]">Try another word, or clear the search.</p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visible.map((c, i) => <CourseCard key={c.id} course={c} index={(page - 1) * PAGE_SIZE + i} />)}
          </div>
        )}

        {pages > 1 && (
          <nav className="mt-10 flex justify-center items-center gap-2" aria-label="Pages">
            <button disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded-xl bg-white px-4 py-2 font-black border-2 border-[#E5E7EB] disabled:opacity-40">←</button>
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                aria-current={n === page ? "page" : undefined}
                className={`w-10 h-10 rounded-xl font-black border-2 ${n === page ? "bg-[#7C3AED] border-[#7C3AED] text-white" : "bg-white border-[#E5E7EB]"}`}
              >
                {n}
              </button>
            ))}
            <button disabled={page === pages} onClick={() => setPage(page + 1)} className="rounded-xl bg-white px-4 py-2 font-black border-2 border-[#E5E7EB] disabled:opacity-40">→</button>
          </nav>
        )}
      </div>
    </section>
  );
}

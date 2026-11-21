import Link from "next/link";
import { connection } from "next/server";
import { getHomeCourses } from "@/app/services/home.service";
import CourseCard from "@/components/site/CourseCard";

/** Real courses from the database, in bright cards (first 6; the rest are on /courses). */
export default async function HomeCourses() {
  await connection(); // render on each request (not frozen at build time); the data itself is cached for 5 min
  const courses = await getHomeCourses();
  const shown = courses.slice(0, 6);

  return (
    <section id="courses" className="px-5 py-16 md:py-20">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-5xl font-black text-[#1E1B4B]">Our courses 📚</h2>
          <p className="mt-3 text-lg text-[#6B7280]">Every course has videos, quizzes, coding exercises and a certificate.</p>
        </div>

        {shown.length === 0 ? (
          <p className="text-center text-[#6B7280]">New courses are coming soon. Download the app to get started!</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {shown.map((c, i) => <CourseCard key={c.id} course={c} index={i} />)}
          </div>
        )}

        {courses.length > 0 && (
          <div className="mt-10 text-center">
            <Link href="/courses" className="inline-block rounded-2xl bg-white px-7 py-4 text-lg font-black text-[#6D28D9] border-2 border-[#DDD6FE] border-b-[6px] hover:bg-[#FAF5FF] transition-colors">
              See all {courses.length} courses →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

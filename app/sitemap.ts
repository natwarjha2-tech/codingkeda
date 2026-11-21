import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { SITE_URL } from "@/app/lib/site";
import { LANGUAGES } from "@/app/lib/tutorials";
import { getHomeCourses } from "@/app/services/home.service";
import { getFreeLessons } from "@/app/services/free-learning.service";

/** /sitemap.xml: public pages, every active course and every tutorial. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection(); // build at request time so new courses appear without a rebuild
  const now = new Date();
  const page = (path: string, priority: number, changeFrequency: "daily" | "weekly" | "monthly" = "weekly") =>
    ({ url: `${SITE_URL}${path}`, lastModified: now, changeFrequency, priority });

  const [courses, freeLessons] = await Promise.all([getHomeCourses(), getFreeLessons()]);

  return [
    page("/", 1, "daily"),
    page("/courses", 0.9, "daily"),
    page("/free-learning", 0.9, "daily"),
    page("/live-classes", 0.8, "daily"),
    page("/pricing", 0.8),
    page("/for-schools", 0.8, "monthly"),
    page("/faq", 0.6, "monthly"),
    page("/learn", 0.9),
    page("/playground", 0.8),
    page("/weekly-challenge", 0.8, "daily"),
    page("/download", 0.7, "monthly"),
    page("/about", 0.5, "monthly"),
    page("/contact", 0.5, "monthly"),
    page("/verify", 0.4, "monthly"),
    page("/privacy", 0.3, "monthly"),
    page("/terms", 0.3, "monthly"),
    ...courses.map((c) => page(`/courses/${c.id}`, 0.8)),
    ...freeLessons.map((l) => page(`/free-learning/${l.id}`, 0.6, "monthly")),
    ...LANGUAGES.flatMap((l) => l.topics.map((t) => page(`/learn/${l.id}/${t.slug}`, 0.7, "monthly"))),
  ];
}

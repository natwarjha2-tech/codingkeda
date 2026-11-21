import { prisma } from "@/app/lib/prisma";

/**
 * Real social proof for the home page (read-only, cached 10 minutes):
 *  - average star rating and number of ratings (lesson + app ratings)
 *  - lessons finished in the last 7 days
 *  - a few short, positive student reviews
 *
 * Child safety: reviewers are shown as first name + last initial only, and only
 * 4–5 star reviews with 15–220 characters and no links, emails or phone
 * numbers are used.
 */
export interface Review { name: string; rating: number; text: string; lessonTitle: string | null }
export interface SocialProof { avgRating: number; ratingCount: number; lessonsThisWeek: number; reviews: Review[] }

const TTL_MS = 10 * 60_000;
let cache: { at: number; data: SocialProof } | null = null;
const EMPTY: SocialProof = { avgRating: 0, ratingCount: 0, lessonsThisWeek: 0, reviews: [] };

const UNSAFE = /(https?:\/\/|www\.|@|\d{6,}|\.com\b)/i;

function shortName(full: string | null | undefined) {
  const parts = (full || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "A CodingKida student";
  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
  return parts.length > 1 ? `${first} ${parts[parts.length - 1].charAt(0).toUpperCase()}.` : first;
}

export async function getSocialProof(): Promise<SocialProof> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [rows, lessonsThisWeek] = await Promise.all([
      prisma.surveyResponse.findMany({
        where: {
          OR: [
            { answers: { path: ["type"], equals: "lesson_rating" } },
            { answers: { path: ["type"], equals: "app_rating" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 500,
        select: { answers: true },
      }),
      prisma.progress.count({ where: { completed: true, completedAt: { gte: weekAgo } } }),
    ]);

    let total = 0, count = 0;
    const picks: { userId: string | null; rating: number; text: string; lessonTitle: string | null }[] = [];
    const seenUsers = new Set<string>();
    for (const r of rows) {
      const a = r.answers as { rating?: number; feedback?: string; userId?: string; lessonTitle?: string } | null;
      const rating = Math.round(Number(a?.rating) || 0);
      if (rating < 1 || rating > 5) continue;
      total += rating; count++;
      const text = (a?.feedback || "").trim().replace(/\s+/g, " ");
      const uid = a?.userId || null;
      if (rating >= 4 && text.length >= 15 && text.length <= 220 && !UNSAFE.test(text) && picks.length < 6 && (!uid || !seenUsers.has(uid))) {
        if (uid) seenUsers.add(uid);
        picks.push({ userId: uid, rating, text, lessonTitle: a?.lessonTitle || null });
      }
    }

    const ids = picks.map((p) => p.userId).filter((x): x is string => !!x);
    const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
    const nameOf = new Map(users.map((u) => [u.id, u.name]));

    const data: SocialProof = {
      avgRating: count ? Math.round((total / count) * 10) / 10 : 0,
      ratingCount: count,
      lessonsThisWeek,
      reviews: picks.map((p) => ({ name: shortName(p.userId ? nameOf.get(p.userId) : null), rating: p.rating, text: p.text, lessonTitle: p.lessonTitle })),
    };
    cache = { at: Date.now(), data };
    return data;
  } catch {
    return cache?.data ?? EMPTY;
  }
}

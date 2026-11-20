import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { MEDALS, codingMedal, type MedalInfo } from "@/app/lib/medals";

/**
 * GET /api/coding-badges — the student's coding medals (lesson exercises and
 * weekly challenges) and the coins earned from coding only.
 * Read from the coin records, so nothing new is stored.
 *   { badges: [{ key, label, icon, title, coins, earnedAt }], codingCoins, counts }
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const rows = await prisma.coinTransaction.findMany({
      where: {
        userId: user!.userId,
        type: "EARNED",
        OR: [
          { reason: { startsWith: "CodingLB:" } },
          { reason: { startsWith: "WeeklyCode:" } },
          { reason: { startsWith: "Coding:" } },
        ],
      },
      select: { reason: true, coins: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    const codingCoins = rows.reduce((s, r) => s + r.coins, 0);
    const medals = Object.values(MEDALS).filter((m) => m.key.startsWith("coding-") || m.key.startsWith("weekly-"));
    const badges: { key: string; label: string; icon: string; title: string; coins: number; earnedAt: string }[] = [];
    for (const r of rows) {
      if (r.reason.startsWith("Coding:")) continue; // Code Arena practice: coins only, no medal
      let m: MedalInfo | undefined = medals.find((x) => r.reason.includes(` ${x.label} `) || r.reason.includes(`— ${x.label}`));
      if (!m && r.reason.startsWith("WeeklyCode:")) m = MEDALS["weekly-solver"]; // older weekly rewards
      if (!m && r.reason.startsWith("CodingLB:")) {
        // Older exercise rewards saved only the rank.
        const rank = Number(/Rank #(\d+)/.exec(r.reason)?.[1] ?? 0);
        m = rank ? codingMedal(rank) ?? undefined : undefined;
      }
      if (!m) continue; // rank after 10th: no medal
      const parts = r.reason.split(" — ");
      badges.push({
        key: m.key, label: m.label, icon: m.icon, title: parts[parts.length - 1] || "Coding problem",
        coins: r.coins, earnedAt: r.createdAt.toISOString(),
      });
    }
    const counts: Record<string, number> = {};
    for (const b of badges) counts[b.key] = (counts[b.key] ?? 0) + 1;

    return apiSuccess({ badges, codingCoins, counts });
  } catch (err) {
    logger.error("coding-badges", "get_error", { error: err instanceof Error ? err.message : "Unknown" });
    return apiError(500, "Internal server error.");
  }
}

import { prisma } from "@/app/lib/prisma";
import { MEDALS, codingMedal, friendlyCoinReason, type MedalInfo } from "@/app/lib/medals";

export interface CodingCoinRecord { source: "exercise" | "weekly" | "arena"; text: string; coins: number; at: string }
export interface CodingSubmissionRecord {
  id: string; title: string; difficulty: string; language: string; passed: boolean; status: string; at: string;
}

export interface CodingMedalRecord {
  key: string;
  label: string;
  icon: string;
  title: string;
  kind: "exercise" | "weekly";
  rank: number | null;
  coins: number;
  earnedAt: string;
}

/**
 * The student's coding medals and the coins earned from coding only.
 * Read from the coin records, so nothing new is stored.
 */
export async function getCodingMedals(userId: string): Promise<{ badges: CodingMedalRecord[]; codingCoins: number; history: CodingCoinRecord[] }> {
  const rows = await prisma.coinTransaction.findMany({
    where: {
      userId,
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
  const history: CodingCoinRecord[] = rows.map((r) => ({
    source: r.reason.startsWith("WeeklyCode:") ? "weekly" : r.reason.startsWith("CodingLB:") ? "exercise" : "arena",
    text: friendlyCoinReason(r.reason),
    coins: r.coins,
    at: r.createdAt.toISOString(),
  }));
  const medals = Object.values(MEDALS).filter((m) => m.key.startsWith("coding-") || m.key.startsWith("weekly-"));
  const badges: CodingMedalRecord[] = [];
  for (const r of rows) {
    if (r.reason.startsWith("Coding:")) continue; // Code Arena practice: coins only, no medal
    const rank = Number(/Rank #(\d+)/.exec(r.reason)?.[1] ?? 0) || null;
    let m: MedalInfo | undefined = medals.find((x) => r.reason.includes(` ${x.label} `) || r.reason.includes(`— ${x.label}`));
    if (!m && r.reason.startsWith("WeeklyCode:")) m = MEDALS["weekly-solver"]; // older weekly rewards
    if (!m && r.reason.startsWith("CodingLB:")) m = rank ? codingMedal(rank) ?? undefined : undefined; // older exercise rewards
    if (!m) continue;
    const parts = r.reason.split(" — ");
    badges.push({
      key: m.key,
      label: m.label,
      icon: m.icon,
      title: parts[parts.length - 1] || "Coding problem",
      kind: r.reason.startsWith("WeeklyCode:") ? "weekly" : "exercise",
      rank,
      coins: r.coins,
      earnedAt: r.createdAt.toISOString(),
    });
  }
  return { badges, codingCoins, history };
}

/** The student's recent code submissions (lesson exercises and the weekly challenge), newest first. */
export async function getCodingSubmissions(userId: string, take = 100): Promise<CodingSubmissionRecord[]> {
  const rows = await prisma.exerciseSubmission.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true, passed: true, status: true, language: true, createdAt: true,
      exercise: { select: { title: true, difficulty: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.exercise?.title ?? "Coding exercise",
    difficulty: r.exercise?.difficulty ?? "",
    language: r.language ?? "",
    passed: r.passed,
    status: r.status,
    at: r.createdAt.toISOString(),
  }));
}

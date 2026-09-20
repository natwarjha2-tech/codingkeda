import { prisma } from "@/app/lib/prisma";
import { notifyCoinsEarned, notifyCustom } from "@/app/lib/notification";

// Reward amounts (coins). Change here to tune the program.
export const REFERRAL_REWARD_NEW_USER = 50; // given to the friend when they enter a valid code
export const REFERRAL_REWARD_REFERRER = 50; // given to the referrer on the friend's first purchase

// Generate a short, human-friendly, unique referral code, e.g. "ARJU7K2Q".
// Uses unambiguous characters (no 0/O/1/I) to avoid confusion when typed.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(len = 8): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Return the user's referral code, generating + persisting one on first use.
 * Retries on the rare unique-collision.
 */
export async function ensureReferralCode(userId: string, seedName?: string): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true, name: true, email: true },
  });
  if (existing?.referralCode) return existing.referralCode;

  // Prefix from name/email for friendliness, then random suffix for uniqueness.
  const base = (seedName || existing?.name || existing?.email || "USER")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase()
    .slice(0, 4) || "USER";

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = (base + randomCode(4)).slice(0, 10);
    try {
      await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
    } catch {
      // unique collision — try again with a fresh suffix
    }
  }
  // Fallback: fully random
  const fallback = randomCode(10);
  await prisma.user.update({ where: { id: userId }, data: { referralCode: fallback } });
  return fallback;
}

export type ApplyReferralResult =
  | { ok: true; coinsAwarded: number; message: string }
  | { ok: false; status: number; message: string };

/**
 * Apply a referral code for a user. Shared by /api/referral/apply and the
 * CK Mall coupon box (which accepts referral codes too).
 * Rules: code must exist, not be the user's own, user must not have applied
 * one before, and must have no successful purchase yet. On success the NEW
 * user gets REFERRAL_REWARD_NEW_USER coins immediately.
 */
export async function applyReferralCode(userId: string, rawCode: string): Promise<ApplyReferralResult> {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) return { ok: false, status: 400, message: "Please enter a code." };

  // Already applied?
  const already = await prisma.referral.findUnique({ where: { referreduserId: userId } });
  if (already) return { ok: false, status: 409, message: "You have already used a referral code." };

  // Not eligible if they've already purchased.
  const purchaseCount = await prisma.payment.count({ where: { userId, status: "success" } });
  if (purchaseCount > 0) {
    return { ok: false, status: 409, message: "Referral codes can only be applied before your first purchase." };
  }

  const referrer = await prisma.user.findUnique({
    where: { referralCode: code },
    select: { id: true },
  });
  if (!referrer) return { ok: false, status: 400, message: "Invalid code." };
  if (referrer.id === userId) return { ok: false, status: 400, message: "You can't use your own referral code." };

  await prisma.$transaction(async (tx) => {
    await tx.referral.create({
      data: {
        referrerId: referrer.id,
        referreduserId: userId,
        code,
        referredReward: REFERRAL_REWARD_NEW_USER,
      },
    });
    await tx.user.update({
      where: { id: userId },
      data: { referredById: referrer.id, referredAt: new Date() },
    });
  });

  await grantCoins(userId, REFERRAL_REWARD_NEW_USER, "Referral bonus — you joined using a friend's code");

  notifyCoinsEarned({
    userId,
    coins: REFERRAL_REWARD_NEW_USER,
    reason: "you applied a referral code",
    idempotencyKey: `referral_apply:${userId}`,
  }).catch(() => {});

  notifyReferralApplied(referrer.id).catch(() => {});

  return {
    ok: true,
    coinsAwarded: REFERRAL_REWARD_NEW_USER,
    message: `Referral applied! You earned ${REFERRAL_REWARD_NEW_USER} coins. 🎉`,
  };
}

/** Notify the referrer that someone used their code (reward comes on purchase). */
export async function notifyReferralApplied(referrerId: string): Promise<void> {
  try {
    await notifyCustom({
      userId: referrerId,
      title: "Someone used your referral code 🎉",
      body: `A friend just joined with your code. You'll earn ${REFERRAL_REWARD_REFERRER} coins when they make their first purchase!`,
      action: { type: "deeplink", target: "/referral" },
      idempotencyKey: `referral_applied:${referrerId}:${Date.now()}`,
    });
  } catch {
    /* non-blocking */
  }
}

/** Add coins to a user (creates UserCoins if missing) + logs a transaction. */
export async function grantCoins(
  userId: string,
  coins: number,
  reason: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.userCoins.upsert({
      where: { userId },
      update: { totalCoins: { increment: coins } },
      create: { userId, totalCoins: coins },
    });
    await tx.coinTransaction.create({
      data: { userId, coins, type: "EARNED", reason },
    });
  });
}

/**
 * Pay the referrer their reward when a referred user completes their FIRST
 * purchase. Idempotent: does nothing if already rewarded or no referral exists.
 * Safe to call from the payment webhook (never throws to the caller).
 */
export async function rewardReferrerOnFirstPurchase(referredUserId: string): Promise<void> {
  try {
    const referral = await prisma.referral.findUnique({
      where: { referreduserId: referredUserId },
    });
    if (!referral || referral.rewarded) return;

    // ── Atomically CLAIM the reward FIRST (prevents double-crediting) ──
    // Razorpay sends two events per payment (payment.authorized AND
    // payment.captured), so this function can run twice near-simultaneously.
    // We flip rewarded false→true in a single conditional updateMany; only the
    // call that actually changes a row (count === 1) proceeds to grant coins.
    // The concurrent duplicate matches 0 rows and stops.
    const claim = await prisma.referral.updateMany({
      where: { id: referral.id, rewarded: false },
      data: {
        rewarded: true,
        referrerReward: REFERRAL_REWARD_REFERRER,
        rewardedAt: new Date(),
      },
    });
    if (claim.count === 0) return; // another event already claimed it

    // Only the winner reaches here — grant the coins exactly once.
    await grantCoins(
      referral.referrerId,
      REFERRAL_REWARD_REFERRER,
      "Referral reward — a friend you invited made their first purchase"
    );

    notifyCoinsEarned({
      userId: referral.referrerId,
      coins: REFERRAL_REWARD_REFERRER,
      reason: "your referral made their first purchase",
      idempotencyKey: `referral_reward:${referral.id}`,
    }).catch(() => {});
  } catch {
    /* never block enrollment on referral reward failure */
  }
}

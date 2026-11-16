/**
 * Prices. The SERVER decides every amount from these numbers; nothing the
 * browser sends can change them. Browser-safe (no server imports), so the
 * payment page shows exactly what the server will charge.
 *
 *   ZenAlpha (AI, Cyber Safety, Robotics, GreenTech) and every single subject:
 *   ₹1,999 list price, 70% off = ₹599, for 3 months.
 *   A coupon then takes up to 30% off the ₹599.
 */

export type PlanId = "zenalpha" | "course";

export const PLAN_LIST_PRICE = 1999; // ₹, shown struck out
export const PLAN_OFF_PERCENT = 70; // shown as "70% OFF"
export const PLAN_PRICE = 599; // ₹ after the 70% (1999 × 0.30 ≈ 600, shown as 599)
export const COUPON_MAX_PERCENT = 30; // coupons never take more than this
export const ACCESS_DAYS = 90; // 3 months
export const ZENALPHA_NAME = "ZenAlpha";

export interface PriceBreakdown {
  listPrice: number;
  offPercent: number;
  price: number;
  couponPercent: number;
  couponOff: number;
  finalPrice: number;
}

/** The price of a plan with an optional coupon (the coupon is capped at 30%). */
export function priceFor(couponPercent = 0): PriceBreakdown {
  const pct = Math.max(0, Math.min(COUPON_MAX_PERCENT, Math.floor(Number(couponPercent) || 0)));
  const couponOff = Math.round((PLAN_PRICE * pct) / 100);
  return {
    listPrice: PLAN_LIST_PRICE,
    offPercent: PLAN_OFF_PERCENT,
    price: PLAN_PRICE,
    couponPercent: pct,
    couponOff,
    finalPrice: Math.max(1, PLAN_PRICE - couponOff),
  };
}

export const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

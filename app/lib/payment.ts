import Razorpay from "razorpay";

/**
 * Initialize Razorpay instance
 */
export const initRazorpay = () => {
  return new Razorpay({
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "",
  });
};

/**
 * Verify Razorpay payment signature
 * Used for additional verification on frontend responses
 */
export const verifyPaymentSignature = (
  orderId: string,
  paymentId: string,
  signature: string
) => {
  const crypto = require("crypto");
  const message = `${orderId}|${paymentId}`;
  const secret = process.env.RAZORPAY_KEY_SECRET || "";

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");

  return signature === expectedSignature;
};

/**
 * Format amount for Razorpay (paisa)
 */
export const formatAmountForRazorpay = (amountInRupees: number): number => {
  return Math.round(amountInRupees * 100);
};

/**
 * Convert paisa back to rupees
 */
export const convertPaisaToRupees = (amountInPaisa: number): number => {
  return amountInPaisa / 100;
};

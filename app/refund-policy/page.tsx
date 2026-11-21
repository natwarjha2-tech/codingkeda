import { redirect } from "next/navigation";

/** /refund-policy → the refunds section of the terms (one source of truth). */
export default function RefundPolicyPage() {
  redirect("/terms#refunds");
}

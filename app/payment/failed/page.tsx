import type { Metadata } from "next";
import { Suspense } from "react";
import KidsPage from "@/components/site/KidsPage";
import PaymentStatus from "@/components/site/PaymentStatus";

export const metadata: Metadata = { title: "Payment failed | CodingKida", robots: { index: false } };

export default function PaymentFailedPage() {
  return (
    <KidsPage>
      <section className="px-5 py-16">
        <Suspense fallback={null}><PaymentStatus mode="failed" /></Suspense>
      </section>
    </KidsPage>
  );
}

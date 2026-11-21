import type { Metadata } from "next";
import { Suspense } from "react";
import KidsPage from "@/components/site/KidsPage";
import PaymentStatus from "@/components/site/PaymentStatus";

export const metadata: Metadata = { title: "Payment status | CodingKida", robots: { index: false } };

export default function PaymentSuccessPage() {
  return (
    <KidsPage>
      <section className="px-5 py-16">
        <Suspense fallback={null}><PaymentStatus mode="success" /></Suspense>
      </section>
    </KidsPage>
  );
}

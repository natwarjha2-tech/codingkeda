import type { Metadata } from "next";
import { Suspense } from "react";
import KidsPage, { PageHeader } from "@/components/site/KidsPage";
import VerifyCertificate from "@/components/site/VerifyCertificate";

export const metadata: Metadata = {
  title: "Verify a certificate | CodingKida",
  description: "Check that a CodingKida course certificate is genuine.",
  alternates: { canonical: "/verify" },
};

export default function VerifyPage() {
  return (
    <KidsPage>
      <PageHeader
        badge="🎓 For schools and parents"
        title="Check a certificate"
        text="Enter the code from a CodingKida certificate to see who earned it."
      />
      <section className="px-5 py-12">
        <Suspense fallback={null}>
          <VerifyCertificate />
        </Suspense>
      </section>
    </KidsPage>
  );
}

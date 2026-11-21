import type { Metadata } from "next";
import KidsPage from "@/components/site/KidsPage";
import { SubscriptionPanel } from "@/components/site/AccountPanels";

export const metadata: Metadata = { title: "My subscription | CodingKida", robots: { index: false } };

export default function AccountSubscriptionPage() {
  return (
    <KidsPage>
      <section className="px-5 py-10">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-black mb-6">My account</h1>
          <SubscriptionPanel />
        </div>
      </section>
    </KidsPage>
  );
}

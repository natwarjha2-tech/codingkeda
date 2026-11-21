import type { Metadata } from "next";
import { Suspense } from "react";
import KidsPage from "@/components/site/KidsPage";
import Playground from "@/components/site/Playground";

export const metadata: Metadata = {
  title: "Online code playground for kids: Python, Java, C | CodingKida",
  description: "Write and run Python, Java, C and JavaScript code in your browser. Free for CodingKida students.",
  alternates: { canonical: "/playground" },
};

export default function PlaygroundPage() {
  return (
    <KidsPage>
      <Suspense fallback={<div className="h-[70vh]" />}>
        <Playground />
      </Suspense>
    </KidsPage>
  );
}

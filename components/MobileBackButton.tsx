"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function MobileBackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="md:hidden flex items-center gap-1.5 text-slate-400 hover:text-white text-sm font-medium mb-4 transition-colors"
    >
      <ArrowLeft size={16} /> Back
    </button>
  );
}

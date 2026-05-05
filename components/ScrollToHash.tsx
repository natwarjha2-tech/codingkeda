"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function ScrollToHash() {
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, []);

  return null;
}

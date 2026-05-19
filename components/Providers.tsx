"use client";
import { AuthModalProvider } from "@/context/AuthModalContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <AuthModalProvider>{children}</AuthModalProvider>;
}

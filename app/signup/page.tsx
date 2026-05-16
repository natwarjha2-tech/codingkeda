"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Signup() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to login page with signup mode
    router.replace("/login?mode=signup");
  }, [router]);

  return null;
}

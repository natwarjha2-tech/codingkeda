"use client";
import { useRouter } from "next/navigation";
import { useAuthModal } from "@/context/AuthModalContext";

/**
 * Returns a function that:
 * - Mobile: opens auth popup
 * - Desktop: redirects to /login page
 */
export function useAuthRedirect(redirectPath?: string) {
  const router = useRouter();
  const { openAuthModal } = useAuthModal();

  const triggerLogin = () => {
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      openAuthModal();
    } else {
      const url = redirectPath ? `/login?redirect=${encodeURIComponent(redirectPath)}` : "/login";
      router.push(url);
    }
  };

  return triggerLogin;
}

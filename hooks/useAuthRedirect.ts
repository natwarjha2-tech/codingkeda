"use client";
import { useAuthModal } from "@/context/AuthModalContext";

/**
 * Returns a function that:
 * - Mobile: opens mobile auth popup (bottom sheet)
 * - Desktop: opens desktop auth modal (centered with illustration)
 */
export function useAuthRedirect() {
  const { openAuthModal, openDesktopAuthModal } = useAuthModal();

  const triggerLogin = () => {
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      openAuthModal();
    } else {
      openDesktopAuthModal();
    }
  };

  return triggerLogin;
}

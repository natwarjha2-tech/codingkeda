"use client";
import { createContext, useContext, useState, useCallback } from "react";
import AuthModal from "@/components/AuthModal";
import DesktopAuthModal from "@/components/DesktopAuthModal";

interface AuthModalContextType {
  openAuthModal: () => void;
  closeAuthModal: () => void;
  openDesktopAuthModal: () => void;
  closeDesktopAuthModal: () => void;
}

const AuthModalContext = createContext<AuthModalContextType>({
  openAuthModal: () => {},
  closeAuthModal: () => {},
  openDesktopAuthModal: () => {},
  closeDesktopAuthModal: () => {},
});

export function useAuthModal() {
  return useContext(AuthModalContext);
}

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDesktopOpen, setIsDesktopOpen] = useState(false);

  const openAuthModal = useCallback(() => setIsOpen(true), []);
  const closeAuthModal = useCallback(() => setIsOpen(false), []);
  const openDesktopAuthModal = useCallback(() => setIsDesktopOpen(true), []);
  const closeDesktopAuthModal = useCallback(() => setIsDesktopOpen(false), []);

  return (
    <AuthModalContext.Provider value={{ openAuthModal, closeAuthModal, openDesktopAuthModal, closeDesktopAuthModal }}>
      {children}
      <AuthModal isOpen={isOpen} onClose={closeAuthModal} />
      <DesktopAuthModal isOpen={isDesktopOpen} onClose={closeDesktopAuthModal} />
    </AuthModalContext.Provider>
  );
}

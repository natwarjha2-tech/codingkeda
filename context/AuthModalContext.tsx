"use client";
import { createContext, useContext, useState, useCallback } from "react";
import AuthModal from "@/components/AuthModal";

interface AuthModalContextType {
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

const AuthModalContext = createContext<AuthModalContextType>({
  openAuthModal: () => {},
  closeAuthModal: () => {},
});

export function useAuthModal() {
  return useContext(AuthModalContext);
}

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openAuthModal = useCallback(() => setIsOpen(true), []);
  const closeAuthModal = useCallback(() => setIsOpen(false), []);

  return (
    <AuthModalContext.Provider value={{ openAuthModal, closeAuthModal }}>
      {children}
      <AuthModal isOpen={isOpen} onClose={closeAuthModal} />
    </AuthModalContext.Provider>
  );
}

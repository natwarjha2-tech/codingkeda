"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getToken, logoutUser } from "@/services/auth";

const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours

/**
 * SessionGuard — auto logout after inactivity
 * Monitors mouse/keyboard activity. If no activity for 2 hours, logs user out.
 * Also checks token expiry on mount.
 */
export default function SessionGuard() {
  const router = useRouter();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const doLogout = () => {
      logoutUser();
      localStorage.removeItem("user");
      localStorage.removeItem("userEmail");
      localStorage.removeItem("ck_token");
      router.push("/login");
    };

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(doLogout, INACTIVITY_TIMEOUT);
    };

    // Start timer
    resetTimer();

    // Reset on user activity
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetTimer));

    // Check token expiry — if API returns 401, logout
    const checkToken = async () => {
      try {
        const res = await fetch("/api/student", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) doLogout();
      } catch {}
    };
    checkToken();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [router]);

  return null;
}

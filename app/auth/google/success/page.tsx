"use client";
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getWebDevice } from "@/app/lib/web-device";
import { consentBlocked } from "@/app/lib/consent-client";

function GoogleSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const userRaw = searchParams.get("user");

    if (!token || !userRaw) {
      router.replace("/login?error=google_failed");
      return;
    }

    (async () => {
      try {
        const user = JSON.parse(decodeURIComponent(userRaw));

        // Device limit: tie this Google sign-in to this browser (one device at a time).
        let finalToken = token;
        const res = await fetch("/api/auth/device", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ device: getWebDevice() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          window.alert(data.message || "This account is already used on another device. Please sign in with your email to switch.");
          router.replace("/login");
          return;
        }
        if (data.token) finalToken = data.token;

        localStorage.setItem("token", finalToken);
        localStorage.setItem("ck_token", finalToken);
        localStorage.setItem("userEmail", user.email || "");
        localStorage.setItem("user", JSON.stringify({ ...user, loginMethod: "google" }));

        // Under 18 and the parent isn't verified yet (deadline passed): finish that first.
        window.location.href = (await consentBlocked(finalToken)) ? "/parent-consent" : "/dashboard";
      } catch {
        router.replace("/login?error=google_failed");
      }
    })();
  }, [searchParams, router]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0f0f1a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      gap: "16px",
    }}>
      <div style={{
        width: "48px", height: "48px",
        border: "4px solid rgba(108,71,255,0.3)",
        borderTopColor: "#6c47ff",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem" }}>
        Signing you in with Google...
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function GoogleSuccessPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#0f0f1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.6)" }}>Loading...</p>
      </div>
    }>
      <GoogleSuccessContent />
    </Suspense>
  );
}

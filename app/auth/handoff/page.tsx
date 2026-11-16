"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

/**
 * /auth/handoff?code=…  — opened by the CodingKida apps.
 * Swaps the one-time code for a website sign-in, removes the code from the
 * address bar, and opens the page the app asked for (e.g. the payment page),
 * so the student doesn't have to sign in again.
 */
function HandoffContent() {
  const searchParams = useSearchParams();
  const [failed, setFailed] = useState("");

  useEffect(() => {
    const code = searchParams.get("code") || "";
    // Don't leave the code in the address bar or history.
    try { window.history.replaceState(null, "", "/auth/handoff"); } catch { /* ignore */ }
    if (!code) { setFailed("This link is not complete. Please try again from the app."); return; }

    (async () => {
      try {
        const res = await fetch("/api/auth/web-handoff/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.token) {
          setFailed(data.message || "This link has expired. Please try again from the app.");
          return;
        }
        localStorage.setItem("token", data.token);
        localStorage.setItem("ck_token", data.token);
        localStorage.setItem("userEmail", data.user?.email || "");
        localStorage.setItem("user", JSON.stringify({ ...data.user, loginMethod: "app" }));
        const next = typeof data.next === "string" && data.next.startsWith("/") && !data.next.startsWith("//") ? data.next : "/dashboard";
        window.location.replace(next);
      } catch {
        setFailed("Could not reach CodingKida. Check your internet connection and try again.");
      }
    })();
  }, [searchParams]);

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f1a", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 24, textAlign: "center" }}>
      {failed ? (
        <>
          <p style={{ color: "#fca5a5", fontSize: "0.95rem", maxWidth: 360 }}>{failed}</p>
          <a href="/login" style={{ color: "#a78bfa", fontWeight: 600 }}>Sign in on the website instead</a>
        </>
      ) : (
        <>
          <div style={{ width: 44, height: 44, border: "4px solid rgba(108,71,255,0.3)", borderTopColor: "#6c47ff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem" }}>Opening securely…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </>
      )}
    </div>
  );
}

export default function HandoffPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0f0f1a" }} />}>
      <HandoffContent />
    </Suspense>
  );
}

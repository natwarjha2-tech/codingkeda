/**
 * CodingKida brand text matching the logo.
 * Since the logo uses a custom font style for "Kid" that can't be replicated perfectly in CSS,
 * we use bold colored letters. For pixel-perfect match, use the logo image directly.
 * Coding = white, K = red (bold), i = orange (bold), d = green (bold), a = white
 */
export default function CodingKidaLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-extrabold ${className}`}>
      <span style={{ color: "#ffffff" }}>Coding</span>
      <span style={{ color: "#ef4444", fontWeight: 900 }}>K</span>
      <span style={{ color: "#f59e0b", fontWeight: 900 }}>i</span>
      <span style={{ color: "#22c55e", fontWeight: 900 }}>d</span>
      <span style={{ color: "#ffffff" }}>a</span>
    </span>
  );
}

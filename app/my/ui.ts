/** Card header background from a course colour (falls back to the brand purple). */
export function courseBg(color?: string | null) {
  return color && /^#[0-9a-f]{3,8}$/i.test(color)
    ? { background: `linear-gradient(135deg, ${color}, #1e1b4b)` }
    : { background: "linear-gradient(135deg, #7c3aed, #1e1b4b)" };
}

/** Same subject look as the desktop app (getSubjectTheme in courses.js): banner image + accent colour. */
export function subjectTheme(title?: string | null): { banner: string; accent: string; gradient: string } {
  const t = (title || "").toLowerCase().trim();
  if (t === "c" || t.includes("c programming") || t.startsWith("c ")) return { banner: "/desk/c-banner.jpeg", accent: "#3b82f6", gradient: "linear-gradient(135deg,#3b82f6,#1d4ed8)" };
  if (t.includes("java") && !t.includes("javascript")) return { banner: "/desk/java-banner.jpeg", accent: "#f97316", gradient: "linear-gradient(135deg,#f97316,#c2410c)" };
  if (t.includes("python")) return { banner: "/desk/python-banner.jpeg", accent: "#3b82f6", gradient: "linear-gradient(135deg,#3b82f6,#facc15)" };
  if (t.includes("dsa") || t.includes("data structure") || t.includes("algorithm")) return { banner: "/desk/dsa-banner.svg", accent: "#8b5cf6", gradient: "linear-gradient(135deg,#8b5cf6,#6d28d9)" };
  if (t.includes("web")) return { banner: "/desk/web-banner.svg", accent: "#06b6d4", gradient: "linear-gradient(135deg,#06b6d4,#2563eb)" };
  if (t.includes("robot")) return { banner: "/desk/robotics-banner.svg", accent: "#64748b", gradient: "linear-gradient(135deg,#64748b,#0f172a)" };
  if (t.includes("artificial") || t === "ai" || t.startsWith("ai ") || t.includes(" ai") || t.includes("machine learning")) return { banner: "/desk/ai-banner.svg", accent: "#ec4899", gradient: "linear-gradient(135deg,#ec4899,#8b5cf6)" };
  if (t.includes("problem")) return { banner: "/desk/problem-banner.svg", accent: "#10b981", gradient: "linear-gradient(135deg,#10b981,#059669)" };
  return { banner: "", accent: "#6c47ff", gradient: "linear-gradient(135deg,#6c47ff,#3b1fa8)" };
}

/** Small square subject logo (desktop assets copied to /desk/*-logo.*), or "" if none. */
export function subjectLogo(title?: string | null): string {
  const b = subjectTheme(title).banner;
  if (!b) return "";
  const name = b.replace("/desk/", "").replace(/-banner\.[a-z]+$/, "");
  return ["c", "java", "python"].includes(name) ? `/desk/${name}-logo.png` : `/desk/${name}-logo.svg`;
}

/** Course icon if it is a short emoji, else a book. */
export function courseIcon(icon?: string | null) {
  return icon && icon.length <= 4 ? icon : "📘";
}

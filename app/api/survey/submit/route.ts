import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { sendEmail } from "@/app/lib/mail";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Packages matching SurveySection.tsx ──────────────────────────────────────
const PACKAGES = {
  zenz: {
    id: "zenz",
    name: "ZenZ Package",
    tag: "For Class 4–8",
    description: "A fun, beginner-friendly coding journey designed for young learners.",
    features: ["Scratch & Python basics", "Build games & animations", "Live mentor support", "Certificate on completion"],
    level: "beginner",
  },
  zenalpha: {
    id: "zenalpha",
    name: "ZenAlpha Package",
    tag: "For Class 9–12",
    description: "Advanced coding curriculum for high schoolers ready to go deep.",
    features: ["DSA & real-world projects", "Web & App development", "Career-ready skills", "Industry certificate"],
    level: "advanced",
  },
};

// ── Rule-based recommendation ─────────────────────────────────────────────────
function recommendPackage(answers: Record<string, string>) {
  const classGroup = answers.classGroup || answers.class || "";
  // Class 4-8 → ZenZ, Class 9-12 → ZenAlpha
  if (classGroup === "4-8") return PACKAGES.zenz;
  if (classGroup === "9-12") return PACKAGES.zenalpha;
  // Fallback: check experience/interest
  const ctx = JSON.stringify(answers).toLowerCase();
  if (ctx.includes("advanced") || ctx.includes("9") || ctx.includes("10") || ctx.includes("11") || ctx.includes("12")) {
    return PACKAGES.zenalpha;
  }
  return PACKAGES.zenz;
}

// ── Email template ────────────────────────────────────────────────────────────
function buildRecommendationEmail(name: string, pkg: typeof PACKAGES.zenz): string {
  const loginUrl = process.env.NEXT_PUBLIC_BASE_URL
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/login`
    : "https://www.codingkida.com/login";

  const featureList = pkg.features
    .map((f) => `<li style="margin-bottom:6px;">✅ ${f}</li>`)
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0f0f1a;color:#e2e8f0;padding:32px;border-radius:16px;">
      <h2 style="color:#a78bfa;margin-bottom:4px;">Hey ${name}! 🎉</h2>
      <p style="color:#94a3b8;margin-bottom:24px;">Based on your survey answers, here's your personalized course recommendation:</p>

      <div style="background:linear-gradient(135deg,rgba(124,58,237,0.18),rgba(236,72,153,0.08));border:1px solid rgba(124,58,237,0.3);border-radius:12px;padding:24px;margin-bottom:24px;">
        <h3 style="color:#ffffff;font-size:22px;margin:0 0 4px;">${pkg.name}</h3>
        <span style="background:rgba(124,58,237,0.25);color:#c4b5fd;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;">${pkg.tag}</span>
        <p style="color:#cbd5e1;margin:16px 0;">${pkg.description}</p>
        <ul style="color:#cbd5e1;padding-left:0;list-style:none;margin:0;">
          ${featureList}
        </ul>
      </div>

      <a href="${loginUrl}"
        style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#ec4899);color:#ffffff;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:15px;">
        🚀 Login & Start Learning
      </a>

      <p style="color:#475569;font-size:12px;margin-top:24px;">— The CodingKeda Team</p>
    </div>
  `;
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, ...rest } = body;
    const answers = rest; // classGroup, experience, interest, etc.

    if (!email?.trim()) {
      return NextResponse.json(
        { success: false, message: "Email is required." },
        { status: 400 }
      );
    }

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { success: false, message: "Invalid email format." },
        { status: 400 }
      );
    }

    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      return NextResponse.json(
        { success: false, message: "Answers must be a valid JSON object." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const recommended = recommendPackage(answers as Record<string, string>);

    // Save survey response to DB
    const response = await prisma.surveyResponse.create({
      data: {
        email: normalizedEmail,
        answers: { ...answers, name: name || "" },
        result: recommended.id,
      },
    });

    // Send recommendation email with login link (fire-and-forget)
    const displayName = (name as string)?.split(" ")[0] || "there";
    Promise.resolve(
      sendEmail(
        normalizedEmail,
        `Your Personalized Course: ${recommended.name} \uD83C\uDFAF`,
        buildRecommendationEmail(displayName, recommended)
      )
    ).catch(() => {}); // silently ignore — CWE-117: no user data in logs

    return NextResponse.json({
      success: true,
      message: "Survey submitted successfully.",
      responseId: response.id,
      recommendation: recommended,
    });
  } catch (error) {
    console.error("Survey submit error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

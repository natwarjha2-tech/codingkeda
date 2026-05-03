import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { sendEmail } from "@/app/lib/mail";
import { COURSES } from "@/app/lib/courses";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 🔥 Welcome Email Template
function buildWelcomeEmail(name: string): string {
  const courseList = COURSES.map(
    (c) =>
      `<li><strong>${c.title}</strong> (${c.level}) - ${c.description}</li>`
  ).join("");

  return `
    <h2>Welcome to CodingKeda, ${name}! 🚀</h2>
    <p>Here's a quick look at what we offer:</p>
    <ul>${courseList}</ul>
    <p>Ready to find the perfect course for you?</p>

    <a href="${process.env.NEXT_PUBLIC_BASE_URL}/login"
       style="background:#6366f1;color:#fff;padding:10px 20px;
              border-radius:6px;text-decoration:none;">
       Log in to get started
    </a>

    <p style="color:#888;font-size:12px;">
      — The CodingKeda Team
    </p>
  `;
}

export async function POST(req: NextRequest) {
  try {
    // 🔥 STEP 1: Raw input lo
    const body = await req.json();

    // 🔥 STEP 2: Clean (sanitize) input
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();

    // ✅ STEP 3: Required validation
    if (!name || !email) {
      return NextResponse.json(
        { success: false, message: "Name and email are required." },
        { status: 400 }
      );
    }

    // ✅ STEP 4: Email format validation (AFTER trim)
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { success: false, message: "Invalid email format." },
        { status: 400 }
      );
    }

    // ✅ STEP 5: Duplicate check
    const existing = await prisma.surveyLead.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: "Email already registered." },
        { status: 409 }
      );
    }

    // ✅ STEP 6: Save lead
    const lead = await prisma.surveyLead.create({
      data: {
        name,
        email,
      },
    });

    // 🔥 STEP 7: Send email (non-blocking)
    try {
      await sendEmail(
        lead.email,
        "Welcome to CodingKeda 🚀",
        buildWelcomeEmail(lead.name)
      );
      console.log("✅ Welcome email sent");
    } catch (err) {
      console.error("❌ Email sending failed:", err);
    }

    // ✅ STEP 8: Response
    return NextResponse.json(
      {
        success: true,
        message: "Lead captured successfully.",
        leadId: lead.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Lead API error:", error);

    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
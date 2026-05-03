import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { recommendCourse } from "@/app/lib/courses";
import { sendEmail } from "@/app/lib/mail";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const { email, answers } = await req.json();

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
    const recommended = recommendCourse(answers as Record<string, string>);

    const response = await prisma.surveyResponse.create({
      data: { email: normalizedEmail, answers, result: recommended.id },
    });

    Promise.resolve(
      sendEmail(
        normalizedEmail,
        "Your Recommended Course 🎯",
        `<h2>Your Recommended Course: ${recommended.title}</h2>
         <p>${recommended.description}</p>
         <p><b>Level:</b> ${recommended.level}</p>`
      )
    ).catch((err) => console.error("Email send failed:", err));

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
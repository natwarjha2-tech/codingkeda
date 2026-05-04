import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();

    if (!name || !email) {
      return NextResponse.json(
        { success: false, message: "Name and email are required." },
        { status: 400 }
      );
    }

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { success: false, message: "Invalid email format." },
        { status: 400 }
      );
    }

    const existing = await prisma.surveyLead.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { success: false, message: "Email already registered." },
        { status: 409 }
      );
    }

    const lead = await prisma.surveyLead.create({
      data: { name, email },
    });

    return NextResponse.json(
      { success: true, message: "Lead captured successfully.", leadId: lead.id },
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

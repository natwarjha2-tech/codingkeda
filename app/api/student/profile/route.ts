import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

/**
 * PATCH /api/student/profile
 * Update student name and/or avatar URL
 * Requires valid user token
 */
export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    const { name, avatarUrl } = await req.json();

    if (!name?.trim() && !avatarUrl?.trim()) {
      return NextResponse.json(
        { success: false, message: "Nothing to update." },
        { status: 400 }
      );
    }

    const updateData: Record<string, string> = {};
    if (name?.trim()) updateData.name = name.trim();

    const user = await prisma.user.update({
      where: { id: payload.userId },
      data: updateData,
      select: { id: true, name: true, email: true, role: true },
    });

    return NextResponse.json({ success: true, user });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

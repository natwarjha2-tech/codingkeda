import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import { signToken } from "@/app/lib/auth";
import { apiSuccess, apiError } from "@/app/lib/response";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, role } = await req.json();

    if (!email || !password) return apiError(400, "Email and password are required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return apiError(400, "Invalid email format.");
    if (password.length < 8) return apiError(400, "Password must be at least 8 characters.");

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return apiError(409, "Email already registered.");

    const hashedPassword = await bcrypt.hash(password, 10);
    const assignedRole = role === "admin" ? "admin" : "user";

    const user = await prisma.user.create({
      data: { name: name?.trim() || "", email, password: hashedPassword, role: assignedRole },
    });

    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    return apiSuccess({
      message: "Account created successfully.",
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    }, 201);
  } catch {
    return apiError(500, "Internal server error.");
  }
}

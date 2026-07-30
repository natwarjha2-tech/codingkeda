import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import { signToken } from "@/app/lib/auth";
import { apiSuccess, apiError } from "@/app/lib/response";
import { getSignedFileUrlFromUrl, getS3KeyFromUrl } from "@/app/lib/s3";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return apiError(400, "Email and password are required.");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return apiError(401, "Invalid credentials.");

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return apiError(401, "Invalid credentials.");

    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    // Generate fresh presigned URL if avatar exists (private S3 bucket)
    let avatarUrl: string | null = null;
    if (user.avatarUrl) {
      try {
        const s3Key = getS3KeyFromUrl(user.avatarUrl);
        if (s3Key) avatarUrl = await getSignedFileUrlFromUrl(user.avatarUrl, 86400);
        else avatarUrl = user.avatarUrl;
      } catch { avatarUrl = null; }
    }

    return apiSuccess({
      message: `Logged in as ${user.role}.`,
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl },
    });
  } catch {
    return apiError(500, "Internal server error.");
  }
}

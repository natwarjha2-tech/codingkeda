import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { signToken } from "@/app/lib/auth";

/**
 * GET /api/auth/google/callback
 * Handles Google OAuth callback — creates/finds user, returns JWT
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.codingkida.com";

  // User denied access
  if (error || !code) {
    return NextResponse.redirect(`${baseUrl}/login?error=google_denied`);
  }

  try {
    // Step 1: Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return NextResponse.redirect(`${baseUrl}/login?error=google_token_failed`);
    }

    // Step 2: Get user info from Google
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const googleUser = await userInfoRes.json();
    const { sub: googleId, email, name, picture } = googleUser;

    if (!email || !googleId) {
      return NextResponse.redirect(`${baseUrl}/login?error=google_no_email`);
    }

    // Step 3: Find or create user in DB
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { googleId },
          { email: email.toLowerCase() },
        ],
      },
    });

    if (user) {
      // Update googleId if not set (existing password user logging in with Google)
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            avatarUrl: user.avatarUrl || picture || null,
          },
        });
      }
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          name: name || email.split("@")[0],
          password: "", // no password for Google users
          googleId,
          role: "user",
          avatarUrl: picture || null,
        },
      });

      // Create student record
      await prisma.student.create({
        data: {
          userId: user.id,
          name: user.name,
          email: user.email,
          enrolledCourses: 0,
        },
      }).catch(() => {}); // ignore if already exists
    }

    // Step 4: Generate JWT (1 year expiry)
    const token = signToken({ userId: user.id, email: user.email, role: user.role }, "365d");

    // Step 5: Redirect to frontend with token
    // For web browser: redirect to dashboard with token in URL (frontend reads and stores it)
    // For desktop app: handled via deep link or same redirect
    const userData = encodeURIComponent(JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
    }));

    // Detect if request came from desktop app (user-agent check) or web
    const userAgent = req.headers.get("user-agent") || "";
    const isDesktop = userAgent.includes("Electron");

    if (isDesktop) {
      // Redirect to deep link for desktop app
      return NextResponse.redirect(
        `codingkida://auth?token=${token}&user=${userData}`
      );
    }

    // Web browser: redirect to success page
    return NextResponse.redirect(
      `${baseUrl}/auth/google/success?token=${token}&user=${userData}`
    );
  } catch (err) {
    console.error("Google OAuth error:", err);
    return NextResponse.redirect(`${baseUrl}/login?error=google_failed`);
  }
}

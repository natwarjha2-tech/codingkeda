import { NextRequest, NextResponse } from "next/server";
import { verifyToken, JwtPayload } from "./auth";

export type AuthenticatedRequest = NextRequest & {
  user?: JwtPayload;
};

/**
 * Middleware to verify JWT token and extract user info
 * @param req - Next.js request object
 * @returns User payload or null if invalid
 */
export function extractUser(req: NextRequest): JwtPayload | null {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) return null;

    return verifyToken(token);
  } catch {
    return null;
  }
}

/**
 * Middleware to check if user is authenticated
 * @param req - Next.js request object
 * @returns Response with 401 if not authenticated, null otherwise
 */
export function requireAuth(req: NextRequest): {
  error?: NextResponse;
  user?: JwtPayload;
} {
  const user = extractUser(req);

  if (!user) {
    return {
      error: NextResponse.json(
        { success: false, message: "Unauthorized. Please login." },
        { status: 401 }
      ),
    };
  }

  return { user };
}

/**
 * Middleware to check if user is admin
 * @param req - Next.js request object
 * @returns Response with 403 if not admin, null otherwise
 */
export function requireAdmin(req: NextRequest): {
  error?: NextResponse;
  user?: JwtPayload;
} {
  const { error, user } = requireAuth(req);

  if (error) return { error };

  if (user?.role !== "admin") {
    return {
      error: NextResponse.json(
        { success: false, message: "Forbidden. Admin access required." },
        { status: 403 }
      ),
    };
  }

  return { user };
}

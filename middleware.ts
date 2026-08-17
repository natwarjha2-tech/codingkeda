import { NextRequest, NextResponse } from "next/server";

/**
 * Next.js Edge Middleware — API Request Logger + Correlation ID
 * 
 * For every API request:
 * 1. Generates a unique correlation ID (UUID v4)
 * 2. Passes it to the route handler via x-request-id header
 * 3. Returns it in the response header (for client-side tracing)
 * 4. Logs the request entry with method, path, and correlation ID
 * 
 * Coverage: ALL /api/* routes automatically.
 */

export function middleware(req: NextRequest) {
  // Generate correlation ID (use existing client-sent ID if present, else generate)
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const method = req.method;
  const path = req.nextUrl.pathname;

  // Log entry with correlation ID
  console.log(
    `[${new Date().toISOString()}] [INFO] [api-middleware] action=request_received method=${method} path=${path} requestId=${requestId}`
  );

  // Pass correlation ID to route handler via request headers
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-request-id", requestId);

  // Continue to route handler with modified headers
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Add correlation ID + API version to response headers
  response.headers.set("x-request-id", requestId);
  response.headers.set("x-api-version", "v1");

  return response;
}

/**
 * Matcher: Only run this middleware on API routes.
 * Excludes static files, images, _next, and non-API pages.
 */
export const config = {
  matcher: "/api/:path*",
};

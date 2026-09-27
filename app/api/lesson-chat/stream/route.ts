import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { extractUser } from "@/app/lib/middleware";
import { getLessonMessages, resolveLessonContext } from "@/app/lib/lesson-chat";

/**
 * GET /api/lesson-chat/stream?lessonId=...&token=<jwt>
 *
 * Server-Sent Events (SSE) stream of a lesson's Q&A chat. New messages are
 * pushed to the client in near-real-time.
 *
 * Why DB-backed polling inside the stream (not an in-memory event bus):
 * the backend runs as standalone/serverless Next.js on Neon Postgres with no
 * shared pub/sub — an in-memory bus would silently drop cross-instance events.
 * Checking the DB with an `after` cursor every few seconds is reliable across
 * instances and still feels real-time to the client (it receives pushes, it
 * does not poll). Reuses `getLessonMessages` so there is no duplicated logic.
 *
 * Auth: EventSource can't send Authorization headers, so the JWT is passed as a
 * `?token=` query param and validated the same way as the header flow.
 */

// This route must run on the Node.js runtime (long-lived stream + Prisma).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 3000;   // how often the server checks for new messages
const HEARTBEAT_MS = 25000;      // keep-alive comment so proxies don't close idle connections

export async function GET(req: NextRequest) {
  const lessonId = req.nextUrl.searchParams.get("lessonId")?.trim();
  const token = req.nextUrl.searchParams.get("token")?.trim();
  if (!lessonId) {
    return new Response("lessonId is required", { status: 400 });
  }

  // Validate the token via the same extractor (it reads the Authorization
  // header; EventSource can't set headers, so we rebuild a request-like object
  // by cloning headers with the query token as a Bearer header).
  const authReq = new NextRequest(req.url, {
    headers: token
      ? new Headers({ authorization: `Bearer ${token}` })
      : req.headers,
  });
  const user = extractUser(authReq);
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Access check: instructor of the course, or an enrolled student.
  const ctx = await resolveLessonContext(lessonId);
  if (!ctx) return new Response("Lesson not found", { status: 404 });

  const isInstructor = !!ctx.instructorUserId && ctx.instructorUserId === user.userId;
  if (!isInstructor) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.userId, courseId: ctx.courseId } },
      select: { id: true },
    });
    if (!enrollment) return new Response("Forbidden", { status: 403 });
  }

  const viewerId = user.userId;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      // Cursor starts "now" so the stream only pushes messages that arrive AFTER
      // the client connected (the client already loaded history via the REST GET).
      let cursor = new Date().toISOString();

      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      // Initial "ready" event so the client knows the stream is live.
      send("ready", { lessonId, isInstructor });

      const poll = async () => {
        if (closed) return;
        try {
          const fresh = await getLessonMessages(lessonId, { after: cursor, viewerId });
          if (fresh.length > 0) {
            cursor = fresh[fresh.length - 1].createdAt;
            for (const m of fresh) send("message", m);
          }
        } catch {
          // Transient DB error — keep the stream alive and retry next tick.
        }
      };

      const pollTimer = setInterval(poll, POLL_INTERVAL_MS);
      const heartbeatTimer = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: keep-alive\n\n`));
      }, HEARTBEAT_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      // Stop everything when the client disconnects.
      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable proxy buffering (nginx) so events flush immediately
    },
  });
}

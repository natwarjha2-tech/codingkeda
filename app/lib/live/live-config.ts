/**
 * CodingKida — Live Class Config (ISOLATED MODULE)
 *
 * Central configuration for the Live Class feature. Everything live-class
 * related lives under `app/lib/live/*` and `app/api/live/*` so the feature is a
 * self-contained package: bugs can be fixed here without touching courses,
 * payments, auth, etc., and the whole feature can be switched off with one flag.
 *
 * Reuses the SAME AWS credentials already configured for S3 (AWS_ACCESS_KEY_ID /
 * AWS_SECRET_ACCESS_KEY) — no new keys, no duplication. Only the Chime-specific
 * regions and the recording S3 prefix are added as new (optional) env vars.
 *
 * Region note (verified against AWS Chime SDK docs):
 * - CONTROL region = where the Chime SDK Meetings control-plane API is called
 *   (CreateMeeting / CreateAttendee). AWS restricts this to specific regions;
 *   `us-east-1` is the standard default. This is independent of where EC2 runs.
 * - MEDIA region = where the actual audio/video media is routed. For Indian
 *   users `ap-south-1` (Mumbai) gives the lowest latency.
 */

/**
 * Master switch for the entire Live Class feature. When false, every live route
 * should short-circuit (feature off) WITHOUT affecting the rest of the backend.
 * Defaults to false so the feature stays dormant until explicitly enabled.
 */
export const LIVE_CLASS_ENABLED =
  (process.env.LIVE_CLASS_ENABLED ?? "false").toLowerCase() === "true";

/**
 * Chime SDK Meetings control-plane region (API calls). AWS-restricted; default
 * us-east-1. Override via env only if you know the region is supported.
 */
export const CHIME_CONTROL_REGION = process.env.CHIME_CONTROL_REGION ?? "us-east-1";

/**
 * Media placement region for the actual audio/video streams. Defaults to the
 * app's existing AWS_REGION (ap-south-1 / Mumbai) for low latency in India.
 */
export const CHIME_MEDIA_REGION =
  process.env.CHIME_MEDIA_REGION ?? process.env.AWS_REGION ?? "ap-south-1";

/**
 * S3 bucket + key prefix where class recordings are stored. Reuses the existing
 * S3 bucket (AWS_S3_BUCKET_NAME); recordings go under a dedicated prefix so they
 * never mix with course videos/PDFs.
 */
export const LIVE_RECORDING_BUCKET = process.env.AWS_S3_BUCKET_NAME ?? "";
export const LIVE_RECORDING_PREFIX = process.env.LIVE_RECORDING_PREFIX ?? "live-recordings";

/**
 * Chime SDK Media Pipelines REGION (where the CreateMediaCapturePipeline API
 * runs).
 *
 * CRITICAL (verified against AWS docs): Media Capture Pipelines are ONLY
 * available in a subset of regions — e.g. us-east-1, us-west-2, ap-southeast-1,
 * eu-central-1. India's `ap-south-1` (Mumbai) does NOT support media pipelines,
 * so running the pipeline there returns ForbiddenException.
 *
 * `us-east-1` is the UNIVERSAL choice: a pipeline in us-east-1 works with a
 * meeting created in ANY region/endpoint. So we pin the PIPELINE to us-east-1
 * (overridable via env) regardless of where the meeting's media is — the
 * meeting is referenced by its own region in the SourceArn (see below), which
 * is how AWS links a us-east-1 pipeline to a meeting hosted elsewhere.
 */
export const CHIME_PIPELINE_REGION =
  process.env.CHIME_PIPELINE_REGION ?? "us-east-1";

/**
 * AWS account id — needed to build the Chime meeting ARN (SourceArn) and the S3
 * bucket ARN (SinkArn) that the media capture pipeline requires. Optional: if
 * unset, recording calls fail cleanly instead of throwing. The rest of the live
 * feature (video/audio/chat) does NOT need this.
 */
export const AWS_ACCOUNT_ID = process.env.AWS_ACCOUNT_ID ?? "";

/**
 * True only when recording is fully configured (feature on + AWS creds +
 * account id + a recording bucket). Lets routes return a clean "recording
 * unavailable" instead of throwing when the extra recording config is missing.
 */
export function isRecordingConfigured(): boolean {
  return (
    isLiveClassConfigured() &&
    !!AWS_ACCOUNT_ID &&
    !!LIVE_RECORDING_BUCKET
  );
}

/**
 * Reasonable safety limits for a class (prevents runaway cost/abuse).
 */
export const LIVE_LIMITS = {
  // Max attendees per meeting (Chime hard limit is higher; this is a product cap).
  maxAttendees: 250,
  // Attendee join token validity is managed by Chime; kept here for reference.
};

/**
 * Host-disconnect policy (Phase 3). The host's client sends a heartbeat while a
 * class is live. If no heartbeat arrives within LIVE_HOST_GRACE_MS, a lazy
 * stale-sweep auto-ends the class (Chime meeting deleted, status → ended) so a
 * host crash/close never leaves a ghost "live" class or a leaked meeting.
 *
 * The grace window lets a host survive a transient network blip / app reopen
 * without the class ending under them (mirrors Zoom/Meet "host can rejoin").
 */
export const LIVE_HOST_GRACE_MS = Number(process.env.LIVE_HOST_GRACE_MS) || 120000; // 2 min

/**
 * Minimum gap between lazy stale-sweeps. The sweep runs opportunistically on
 * list/join reads; this throttle keeps it from hitting the DB on every request.
 */
export const LIVE_SWEEP_THROTTLE_MS = Number(process.env.LIVE_SWEEP_THROTTLE_MS) || 45000; // 45s

/**
 * Optional shared secret protecting the manual sweep endpoint
 * (POST /api/live/classes/sweep) so an external scheduler (system cron / CI)
 * can trigger a sweep even when no one is reading the list. Empty = endpoint
 * disabled (the lazy on-read sweep already covers the common case).
 */
export const LIVE_CRON_SECRET = process.env.LIVE_CRON_SECRET ?? "";

/**
 * Live-chat retention policy (Phase 7 / F19 + L15).
 *
 * How many days class-chat messages are kept before they MAY be pruned. This is
 * the single knob for the chat data lifecycle.
 *
 *   0 (default) = retention DISABLED → messages are kept indefinitely and the
 *                 prune helper is a no-op. Nothing is ever deleted unless an
 *                 operator explicitly sets a positive value AND runs the prune.
 *   N (> 0)     = messages older than N days become eligible for pruning.
 *
 * Privacy note (L15): class chat is already access-restricted to class
 * participants (host / instructor / enrolled student) via resolveJoinAccess,
 * and stores only user-authored text + a server-resolved display name (no extra
 * PII). This constant adds a documented retention lifecycle on top of that.
 *
 * SAFETY: pruning performs a DELETE. It is deliberately opt-in (default 0) and
 * never auto-runs; an operator enables a window and triggers it deliberately.
 */
export const LIVE_CHAT_RETENTION_DAYS = Number(process.env.LIVE_CHAT_RETENTION_DAYS) || 0;

/**
 * True only when the feature is enabled AND the AWS credentials needed by Chime
 * are present. Routes use this to fail cleanly ("live class unavailable")
 * instead of throwing when the backend isn't configured for live classes yet.
 */
export function isLiveClassConfigured(): boolean {
  return (
    LIVE_CLASS_ENABLED &&
    !!process.env.AWS_ACCESS_KEY_ID &&
    !!process.env.AWS_SECRET_ACCESS_KEY
  );
}

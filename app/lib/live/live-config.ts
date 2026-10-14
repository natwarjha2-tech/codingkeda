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
 * Chime SDK Media Pipelines (recording) control region. Media capture pipelines
 * run in us-east-1 regardless of the meeting's media region, so this is pinned
 * to the control region. Reuses CHIME_CONTROL_REGION's default.
 */
export const CHIME_MEDIA_PIPELINES_REGION =
  process.env.CHIME_MEDIA_PIPELINES_REGION ?? CHIME_CONTROL_REGION;

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

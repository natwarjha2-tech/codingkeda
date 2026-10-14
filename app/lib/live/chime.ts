/**
 * CodingKida — Amazon Chime SDK Meetings wrapper (ISOLATED MODULE)
 *
 * Thin, dependency-free wrapper around `@aws-sdk/client-chime-sdk-meetings`.
 * Everything live-class related stays under `app/lib/live/*`, so this file is
 * the ONLY place that talks to the Chime control plane. Bugs here can be fixed
 * without touching the rest of the backend.
 *
 * Design notes (verified against AWS Chime SDK Meetings docs):
 * - CONTROL region (where the client/API runs) is AWS-restricted. We use
 *   `CHIME_CONTROL_REGION` (default us-east-1). This is NOT the EC2 region.
 * - MEDIA region (`MediaRegion` on CreateMeeting) is where audio/video is
 *   routed — `CHIME_MEDIA_REGION` (default ap-south-1 / Mumbai) for low latency.
 * - CreateMeeting is made idempotent via `ClientRequestToken`: calling start
 *   twice with the same token returns the SAME meeting instead of a duplicate.
 * - Credentials are the SAME AWS keys already used by S3 — no new keys, no
 *   duplicated client config philosophy (mirrors `app/lib/s3.ts`).
 */

import {
  ChimeSDKMeetingsClient,
  CreateMeetingCommand,
  CreateAttendeeCommand,
  DeleteMeetingCommand,
  GetMeetingCommand,
  type Meeting,
  type Attendee,
} from "@aws-sdk/client-chime-sdk-meetings";
import {
  CHIME_CONTROL_REGION,
  CHIME_MEDIA_REGION,
} from "@/app/lib/live/live-config";

/**
 * Lazily-created singleton Chime client. Created on first use (not at import
 * time) so that merely importing this module never fails when live class is
 * disabled or AWS keys are absent — routes gate on `isLiveClassConfigured()`
 * before ever calling into here.
 */
let _client: ChimeSDKMeetingsClient | null = null;

function getChimeClient(): ChimeSDKMeetingsClient {
  if (_client) return _client;
  _client = new ChimeSDKMeetingsClient({
    region: CHIME_CONTROL_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  return _client;
}

/**
 * Create a Chime meeting in the configured media region.
 *
 * @param clientRequestToken Idempotency token (e.g. the LiveClass id). Chime
 *   returns the existing meeting if called again with the same token, so a
 *   double "Start" never creates two meetings.
 * @returns The Chime `Meeting` object (contains MeetingId + MediaPlacement).
 */
export async function createChimeMeeting(
  clientRequestToken: string
): Promise<Meeting> {
  const res = await getChimeClient().send(
    new CreateMeetingCommand({
      ClientRequestToken: clientRequestToken,
      MediaRegion: CHIME_MEDIA_REGION,
      ExternalMeetingId: clientRequestToken.slice(0, 64), // Chime caps this at 64 chars
    })
  );
  if (!res.Meeting?.MeetingId) {
    throw new Error("Chime did not return a meeting.");
  }
  return res.Meeting;
}

/**
 * Create an attendee for an existing Chime meeting.
 *
 * @param meetingId Chime MeetingId (loaded server-side from the LiveClass row —
 *   never trusted from the client).
 * @param externalUserId Stable per-user identity we control (our User.id). Chime
 *   caps this at 64 chars; our uuids are 36, so no truncation in practice.
 * @returns The Chime `Attendee` (contains AttendeeId + JoinToken for the SDK).
 */
export async function createChimeAttendee(
  meetingId: string,
  externalUserId: string
): Promise<Attendee> {
  const res = await getChimeClient().send(
    new CreateAttendeeCommand({
      MeetingId: meetingId,
      ExternalUserId: externalUserId.slice(0, 64),
    })
  );
  if (!res.Attendee?.AttendeeId || !res.Attendee?.JoinToken) {
    throw new Error("Chime did not return an attendee.");
  }
  return res.Attendee;
}

/**
 * Fetch an existing Chime meeting (full object incl. MediaPlacement) by id.
 * Used on JOIN so a late joiner gets the complete connection coordinates the
 * client SDK needs — without re-creating the meeting. Returns null if the
 * meeting no longer exists (expired/ended).
 */
export async function getChimeMeeting(
  meetingId: string
): Promise<Meeting | null> {
  if (!meetingId) return null;
  try {
    const res = await getChimeClient().send(
      new GetMeetingCommand({ MeetingId: meetingId })
    );
    return res.Meeting ?? null;
  } catch (err) {
    const name = (err as { name?: string })?.name || "";
    if (name === "NotFoundException" || name === "ResourceNotFoundException") {
      return null;
    }
    throw err;
  }
}

/**
 * Delete (end) a Chime meeting. Idempotent from our side: a NotFound error means
 * the meeting is already gone (expired/ended), which we treat as success so
 * ending a class twice never throws.
 */
export async function deleteChimeMeeting(meetingId: string): Promise<void> {
  if (!meetingId) return;
  try {
    await getChimeClient().send(
      new DeleteMeetingCommand({ MeetingId: meetingId })
    );
  } catch (err) {
    const name = (err as { name?: string })?.name || "";
    // Already deleted / never existed — safe to ignore.
    if (name === "NotFoundException" || name === "ResourceNotFoundException") {
      return;
    }
    throw err;
  }
}

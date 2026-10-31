/**
 * CodingKida — Chime SDK Media Pipelines (recording) wrapper (ISOLATED MODULE)
 *
 * Server-side recording via Amazon Chime SDK **Media Capture Pipelines**: when
 * the host presses "Record", the backend starts a pipeline that captures the
 * meeting's audio + video + content-share and writes it DIRECTLY to our S3
 * bucket (under the dedicated LIVE_RECORDING_PREFIX). No host-machine upload,
 * no extra server — reliable + S3-native.
 *
 * This file is the ONLY place that talks to the Media Pipelines control plane,
 * mirroring `chime.ts`. It is DB-free (pure AWS calls); persistence lives in
 * live-service.ts.
 *
 * Requirements handled by the mentor (AWS Console, not code):
 * - IAM: chime:CreateMediaCapturePipeline / Delete / Get.
 * - S3 bucket policy allowing mediapipelines.chime.amazonaws.com to PutObject.
 * Routes gate on isRecordingConfigured() so missing config fails cleanly.
 */

import {
  ChimeSDKMediaPipelinesClient,
  CreateMediaCapturePipelineCommand,
  DeleteMediaCapturePipelineCommand,
} from "@aws-sdk/client-chime-sdk-media-pipelines";
import {
  CHIME_PIPELINE_REGION,
  CHIME_MEDIA_REGION,
  AWS_ACCOUNT_ID,
  LIVE_RECORDING_BUCKET,
  LIVE_RECORDING_PREFIX,
} from "@/app/lib/live/live-config";

/**
 * Lazily-created singleton Media Pipelines client, pinned to the pipeline
 * region (us-east-1 by default — the only universally-supported region). The
 * pipeline region is fixed; the meeting it captures can live in another region
 * (referenced via the SourceArn), so a single client is correct here.
 */
let _client: ChimeSDKMediaPipelinesClient | null = null;

function getPipelinesClient(): ChimeSDKMediaPipelinesClient {
  if (_client) return _client;
  _client = new ChimeSDKMediaPipelinesClient({
    region: CHIME_PIPELINE_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  return _client;
}

/**
 * ARN of a Chime meeting (used as the capture SourceArn). The region in the ARN
 * is the meeting's ACTUAL media region (e.g. ap-south-1) — this is how a
 * us-east-1 pipeline is linked to a meeting hosted in another region. Falls
 * back to the configured media region when the caller doesn't know it.
 */
function meetingArn(chimeMeetingId: string, meetingRegion: string): string {
  return `arn:aws:chime:${meetingRegion}:${AWS_ACCOUNT_ID}:meeting/${chimeMeetingId}`;
}

/** ARN of the S3 destination folder for a given live class's recording. */
function s3SinkArn(liveClassId: string): { arn: string; key: string } {
  const key = `${LIVE_RECORDING_PREFIX}/${liveClassId}`;
  return { arn: `arn:aws:s3:::${LIVE_RECORDING_BUCKET}/${key}`, key };
}

export interface StartCaptureResult {
  pipelineId: string;
  s3Bucket: string;
  s3Key: string;
  status: string;
}

/**
 * Start a media capture pipeline for a live meeting. Captures audio + a single
 * composited video (grid of camera + screen-share) to S3 — the standard,
 * cost-sane "one playable file" layout. Idempotent via ClientRequestToken (the
 * liveClassId), so a double "Record" won't start two pipelines.
 */
export async function startMediaCapture(opts: {
  chimeMeetingId: string;
  liveClassId: string;
  /** The meeting's actual media region (from the stored LiveClass row). Used
   *  ONLY in the SourceArn so the us-east-1 pipeline can locate the meeting.
   *  Falls back to the configured media region when unknown. */
  mediaRegion?: string;
}): Promise<StartCaptureResult> {
  const meetingRegion = (opts.mediaRegion || "").trim() || CHIME_MEDIA_REGION;
  const { arn: sinkArn, key } = s3SinkArn(opts.liveClassId);

  // Pipeline runs in the (universal) pipeline region; the SourceArn references
  // the meeting in its OWN region — this is the combination AWS supports.
  const res = await getPipelinesClient().send(
    new CreateMediaCapturePipelineCommand({
      SourceType: "ChimeSdkMeeting",
      SourceArn: meetingArn(opts.chimeMeetingId, meetingRegion),
      SinkType: "S3Bucket",
      SinkArn: sinkArn,
      ClientRequestToken: opts.liveClassId.slice(0, 64),
      ChimeSdkMeetingConfiguration: {
        ArtifactsConfiguration: {
          // Composited audio+video gives one ready-to-play MP4 instead of raw
          // per-attendee tracks — simplest to store/replay.
          Audio: { MuxType: "AudioWithCompositedVideo" },
          Video: { State: "Disabled" },
          Content: { State: "Disabled" },
          CompositedVideo: {
            Layout: "GridView",
            Resolution: "HD",
            GridViewConfiguration: {
              // Show the screen-share prominently with speakers alongside.
              ContentShareLayout: "Horizontal",
            },
          },
        },
      },
    })
  );

  const pipeline = res.MediaCapturePipeline;
  if (!pipeline?.MediaPipelineId) {
    throw new Error("Chime did not return a media capture pipeline.");
  }

  return {
    pipelineId: pipeline.MediaPipelineId,
    s3Bucket: LIVE_RECORDING_BUCKET,
    s3Key: key,
    status: pipeline.Status || "Initializing",
  };
}

/**
 * Stop (delete) a running media capture pipeline. Idempotent from our side: a
 * NotFound means it's already stopped/gone, which we treat as success so a
 * double "Stop" (or stop-after-class-end) never throws.
 */
export async function stopMediaCapture(pipelineId: string): Promise<void> {
  if (!pipelineId) return;
  // The pipeline id is global to the pipeline region; delete via the same
  // (pipeline-region) client it was created with.
  try {
    await getPipelinesClient().send(
      new DeleteMediaCapturePipelineCommand({ MediaPipelineId: pipelineId })
    );
  } catch (err) {
    const name = (err as { name?: string })?.name || "";
    if (name === "NotFoundException" || name === "ResourceNotFoundException") {
      return;
    }
    throw err;
  }
}

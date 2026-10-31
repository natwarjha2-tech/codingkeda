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
  CHIME_RECORDING_REGION,
  AWS_ACCOUNT_ID,
  LIVE_RECORDING_BUCKET,
  LIVE_RECORDING_PREFIX,
} from "@/app/lib/live/live-config";

/**
 * Media Pipelines clients cached PER REGION. A media-capture pipeline must run
 * in the same region as the meeting it captures, so we create (and reuse) one
 * client per region rather than a single fixed-region singleton.
 */
const _clients = new Map<string, ChimeSDKMediaPipelinesClient>();

function getPipelinesClient(region: string): ChimeSDKMediaPipelinesClient {
  const existing = _clients.get(region);
  if (existing) return existing;
  const client = new ChimeSDKMediaPipelinesClient({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  _clients.set(region, client);
  return client;
}

/**
 * ARN of a Chime meeting (used as the capture SourceArn). The region in the ARN
 * MUST be the meeting's actual media region — otherwise AWS can't find the
 * meeting and CreateMediaCapturePipeline fails.
 */
function meetingArn(chimeMeetingId: string, region: string): string {
  return `arn:aws:chime:${region}:${AWS_ACCOUNT_ID}:meeting/${chimeMeetingId}`;
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
  /** Region the pipeline runs in — stop must target the same region. */
  region: string;
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
  /** The meeting's actual media region (from the stored LiveClass row). The
   *  pipeline + SourceArn use this region so AWS can find the meeting. Falls
   *  back to the configured recording region if unknown. */
  mediaRegion?: string;
}): Promise<StartCaptureResult> {
  const region = (opts.mediaRegion || "").trim() || CHIME_RECORDING_REGION;
  const { arn: sinkArn, key } = s3SinkArn(opts.liveClassId);

  const res = await getPipelinesClient(region).send(
    new CreateMediaCapturePipelineCommand({
      SourceType: "ChimeSdkMeeting",
      SourceArn: meetingArn(opts.chimeMeetingId, region),
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
    region,
  };
}

/**
 * Stop (delete) a running media capture pipeline. Idempotent from our side: a
 * NotFound means it's already stopped/gone, which we treat as success so a
 * double "Stop" (or stop-after-class-end) never throws.
 */
export async function stopMediaCapture(pipelineId: string, region?: string): Promise<void> {
  if (!pipelineId) return;
  const r = (region || "").trim() || CHIME_RECORDING_REGION;
  try {
    await getPipelinesClient(r).send(
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

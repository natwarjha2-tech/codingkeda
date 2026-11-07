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
  CreateMediaConcatenationPipelineCommand,
  DeleteMediaCapturePipelineCommand,
} from "@aws-sdk/client-chime-sdk-media-pipelines";
import {
  CHIME_PIPELINE_REGION,
  CHIME_CONTROL_REGION,
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
 * ARN of a Chime meeting (used as the capture SourceArn).
 *
 * CRITICAL (verified against AWS docs + official examples): a Chime SDK meeting
 * ARN uses the CONTROL-plane region (where the meeting was created — us-east-1
 * by default), NOT the media region. Media Capture Pipelines reference the
 * meeting through this control-region ARN; using the media region (ap-south-1)
 * here makes AWS fail to find the meeting → ForbiddenException.
 *
 * Example (AWS docs): arn:aws:chime:us-east-1:<account>:meeting/<id>
 */
function meetingArn(chimeMeetingId: string): string {
  return `arn:aws:chime:${CHIME_CONTROL_REGION}:${AWS_ACCOUNT_ID}:meeting/${chimeMeetingId}`;
}

/**
 * ARN of a media capture pipeline (the concatenation source). Format per AWS:
 * arn:aws:chime:<region>:<account>:media-pipeline/<pipelineId>. The pipeline
 * lives in the pipeline region (NOT the meeting's control/media region).
 */
function capturePipelineArn(pipelineId: string): string {
  return `arn:aws:chime:${CHIME_PIPELINE_REGION}:${AWS_ACCOUNT_ID}:media-pipeline/${pipelineId}`;
}

/**
 * Per-RECORDING S3 layout. Every recording gets its own folder so two
 * recordings of the same class can never mix their files:
 *
 *   live-recordings/<classId>/<recordingId>/capture/…   raw chunks (capture pipeline)
 *   live-recordings/<classId>/<recordingId>/final/…     ONE combined mp4 (concatenation)
 *
 * The recording-root key (…/<recordingId>) is what we persist as `s3Key`.
 */
function recordingRootKey(liveClassId: string, recordingId: string): string {
  return `${LIVE_RECORDING_PREFIX}/${liveClassId}/${recordingId}`;
}

export interface StartCaptureResult {
  pipelineId: string;
  s3Bucket: string;
  s3Key: string;
  status: string;
}

/**
 * Start a media capture pipeline for a live meeting. Captures audio + a single
 * composited video (grid of camera + screen-share) to S3.
 *
 * IMPORTANT — uniqueness: `ClientRequestToken` makes the AWS call idempotent, so
 * it MUST be unique per recording. It used to be the liveClassId, which meant a
 * second recording in the same class re-sent an already-used token and AWS
 * rejected it (the "can't record again" bug). It is now the per-recording id.
 * The S3 sink is likewise per-recording so recordings never overwrite/mix.
 *
 * Capture writes CHUNKS; the single playable file is produced afterwards by
 * `startMediaConcatenation` (called when the recording is stopped).
 */
export async function startMediaCapture(opts: {
  chimeMeetingId: string;
  liveClassId: string;
  recordingId: string;
}): Promise<StartCaptureResult> {
  const key = recordingRootKey(opts.liveClassId, opts.recordingId);
  const sinkArn = `arn:aws:s3:::${LIVE_RECORDING_BUCKET}/${key}/capture`;

  // Pipeline runs in the (universal) us-east-1 pipeline region; the SourceArn
  // references the meeting via its CONTROL-region ARN (us-east-1) — the exact
  // combination AWS supports.
  const res = await getPipelinesClient().send(
    new CreateMediaCapturePipelineCommand({
      SourceType: "ChimeSdkMeeting",
      SourceArn: meetingArn(opts.chimeMeetingId),
      SinkType: "S3Bucket",
      SinkArn: sinkArn,
      ClientRequestToken: opts.recordingId.slice(0, 64),
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
 * Queue the media CONCATENATION pipeline that stitches a capture pipeline's
 * many small chunks into ONE playable mp4 (fixes "recording plays only ~5s").
 *
 * Per AWS: a concatenation pipeline can be created while capture is still
 * running — it simply WAITS and only starts concatenating when the capture
 * pipeline stops. So callers create it BEFORE stopping the capture pipeline.
 * Output: <recordingRoot>/final/composited-video/<concatPipelineId>.mp4
 *
 * Returns the concatenation pipeline id. Throws on AWS errors (the caller
 * treats it as best-effort and never lets it block stopping the recording).
 */
export async function startMediaConcatenation(opts: {
  pipelineId: string;
  s3Key: string; // recording root key persisted at start (…/<recordingId>)
  recordingId: string;
}): Promise<string> {
  const res = await getPipelinesClient().send(
    new CreateMediaConcatenationPipelineCommand({
      Sources: [
        {
          Type: "MediaCapturePipeline",
          MediaCapturePipelineSourceConfiguration: {
            MediaPipelineArn: capturePipelineArn(opts.pipelineId),
            ChimeSdkMeetingConfiguration: {
              ArtifactsConfiguration: {
                // Mirrors what the capture pipeline produces (audio muxed into
                // the composited video). Everything else is off.
                Audio: { State: "Enabled" },
                Video: { State: "Disabled" },
                Content: { State: "Disabled" },
                DataChannel: { State: "Disabled" },
                TranscriptionMessages: { State: "Disabled" },
                MeetingEvents: { State: "Disabled" },
                CompositedVideo: { State: "Enabled" },
              },
            },
          },
        },
      ],
      Sinks: [
        {
          Type: "S3Bucket",
          S3BucketSinkConfiguration: {
            Destination: `arn:aws:s3:::${LIVE_RECORDING_BUCKET}/${opts.s3Key}/final`,
          },
        },
      ],
      ClientRequestToken: `concat-${opts.recordingId}`.slice(0, 64),
    })
  );

  const id = res.MediaConcatenationPipeline?.MediaPipelineId;
  if (!id) throw new Error("Chime did not return a media concatenation pipeline.");
  return id;
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

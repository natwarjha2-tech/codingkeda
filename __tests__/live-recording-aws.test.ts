/**
 * Unit tests — app/lib/live/recording.ts (Chime Media Pipelines requests)
 *
 * Locks in the two recording fixes at the AWS-request level:
 *  • every recording uses its OWN idempotency token + S3 folder (so a class can
 *    be recorded again after a stop — the old per-class token made AWS reject the
 *    second start);
 *  • the concatenation pipeline stitches capture chunks into ONE file under
 *    <recording>/final (the old setup left only ~5s chunks to play).
 *
 * The AWS SDK is mocked — no real AWS calls.
 */

const mockSend = jest.fn();

jest.mock("@aws-sdk/client-chime-sdk-media-pipelines", () => {
  class Cmd {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  return {
    ChimeSDKMediaPipelinesClient: class {
      send(cmd: unknown) {
        return mockSend(cmd);
      }
    },
    CreateMediaCapturePipelineCommand: class CreateMediaCapturePipelineCommand extends Cmd {},
    CreateMediaConcatenationPipelineCommand: class CreateMediaConcatenationPipelineCommand extends Cmd {},
    DeleteMediaCapturePipelineCommand: class DeleteMediaCapturePipelineCommand extends Cmd {},
  };
});

jest.mock("@/app/lib/live/live-config", () => ({
  CHIME_PIPELINE_REGION: "us-east-1",
  CHIME_CONTROL_REGION: "us-east-1",
  AWS_ACCOUNT_ID: "123456789012",
  LIVE_RECORDING_BUCKET: "rec-bucket",
  LIVE_RECORDING_PREFIX: "live-recordings",
}));

import { startMediaCapture, startMediaConcatenation } from "@/app/lib/live/recording";

type Sent = { constructor: { name: string }; input: Record<string, any> };
const sent = (i: number) => mockSend.mock.calls[i][0] as Sent;

beforeEach(() => {
  mockSend.mockReset();
});

describe("startMediaCapture()", () => {
  beforeEach(() => {
    mockSend.mockResolvedValue({ MediaCapturePipeline: { MediaPipelineId: "pl-1", Status: "Initializing" } });
  });

  it("uses the per-recording id as the idempotency token and a per-recording capture folder", async () => {
    const r = await startMediaCapture({ chimeMeetingId: "m-1", liveClassId: "class-1", recordingId: "rec-1" });

    expect(sent(0).input.ClientRequestToken).toBe("rec-1");
    expect(sent(0).input.SinkArn).toBe("arn:aws:s3:::rec-bucket/live-recordings/class-1/rec-1/capture");
    expect(sent(0).input.SourceArn).toBe("arn:aws:chime:us-east-1:123456789012:meeting/m-1");
    // The persisted key is the recording ROOT (parent of capture/ and final/).
    expect(r).toEqual(expect.objectContaining({ pipelineId: "pl-1", s3Key: "live-recordings/class-1/rec-1" }));
  });

  it("two recordings of the SAME class never share a token or a folder (re-record works)", async () => {
    await startMediaCapture({ chimeMeetingId: "m-1", liveClassId: "class-1", recordingId: "rec-1" });
    await startMediaCapture({ chimeMeetingId: "m-1", liveClassId: "class-1", recordingId: "rec-2" });

    expect(sent(0).input.ClientRequestToken).not.toBe(sent(1).input.ClientRequestToken);
    expect(sent(0).input.SinkArn).not.toBe(sent(1).input.SinkArn);
  });

  it("throws when Chime returns no pipeline id", async () => {
    mockSend.mockResolvedValue({ MediaCapturePipeline: {} });
    await expect(
      startMediaCapture({ chimeMeetingId: "m-1", liveClassId: "class-1", recordingId: "rec-1" })
    ).rejects.toThrow(/did not return/);
  });
});

describe("startMediaConcatenation()", () => {
  it("concatenates the capture pipeline into <recording>/final and returns the pipeline id", async () => {
    mockSend.mockResolvedValue({ MediaConcatenationPipeline: { MediaPipelineId: "concat-9" } });

    const id = await startMediaConcatenation({
      pipelineId: "pl-1",
      s3Key: "live-recordings/class-1/rec-1",
      recordingId: "rec-1",
    });

    expect(id).toBe("concat-9");
    const input = sent(0).input;
    expect(sent(0).constructor.name).toBe("CreateMediaConcatenationPipelineCommand");
    expect(input.Sources[0].MediaCapturePipelineSourceConfiguration.MediaPipelineArn).toBe(
      "arn:aws:chime:us-east-1:123456789012:media-pipeline/pl-1"
    );
    expect(input.Sinks[0].S3BucketSinkConfiguration.Destination).toBe(
      "arn:aws:s3:::rec-bucket/live-recordings/class-1/rec-1/final"
    );
    expect(input.ClientRequestToken).toBe("concat-rec-1");

    const artifacts =
      input.Sources[0].MediaCapturePipelineSourceConfiguration.ChimeSdkMeetingConfiguration.ArtifactsConfiguration;
    expect(artifacts.Audio.State).toBe("Enabled");
    expect(artifacts.CompositedVideo.State).toBe("Enabled");
    expect(artifacts.Video.State).toBe("Disabled");
    expect(artifacts.Content.State).toBe("Disabled");
  });

  it("throws when Chime returns no concatenation pipeline id", async () => {
    mockSend.mockResolvedValue({ MediaConcatenationPipeline: {} });
    await expect(
      startMediaConcatenation({ pipelineId: "pl-1", s3Key: "k", recordingId: "rec-1" })
    ).rejects.toThrow(/did not return/);
  });
});

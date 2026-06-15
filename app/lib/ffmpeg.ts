import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";

const execAsync = promisify(execFile);

export interface QualityVariant {
  quality: string;   // "720p" | "480p" | "360p"
  width: number;
  height: number;
  videoBitrate: string;
}

export const QUALITY_VARIANTS: QualityVariant[] = [
  { quality: "720p",  width: 1280, height: 720,  videoBitrate: "2800k" },
  { quality: "480p",  width: 854,  height: 480,  videoBitrate: "1400k" },
  { quality: "360p",  width: 640,  height: 360,  videoBitrate: "800k" },
];

export interface QualityOutput {
  workDir: string;
  variants: {
    quality: string;
    filePath: string;  // absolute path to generated MP4
    s3Key: string;     // S3 key where it will be uploaded
  }[];
}

/**
 * Download a remote URL (S3 signed URL) to a local temp file.
 */
export async function downloadToTemp(url: string): Promise<string> {
  const tmpFile = path.join(os.tmpdir(), `ck_src_${Date.now()}.mp4`);
  await execAsync("curl", ["-L", "-o", tmpFile, url]);
  if (!fs.existsSync(tmpFile)) {
    throw new Error("Failed to download source video.");
  }
  return tmpFile;
}

/**
 * Generate multiple quality MP4 files from a source video.
 * Audio is copied directly from source (zero re-encoding).
 * Each output is a standalone MP4 file playable by any browser.
 */
export async function generateQualities(inputPath: string, mediaId: string): Promise<QualityOutput> {
  const workDir = path.join(os.tmpdir(), `ck_qual_${Date.now()}`);
  fs.mkdirSync(workDir, { recursive: true });

  // Probe source video height
  let sourceHeight = 1080;
  try {
    const { stdout } = await execAsync("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=height",
      "-of", "csv=p=0",
      inputPath,
    ]);
    sourceHeight = parseInt(stdout.trim()) || 1080;
  } catch { /* default to 1080 */ }

  // Only generate qualities <= source height
  const applicableVariants = QUALITY_VARIANTS.filter(v => v.height <= sourceHeight + 100);
  if (applicableVariants.length === 0) applicableVariants.push(QUALITY_VARIANTS[QUALITY_VARIANTS.length - 1]);

  const variantOutputs: QualityOutput["variants"] = [];

  for (const variant of applicableVariants) {
    const outputFile = path.join(workDir, `${variant.quality}.mp4`);
    const s3Key = `qualities/${mediaId}/${variant.quality}.mp4`;

    const vfFilter = `scale=${variant.width}:${variant.height}:force_original_aspect_ratio=decrease,pad=${variant.width}:${variant.height}:(ow-iw)/2:(oh-ih)/2`;

    const ffmpegArgs = [
      "-y",
      "-i", inputPath,
      "-map", "0:v:0",
      "-map", "0:a:0?",       // copy audio if exists, skip if not
      "-vf", vfFilter,
      "-c:v", "libx264",
      "-preset", "fast",
      "-profile:v", "main",
      "-pix_fmt", "yuv420p",
      "-crf", "22",
      "-b:v", variant.videoBitrate,
      "-maxrate", variant.videoBitrate,
      "-bufsize", `${parseInt(variant.videoBitrate) * 2}k`,
      "-c:a", "copy",         // audio copied directly — zero quality loss
      "-movflags", "+faststart",  // enables streaming before full download
      outputFile,
    ];

    await execAsync("ffmpeg", ffmpegArgs, { maxBuffer: 100 * 1024 * 1024 });

    variantOutputs.push({
      quality: variant.quality,
      filePath: outputFile,
      s3Key,
    });
  }

  return { workDir, variants: variantOutputs };
}

/**
 * Clean up temp files after upload.
 */
export function cleanupTempDir(dir: string) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch { /* ignore */ }
}

export function cleanupTempFile(filePath: string) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch { /* ignore */ }
}

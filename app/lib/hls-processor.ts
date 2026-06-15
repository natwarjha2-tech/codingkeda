import { prisma } from "@/app/lib/prisma";
import { getSignedFileUrl, uploadToS3 } from "@/app/lib/s3";
import {
  downloadToTemp,
  generateQualities,
  cleanupTempDir,
  cleanupTempFile,
} from "@/app/lib/ffmpeg";
import fs from "fs";

const MAX_RETRIES = 2;

export async function processVideoHls(mediaId: string, s3Key: string, s3Url: string, retryCount = 0) {
  let srcFile: string | null = null;
  let workDir: string | null = null;

  // Mark as processing
  await prisma.media.update({
    where: { id: mediaId },
    data: { hlsStatus: "processing" },
  });

  try {
    // 1. Get signed URL to download from S3
    const signedUrl = await getSignedFileUrl(s3Key, 3600);

    // 2. Download to temp
    console.log(`[HLS] Downloading source for ${mediaId}...`);
    srcFile = await downloadToTemp(signedUrl);

    // 3. Generate quality MP4 files
    console.log(`[HLS] Running FFmpeg for ${mediaId}...`);
    const output = await generateQualities(srcFile, mediaId);
    workDir = output.workDir;

    // 4. Upload each quality MP4 to S3
    const qualities: string[] = [];
    for (const variant of output.variants) {
      const fileBuffer = fs.readFileSync(variant.filePath);
      await uploadToS3(fileBuffer, variant.s3Key, "video/mp4");
      qualities.push(variant.quality);
      console.log(`[HLS] Uploaded ${variant.quality} for ${mediaId} (${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB)`);
    }

    // 5. Update DB
    const s3Prefix = `qualities/${mediaId}`;
    await prisma.media.update({
      where: { id: mediaId },
      data: {
        hlsMasterUrl: null,
        hlsStatus: "ready",
        hlsQualities: qualities,
        hlsS3Prefix: s3Prefix,
      },
    });

    console.log(`[HLS] Done for ${mediaId}. Qualities: ${qualities.join(", ")}`);
  } catch (err: any) {
    // Auto-retry on network timeout
    const isTimeout = err?.code === "ETIMEDOUT" || err?.code === "ENETUNREACH" || String(err?.message || "").includes("Timeout");

    if (isTimeout && retryCount < MAX_RETRIES) {
      console.warn(`[HLS] Timeout for ${mediaId}, retrying (${retryCount + 1}/${MAX_RETRIES}) in 30s...`);
      if (srcFile) cleanupTempFile(srcFile);
      if (workDir) cleanupTempDir(workDir);
      await new Promise((resolve) => setTimeout(resolve, 30000));
      return processVideoHls(mediaId, s3Key, s3Url, retryCount + 1);
    }

    console.error(`[HLS] Failed for ${mediaId}:`, err);
    await prisma.media.update({
      where: { id: mediaId },
      data: { hlsStatus: "failed" },
    }).catch(() => {});
    throw err;
  } finally {
    if (srcFile) cleanupTempFile(srcFile);
    if (workDir) cleanupTempDir(workDir);
  }
}

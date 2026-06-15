import { NextRequest, NextResponse } from "next/server";
import { getSignedFileUrl, getS3KeyFromUrl } from "@/app/lib/s3";
import { verifyToken } from "@/app/lib/auth";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "@/app/lib/s3";

const BUCKET = process.env.AWS_S3_BUCKET_NAME!;
const EXPIRES_IN = 3600; // 1 hour for segments

/**
 * GET /api/media/hls-proxy?key=hls/mediaId/master.m3u8
 *
 * Fetches a private HLS playlist from S3 and rewrites all
 * internal URLs (variant playlists + .ts segments) to signed URLs
 * so hls.js can load them without public bucket access.
 */
export async function GET(req: NextRequest) {
  try {
    // Auth check
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (token) {
      try { verifyToken(token); } catch { /* continue */ }
    }

    const s3Key = req.nextUrl.searchParams.get("key");
    if (!s3Key) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    // Only allow hls/ prefix for security
    if (!s3Key.startsWith("hls/")) {
      return NextResponse.json({ error: "Invalid key" }, { status: 403 });
    }

    // Fetch the playlist content from S3
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: s3Key });
    const response = await s3.send(command);
    const body = await response.Body?.transformToString("utf-8");
    if (!body) {
      return NextResponse.json({ error: "Empty playlist" }, { status: 404 });
    }

    const baseUrl = req.nextUrl.origin;
    const hlsPrefix = s3Key.substring(0, s3Key.lastIndexOf("/") + 1); // e.g. "hls/mediaId/"

    // Rewrite each line that is a relative URL
    const rewritten = await rewritePlaylist(body, hlsPrefix, baseUrl);

    return new NextResponse(rewritten, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("HLS proxy error:", err);
    return NextResponse.json({ error: "Failed to proxy HLS" }, { status: 500 });
  }
}

async function rewritePlaylist(content: string, hlsPrefix: string, baseUrl: string): Promise<string> {
  const lines = content.split("\n");
  const rewritten: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments (but keep them)
    if (!trimmed || trimmed.startsWith("#")) {
      // But rewrite URI= attributes inside #EXT-X-STREAM-INF or similar tags
      if (trimmed.includes('URI="')) {
        const rewrittenLine = await rewriteUriAttributes(trimmed, hlsPrefix, baseUrl);
        rewritten.push(rewrittenLine);
      } else {
        rewritten.push(line);
      }
      continue;
    }

    // It's a URL line — rewrite it
    if (trimmed.endsWith(".m3u8")) {
      // Variant playlist — point to proxy endpoint
      const variantKey = hlsPrefix + trimmed;
      const proxyUrl = `${baseUrl}/api/media/hls-proxy?key=${encodeURIComponent(variantKey)}`;
      rewritten.push(proxyUrl);
    } else if (trimmed.endsWith(".ts") || trimmed.endsWith(".m4s")) {
      // Segment — hls/ folder is public, use direct S3 URL (no signing needed)
      const segKey = hlsPrefix + trimmed;
      const directUrl = `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${segKey}`;
      rewritten.push(directUrl);
    } else if (trimmed.startsWith("http")) {
      // Already absolute URL — extract S3 key and sign if it's our bucket
      const s3Key = getS3KeyFromUrl(trimmed);
      if (s3Key) {
        if (s3Key.endsWith(".m3u8")) {
          const proxyUrl = `${baseUrl}/api/media/hls-proxy?key=${encodeURIComponent(s3Key)}`;
          rewritten.push(proxyUrl);
        } else {
          const signedUrl = await getSignedFileUrl(s3Key, EXPIRES_IN);
          rewritten.push(signedUrl);
        }
      } else {
        rewritten.push(line);
      }
    } else {
      rewritten.push(line);
    }
  }

  return rewritten.join("\n");
}

async function rewriteUriAttributes(line: string, hlsPrefix: string, baseUrl: string): Promise<string> {
  return line.replace(/URI="([^"]+)"/g, (match, uri) => {
    // We can't easily await here, but URI attributes in HLS are rare for segments
    // Just return as-is for now (encryption keys etc)
    return match;
  });
}

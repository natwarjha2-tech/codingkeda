# HLS + CloudFront signed-cookies video delivery

Lesson videos now stream as **adaptive HLS** (CloudFront signed cookies) with the
existing multi-quality **MP4** kept as an automatic fallback. Desktop is untouched.

## How it works

1. **Encode** (`app/lib/video-processor.ts`): after producing the MP4 qualities,
   the processor runs one extra ffmpeg pass to produce an HLS rendition
   (`-f hls -var_stream_map ... -master_pl_name master.m3u8 -hls_time 6
   -hls_segment_type mpegts`, audio re-encoded to AAC). All `.m3u8` + `.ts`
   objects upload to `hls/<mediaId>/`, then `media.hlsMasterUrl` is set. HLS
   failure is non-fatal — the encode still succeeds with MP4 only.
2. **Authorize** (`GET /api/lessons/[id]/hls-auth`): mirrors `/play` access
   (enrolled OR free). When CloudFront is configured and `media.hlsStatus ===
   'ready'`, returns the stable master URL + **CloudFront signed cookies** scoped
   to `hls/<mediaId>/*` (4h TTL). Otherwise `hlsReady: false`.
3. **Play** (`GET /api/lessons/[id]/play`): returns `hlsMasterUrl` (non-null only
   when CloudFront configured + HLS ready) alongside the signed MP4 `qualityUrls`.
4. **Client**: the mobile player calls `hls-auth`, sends the cookies as a `Cookie`
   header on the HLS source, and lets ExoPlayer pick the rendition. If anything
   is missing/unready it falls back to the signed MP4 qualities.

## Required production env (EC2 `.env`)

HLS signing/enforcement only activates when **all three** are present (they are
prod-only; locally the code falls back to S3-presigned MP4):

```
CLOUDFRONT_DOMAIN=dXXXX.cloudfront.net        # no scheme
CLOUDFRONT_KEY_PAIR_ID=KXXXXXXXXXXXXX          # public key id from the CF key group
CLOUDFRONT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

## CloudFront distribution (already configured)

- Behavior for `hls/*` → **Restrict viewer access = Yes**, trusted **key group**
  selected, Cache policy = **CachingOptimized**.
- The `.ts` segments are cached long (immutable); `.m3u8` playlists cached ~60s.

## Deploy

1. Merge/push backend. GitHub Actions auto-deploys to EC2 (13.205.91.144).
2. Confirm the three `CLOUDFRONT_*` vars exist in the EC2 `.env`.
3. Restart the app process so the new routes + processor load.

## Reprocessing existing videos (one-time)

Existing videos have `hlsMasterUrl = null` and no `hls/<mediaId>/` output.

- **New uploads** get HLS automatically.
- **Existing videos**: trigger a **force** reprocess from the admin portal
  (replace-video regenerates qualities + HLS and wipes the old `hls/` prefix).
  The non-force idempotent path intentionally **skips** HLS, so a plain
  reprocess of an already-encoded video will not add HLS — use force/replace.
- Until reprocessed, those lessons keep streaming via the MP4 fallback (no user
  impact).

## Device testing (mobile)

HLS only activates in prod (CF vars prod-only), so test against prod from a
**physical ARM device** (the Chime/Live module and realistic streaming both
need a real device, not the x86 emulator):

1. Build + install the mobile app on a physical Android device.
2. Open a lesson whose media has been (re)processed with HLS ready.
3. Expected: the manual quality menu is **hidden** (adaptive), playback starts,
   and network shows requests to `https://<CF_DOMAIN>/hls/<mediaId>/...` with the
   `CloudFront-Policy/Signature/Key-Pair-Id` cookies on each request.
4. Open a lesson **without** HLS ready → the MP4 quality menu appears and plays
   (fallback path).
5. Negative check: a request to a segment **without** the cookies should get a
   403 from CloudFront (confirms the prefix is actually protected).

## Rollback

The whole feature is additive. To disable HLS without a redeploy, unset any one
of the `CLOUDFRONT_*` vars — `/play` and `/hls-auth` both report `hlsReady:false`
and every client falls back to the MP4 qualities.

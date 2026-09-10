// broadcast-state.ts — the PUBLISHER that lights up the CDN metadata path for QVC-scale broadcast.
//
// Broadcast (HLS) viewers can't receive the host's in-room "feature this product / ad break" data ping, so they
// poll for it. To make that poll scale with the video instead of the origin, the room's state is mirrored to a
// STATIC object next to the HLS segments — `<room>/state.json` in the same bucket the CDN already serves — and
// the player polls THAT off the CDN (edge-served, ~free). See broadcast.ts::stateUrlForRoom and WatchSession.
//
// This module writes that object. It is BEST-EFFORT and a SAFE NO-OP until storage write credentials are set:
// when unconfigured (or on any error) it returns {published:false} and the client's fall-back to the short-cache
// origin poll (already shipped) carries the load — so turning this on is purely additive.
//
// Storage config (all optional; publisher stays off until a bucket + creds exist):
//   HLS_STORAGE_BUCKET            bucket the egress writes segments to (shared with broadcast.ts) — the target
//   HLS_S3_ENDPOINT              custom S3-compatible endpoint host for Cloudflare R2 / MinIO (omit for AWS S3)
//                                  e.g. <account>.r2.cloudflarestorage.com
//   HLS_S3_REGION                region (default "auto" when an endpoint is set, else AWS_REGION / us-east-1)
//   HLS_S3_ACCESS_KEY_ID         write key   (falls back to AWS_ACCESS_KEY_ID)
//   HLS_S3_SECRET_ACCESS_KEY     write secret (falls back to AWS_SECRET_ACCESS_KEY)
//   HLS_S3_PATH_STYLE            "1"/"0" to force path-style addressing (defaults ON when an endpoint is set —
//                                  R2/MinIO need it; AWS S3 uses virtual-host style)
//   BROADCAST_STATE_PUBLISH_ENABLED  kill switch (default on)
import { presignPut, type AwsCreds } from "./aws/sigv4.ts";
import { hlsStorageBucket } from "./broadcast.ts";
import { snapBool } from "./settings.ts";

const env = (k: string) => (Deno.env.get(k) || "").trim();

export const broadcastStatePublishEnabled = () => snapBool("BROADCAST_STATE_PUBLISH_ENABLED", true);

function hlsCreds(): AwsCreds {
  const endpoint = env("HLS_S3_ENDPOINT");
  const region = env("HLS_S3_REGION") || (endpoint ? "auto" : (env("AWS_REGION") || "us-east-1"));
  return {
    accessKeyId: env("HLS_S3_ACCESS_KEY_ID") || env("AWS_ACCESS_KEY_ID"),
    secretAccessKey: env("HLS_S3_SECRET_ACCESS_KEY") || env("AWS_SECRET_ACCESS_KEY"),
    region,
    sessionToken: env("AWS_SESSION_TOKEN") || undefined,
  };
}

/** True when the publisher can actually write: enabled + a bucket + write creds. Cheap; no I/O. */
export function broadcastStateConfigured(): boolean {
  if (!broadcastStatePublishEnabled()) return false;
  if (!hlsStorageBucket()) return false;
  const c = hlsCreds();
  return !!(c.accessKeyId && c.secretAccessKey);
}

const safeRoom = (room: string) => String(room || "").replace(/[^\w:.\-]/g, "");

/** The state payload broadcast viewers read (mirrors what sessionFeatured GET returns). Small + stable. */
export interface BroadcastState {
  featured_product: unknown;
  ad_break_at: string | null;
  broadcast: boolean;
  updated_at: string;
}
/** Extract the publishable state from a GameSession row. */
export function buildBroadcastState(sess: Record<string, unknown> | null | undefined): BroadcastState {
  return {
    featured_product: sess?.featured_product ?? null,
    ad_break_at: (sess?.ad_break_at as string) ?? null,
    broadcast: !!sess?.hls_url,
    updated_at: new Date().toISOString(),
  };
}

/** Publish `<room>/state.json` to the HLS bucket so the CDN serves it at stateUrlForRoom(room). Best-effort:
 *  returns {published:false} when unconfigured or on any failure — never throws, never blocks correctness. */
export async function publishBroadcastState(room: string, state: BroadcastState): Promise<{ published: boolean; url?: string; reason?: string }> {
  if (!broadcastStateConfigured()) return { published: false, reason: "not_configured" };
  const bucket = hlsStorageBucket();
  const key = `${safeRoom(room)}/state.json`;
  const endpoint = env("HLS_S3_ENDPOINT");
  const pathStyle = env("HLS_S3_PATH_STYLE") ? env("HLS_S3_PATH_STYLE") === "1" : !!endpoint;
  try {
    const url = await presignPut(hlsCreds(), bucket, key, { endpoint: endpoint || undefined, pathStyle, expires: 120 });
    const put = await fetch(url, {
      method: "PUT",
      // Short cache so the CDN serves the crowd from the edge but new state propagates within seconds.
      headers: { "content-type": "application/json", "cache-control": "public, max-age=3, stale-while-revalidate=15" },
      body: JSON.stringify(state),
    });
    if (!put.ok) return { published: false, reason: `put_${put.status}` };
    // The public URL is served by the CDN base, not the write endpoint.
    return { published: true };
  } catch (e) {
    return { published: false, reason: String((e as Error)?.message || e).slice(0, 120) };
  }
}

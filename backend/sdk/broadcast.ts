// broadcast.ts — QVC-scale broadcast config + decisions. Keeps the mass PASSIVE audience off the SFU by serving
// HLS (produced by LiveKit Egress) over a CDN, so one feed scales to essentially unlimited concurrent viewers.
// Pure/config only; the network calls (start egress) live in the functions. See QVC-SCALE-BROADCAST.md.

import { snapBool, snapNumber, snapString } from "./settings.ts";

export const broadcastEnabled = () => snapBool("HOSTING_BROADCAST_ENABLED", true);
export const autoBroadcastThreshold = () => Math.max(0, Math.round(snapNumber("HOSTING_AUTO_BROADCAST_THRESHOLD", 200)));
export const lowLatencyHls = () => snapBool("HOSTING_BROADCAST_LL_HLS", true);
export const egressUrl = () => (snapString("LIVEKIT_EGRESS_URL", "") || "").trim().replace(/\/+$/, "");
export const hlsPlaybackBase = () => (snapString("HLS_PLAYBACK_BASE_URL", "") || "").trim().replace(/\/+$/, "");
export const hlsStorageBucket = () => (snapString("HLS_STORAGE_BUCKET", "") || "").trim();

/** Broadcast can actually produce + serve streams only when both the egress service and the CDN base are set. */
export const broadcastConfigured = () => !!egressUrl() && !!hlsPlaybackBase();

/** Public HLS playlist URL for a room (served by the CDN). Safe filename from the room id. */
export function hlsUrlForRoom(room: string): string {
  const base = hlsPlaybackBase();
  const safe = String(room || "").replace(/[^\w:.\-]/g, "");
  return base ? `${base}/${safe}/index.m3u8` : "";
}

/** Object-storage key prefix Egress writes this room's segments to. */
export function hlsKeyPrefix(room: string): string {
  const safe = String(room || "").replace(/[^\w:.\-]/g, "");
  return `${safe}/`;
}

/** Public CDN URL for a room's broadcast STATE file (featured product / ad-break marker), colocated with the
 *  HLS segments. Broadcast (HLS) viewers poll THIS static object off the CDN instead of hitting the origin
 *  sessionFeatured function once per viewer — so the metadata poll scales with the video, not with the origin. */
export function stateUrlForRoom(room: string): string {
  const base = hlsPlaybackBase();
  const safe = String(room || "").replace(/[^\w:.\-]/g, "");
  return base ? `${base}/${safe}/state.json` : "";
}

/** Should a room's PASSIVE viewers be served HLS instead of a WebRTC subscription?
 *  True when broadcast is on AND (the room has an HLS stream already OR the audience has crossed the auto
 *  threshold). Host + interactive guests are routed separately (always WebRTC). Pure. */
export function shouldServeHls(opts: { hasHlsStream: boolean; viewers: number }): boolean {
  if (!broadcastEnabled()) return false;
  if (opts.hasHlsStream) return true;
  const th = autoBroadcastThreshold();
  return th > 0 && opts.viewers >= th;
}

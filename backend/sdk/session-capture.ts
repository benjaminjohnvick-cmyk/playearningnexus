// Sampled, batched session-screenshot capture — the DISCIPLINED version of "capture what the user
// sees so AI can optimize site design." We do NOT film 100% of everyone (that is the one thing that
// would break the budget at scale). Instead:
//   • a rotating FRACTION of sessions is eligible (SESSION_CAPTURE_SAMPLE_PCT, deterministic per
//     session so a session is either in or out for all its frames — a clean statistical sample);
//   • each sampled session is capped to a few frames (SESSION_CAPTURE_MAX_SHOTS_PER_SESSION);
//   • frames are stored in the low-cost object bucket (aws/s3);
//   • analysis runs in periodic BATCHES under a hard spend ceiling
//     (SESSION_CAPTURE_DAILY_BUDGET_USD, else the global AI_DAILY_SPEND_CAP_USD).
// A representative sample is what makes the design signal statistically valid — you do not need every
// session. Gated OFF by default via the `session_screenshots` flag; skipped for behavioral opt-outs.

import { db } from "./db.ts";
import { getNumber } from "./settings.ts";
import { isEnabled } from "./feature-flags.ts";
import { uploadBytes } from "./aws/s3.ts";

// Deterministic [0,1) hash of a session id so the same session is consistently sampled
// (a session is either in or out for ALL its frames — a clean statistical sample, not per-frame noise).
function unitHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

// Honor the user's behavioral opt-out. The UI sets `tracking_opt_out`; we accept the legacy
// `behavioral_opt_out` too so either field disables capture.
function optedOut(user: any): boolean {
  return user?.tracking_opt_out === true || user?.behavioral_opt_out === true;
}

/** Is this session eligible for CHEAP STRUCTURAL (heatmap) capture right now? Gated on the `ux_heatmap`
 *  flag, which defaults ON — structural snapshots carry no pixels, are ~1 KB, and are analyzed by cheap
 *  rules, so this design-optimization loop runs from launch at ~$0. Still a rotating sample + opt-out. */
export async function shouldCaptureStructural(user: any, sessionId: string, jurisdiction?: string | null): Promise<boolean> {
  if (!sessionId || optedOut(user)) return false;
  const on = await isEnabled("ux_heatmap", jurisdiction).catch(() => true);
  if (!on) return false;
  const pct = Math.max(0, Math.min(1, await getNumber("SESSION_CAPTURE_SAMPLE_PCT", 0.02)));
  if (pct <= 0) return false;
  return unitHash(sessionId) < pct;
}

/** Is this session eligible for PIXEL screenshot capture? Gated on the `session_screenshots` flag, which
 *  defaults OFF (needs html2canvas + is more privacy-sensitive). Structural capture above is preferred. */
export async function shouldCapture(user: any, sessionId: string, jurisdiction?: string | null): Promise<boolean> {
  if (!sessionId || optedOut(user)) return false;
  const on = await isEnabled("session_screenshots", jurisdiction).catch(() => false);
  if (!on) return false;
  const pct = Math.max(0, Math.min(1, await getNumber("SESSION_CAPTURE_SAMPLE_PCT", 0.02)));
  if (pct <= 0) return false;
  return unitHash(sessionId) < pct;
}

/** Decode a data: URL (or raw base64) into bytes + content type. */
function decodeImage(dataUrl: string): { bytes: Uint8Array; contentType: string } | null {
  try {
    let b64 = dataUrl, contentType = "image/webp";
    const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
    if (m) { contentType = m[1]; b64 = m[2]; }
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, contentType };
  } catch { return null; }
}

/** Store one sampled STRUCTURAL snapshot (viewport, scroll depth, clicks, element boxes — no pixels).
 *  Cheap and bucket-free: it's just a small bounded row. Enforces the per-session frame cap. This is the
 *  default capture path — near-zero client + server + storage cost, no image ever produced or uploaded. */
export async function storeSnapshot(userId: string, sessionId: string, snapshot: any): Promise<boolean> {
  const maxShots = Math.max(1, await getNumber("SESSION_CAPTURE_MAX_SHOTS_PER_SESSION", 6));
  const existing = await db.filter("UXHeatmapSnapshot", { session_id: sessionId }, "-at", maxShots + 1).catch(() => []) as any[];
  if ((existing?.length || 0) >= maxShots) return false;

  // Bound the payload so a client can't inflate storage.
  const s = snapshot && typeof snapshot === "object" ? snapshot : {};
  const clicks = Array.isArray(s.clicks) ? s.clicks.slice(0, 60).map((c: any) => ({ x: Number(c.x) || 0, y: Number(c.y) || 0, tag: String(c.tag || "").slice(0, 20), dead: !!c.dead })) : [];
  const elements = Array.isArray(s.elements) ? s.elements.slice(0, 40).map((e: any) => ({
    tag: String(e.tag || "").slice(0, 20), label: String(e.label || "").slice(0, 40),
    x: Number(e.x) || 0, y: Number(e.y) || 0, w: Number(e.w) || 0, h: Number(e.h) || 0,
    above_fold: !!e.above_fold, visible: !!e.visible,
  })) : [];
  await db.create("UXHeatmapSnapshot", {
    user_id: userId, session_id: String(sessionId).slice(0, 80),
    path: String(s.path || "").slice(0, 200),
    viewport: s.viewport && typeof s.viewport === "object" ? { w: Number(s.viewport.w) || 0, h: Number(s.viewport.h) || 0 } : null,
    scroll_pct: Math.max(0, Math.min(100, Number(s.scroll_pct) || 0)),
    clicks, elements, dead_clicks: Number(s.dead_clicks) || 0, rage_clicks: Number(s.rage_clicks) || 0,
    analyzed: false, at: new Date().toISOString(),
  }, userId).catch(() => null);
  return true;
}

/** Store one sampled frame to the bucket + a SessionCaptureFrame metadata row. Enforces the per-session
 *  frame cap. Returns the stored url (or null when the bucket is unconfigured / cap hit). */
export async function storeShot(userId: string, sessionId: string, dataUrl: string, path?: string): Promise<string | null> {
  const maxShots = Math.max(1, await getNumber("SESSION_CAPTURE_MAX_SHOTS_PER_SESSION", 6));
  const existing = await db.filter("SessionCaptureFrame", { session_id: sessionId }, "-at", maxShots + 1).catch(() => []) as any[];
  if ((existing?.length || 0) >= maxShots) return null;

  const img = decodeImage(String(dataUrl || ""));
  if (!img) return null;
  const url = await uploadBytes(`session-${sessionId}-${(existing?.length || 0) + 1}.webp`, img.bytes, img.contentType, "session-capture").catch(() => null);

  await db.create("SessionCaptureFrame", {
    user_id: userId,
    session_id: String(sessionId).slice(0, 80),
    url: url || null,
    path: String(path || "").slice(0, 200),
    bytes: img.bytes.length,
    analyzed: false,
    at: new Date().toISOString(),
  }, userId).catch(() => null);

  return url;
}

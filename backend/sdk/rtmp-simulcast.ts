// rtmp-simulcast.ts — pure planning/validation for pushing a hosted livestream to multiple RTMP destinations
// (YouTube / Facebook / Twitch / custom) at once. Browsers can't emit RTMP, so the real path is: the host's
// WebRTC media goes to a RELAY (a media server such as MediaMTX / LiveKit / an ffmpeg worker you run), and the
// relay fans it out to each platform's RTMP ingest. This module builds the fan-out PLAN the relay executes.
//
// SECURITY (hard rule): a platform stream key is a SECRET. Our code never accepts, stores, or logs a raw stream
// key. A target references a key held in a secret manager (`stream_key_secret_ref`); the relay resolves the ref
// to the real key at connect time. A target that carries a raw key is REFUSED here, so a secret can't leak into
// the DB or logs. Pure + unit-testable.

export interface SimulcastTargetInput {
  platform: string;               // "youtube" | "facebook" | "twitch" | "custom"
  ingest_url: string;             // rtmp:// or rtmps:// ingest endpoint
  stream_key_secret_ref?: string; // id/pointer into the secret manager — NOT the key itself
  stream_key?: string;            // if present → REFUSED (raw secret must never come through here)
  enabled?: boolean;
}

export interface SanitizedTarget {
  platform: string;
  ingest_url: string;
  stream_key_secret_ref: string;
}

export interface TargetValidation { ok: boolean; reason: string; sanitized?: SanitizedTarget; }

const KNOWN = new Set(["youtube", "facebook", "twitch", "custom"]);

/** Validate one target. Refuses a raw stream key, a non-RTMP URL, or a missing secret ref. Never returns secret
 *  material. Pure. */
export function validateRtmpTarget(t: SimulcastTargetInput): TargetValidation {
  if (!t || typeof t !== "object") return { ok: false, reason: "invalid target" };
  if (t.stream_key) return { ok: false, reason: "raw stream_key not allowed — pass stream_key_secret_ref (a secret-manager pointer) instead" };
  const platform = String(t.platform || "custom").toLowerCase();
  if (!KNOWN.has(platform)) return { ok: false, reason: `unknown platform "${t.platform}"` };
  const url = String(t.ingest_url || "");
  if (!/^rtmps?:\/\/[^\s]+$/i.test(url)) return { ok: false, reason: "ingest_url must be an rtmp:// or rtmps:// URL" };
  const ref = String(t.stream_key_secret_ref || "");
  if (!ref) return { ok: false, reason: "stream_key_secret_ref required (the key stays in the secret manager)" };
  return { ok: true, reason: "ok", sanitized: { platform, ingest_url: url, stream_key_secret_ref: ref } };
}

export interface SimulcastPlan {
  targets: SanitizedTarget[];
  count: number;
  dropped: Array<{ platform: string; reason: string }>;
}

/** Build the relay fan-out plan from a set of targets. Validates each, drops invalid ones (with reasons), and
 *  caps the number of destinations. Output contains NO secret material. Pure. */
export function buildSimulcastPlan(targets: SimulcastTargetInput[] | undefined, maxTargets = 5): SimulcastPlan {
  const out: SanitizedTarget[] = [];
  const dropped: Array<{ platform: string; reason: string }> = [];
  for (const t of (targets || [])) {
    if (t?.enabled === false) continue;
    const v = validateRtmpTarget(t);
    if (v.ok && v.sanitized) { if (out.length < Math.max(1, maxTargets)) out.push(v.sanitized); else dropped.push({ platform: v.sanitized.platform, reason: `over max ${maxTargets} destinations` }); }
    else dropped.push({ platform: String(t?.platform || "?"), reason: v.reason });
  }
  return { targets: out, count: out.length, dropped };
}

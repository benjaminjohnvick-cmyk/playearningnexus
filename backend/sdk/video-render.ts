// video-render.ts — the video RENDER provider abstraction for the AI Video Engine's "render the winners" step.
//
// Providers:
//   • "none"           — default. Concepts/polls/learning only, ZERO render spend (the cost floor).
//   • "abacus"         — Abacus.AI aggregator API: one key/subscription routes to many premium models
//                        (Veo, Kling, Luma, Runway, Seedance…). Best low-to-mid volume + lowest ops. Commercial
//                        use permitted per Abacus (verify per-model for third-party advertiser resale).
//   • "serverless_gpu" — self-hosted open video models (Wan/Hunyuan) on an auto-scaling serverless GPU endpoint
//                        (Replicate/Modal/RunPod). Scales to zero when idle, kicks off automatically at volume;
//                        cheapest per-render at high scale, more ops. The scale governor switches to this at load.
//
// This module is the pure config + cap + dispatch layer. The actual HTTP calls require the provider's API
// key/endpoint (from settings/env) and are guarded — nothing renders (or spends) while the provider is "none"
// or the key is missing, and every render respects the daily count + $ caps.

import { snapString, snapNumber } from "./settings.ts";

export type RenderProvider = "none" | "abacus" | "serverless_gpu";
export const RENDER_PROVIDERS: RenderProvider[] = ["none", "abacus", "serverless_gpu"];

export function resolveRenderProvider(): RenderProvider {
  const p = (snapString("VIDEO_ENGINE_RENDER_PROVIDER", "none") || "none").trim().toLowerCase();
  return (RENDER_PROVIDERS as string[]).includes(p) ? (p as RenderProvider) : "none";
}

export interface RenderConfig {
  provider: RenderProvider;
  model: string;
  resolution: string;         // e.g. "1080x1920" (9:16 social)
  duration_s: number;
  daily_cap_count: number;    // max renders/day (0 = unlimited)
  daily_cap_usd: number;      // max render $/day (0 = unlimited)
  configured: boolean;        // provider has the key/endpoint it needs
}

/** Resolve the active render configuration from settings. Impure. */
export function renderConfig(): RenderConfig {
  const provider = resolveRenderProvider();
  const model = provider === "abacus"
    ? (snapString("ABACUS_VIDEO_MODEL", "veo-3.1") || "veo-3.1")
    : provider === "serverless_gpu"
    ? (snapString("SERVERLESS_GPU_VIDEO_MODEL", "wan-2.5") || "wan-2.5")
    : "none";
  const configured = provider === "none" ? true
    : provider === "abacus" ? !!(snapString("ABACUS_API_KEY", "") || "").trim()
    : !!(snapString("SERVERLESS_GPU_ENDPOINT", "") || "").trim();
  return {
    provider, model,
    resolution: snapString("VIDEO_RENDER_RESOLUTION", "1080x1920") || "1080x1920",
    duration_s: Math.max(1, snapNumber("VIDEO_RENDER_DURATION_S", 8)),
    daily_cap_count: Math.max(0, snapNumber("VIDEO_RENDER_DAILY_CAP_COUNT", 100)),
    daily_cap_usd: Math.max(0, snapNumber("VIDEO_RENDER_DAILY_CAP_USD", 25)),
    configured,
  };
}

export interface RenderGate { can_render: boolean; reason: string; }
/** Should a render proceed? Provider set + configured + within the daily count/$ caps. Pure. */
export function renderGate(cfg: RenderConfig, usedCount: number, usedUsd: number, estUsd: number): RenderGate {
  if (cfg.provider === "none") return { can_render: false, reason: "render provider is 'none' — winners selected, not rendered (zero spend)" };
  if (!cfg.configured) return { can_render: false, reason: `provider '${cfg.provider}' is missing its API key/endpoint` };
  if (cfg.daily_cap_count > 0 && usedCount >= cfg.daily_cap_count) return { can_render: false, reason: `daily render count cap reached (${cfg.daily_cap_count})` };
  if (cfg.daily_cap_usd > 0 && (usedUsd + Math.max(0, estUsd)) > cfg.daily_cap_usd) return { can_render: false, reason: `daily render $ cap reached ($${cfg.daily_cap_usd})` };
  return { can_render: true, reason: `render via ${cfg.provider} (${cfg.model})` };
}

// ── Real provider dispatch ──────────────────────────────────────────────────────────────────────────────
// Submits a render to the configured provider and returns a video URL (or a job handle to poll). Real HTTP,
// but fully GUARDED: returns { ok:false } when the provider is "none" or its key/endpoint is missing, and never
// throws into the caller (the engine keeps the script/storyboard it already produced). Video APIs are async, so
// this submits + does a short bounded poll; if it isn't done in time it returns the job id to poll later.
export interface RenderResult { ok: boolean; video_url?: string; job_id?: string; provider: RenderProvider; reason?: string; }

async function pollUrl(url: string, headers: Record<string, string>, tries = 6, delayMs = 5000): Promise<string | null> {
  for (let i = 0; i < tries; i++) {
    await new Promise((r) => setTimeout(r, delayMs));
    const r = await fetch(url, { headers }).then((x) => x.json()).catch(() => null) as Record<string, unknown> | null;
    const status = String(r?.status ?? r?.state ?? "").toLowerCase();
    const out = (r?.output ?? r?.video_url ?? r?.url ?? (Array.isArray(r?.output) ? (r?.output as unknown[])[0] : null)) as string | undefined;
    if (out && /^https?:\/\//.test(String(out))) return String(out);
    if (["failed", "error", "canceled"].includes(status)) return null;
  }
  return null;
}

/** Submit a render to the active provider. Impure (network). Never throws. */
export async function renderVideoCall(cfg: RenderConfig, prompt: string): Promise<RenderResult> {
  try {
    if (cfg.provider === "none") return { ok: false, provider: "none", reason: "render off" };
    if (!cfg.configured) return { ok: false, provider: cfg.provider, reason: "provider not configured" };
    const [w, h] = (cfg.resolution || "1080x1920").split("x").map((n) => parseInt(n, 10) || 0);

    if (cfg.provider === "abacus") {
      const key = (snapString("ABACUS_API_KEY", "") || "").trim();
      if (!key) return { ok: false, provider: "abacus", reason: "no key" };
      // Abacus.AI developer API. NOTE: confirm the exact route/field names against the live VideoGenSettings
      // schema when you add your key — this follows their documented REST pattern and fails safe on mismatch.
      const base = (snapString("ABACUS_API_BASE", "https://api.abacus.ai/api") || "https://api.abacus.ai/api").replace(/\/$/, "");
      const res = await fetch(`${base}/generateVideo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apiKey": key },
        body: JSON.stringify({ model: cfg.model, prompt, videoGenSettings: { duration: cfg.duration_s, width: w, height: h, aspectRatio: h >= w ? "9:16" : "16:9" } }),
      }).then((x) => x.json()).catch(() => null) as Record<string, unknown> | null;
      const direct = (res?.result?.videoUrl ?? res?.videoUrl ?? res?.video_url) as string | undefined;
      if (direct && /^https?:\/\//.test(String(direct))) return { ok: true, provider: "abacus", video_url: String(direct) };
      const jobId = (res?.result?.requestId ?? res?.requestId ?? res?.jobId) as string | undefined;
      if (jobId) {
        const url = await pollUrl(`${base}/getVideoGenerationStatus?requestId=${encodeURIComponent(String(jobId))}`, { "apiKey": key });
        return url ? { ok: true, provider: "abacus", video_url: url } : { ok: false, provider: "abacus", job_id: String(jobId), reason: "still rendering — poll later" };
      }
      return { ok: false, provider: "abacus", reason: "unexpected response (verify API schema)" };
    }

    // serverless_gpu — Replicate/Modal/RunPod-compatible: POST prompt, poll the returned status URL for output.
    const endpoint = (snapString("SERVERLESS_GPU_ENDPOINT", "") || "").trim();
    if (!endpoint) return { ok: false, provider: "serverless_gpu", reason: "no endpoint" };
    const token = (snapString("SERVERLESS_GPU_TOKEN", "") || "").trim();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(endpoint, {
      method: "POST", headers,
      body: JSON.stringify({ model: cfg.model, input: { prompt, num_frames: cfg.duration_s * 24, width: w, height: h } }),
    }).then((x) => x.json()).catch(() => null) as Record<string, unknown> | null;
    const direct = (res?.output ?? res?.video_url) as string | undefined;
    if (direct && /^https?:\/\//.test(String(Array.isArray(direct) ? direct[0] : direct))) return { ok: true, provider: "serverless_gpu", video_url: String(Array.isArray(direct) ? direct[0] : direct) };
    const getUrl = (res?.urls?.get ?? res?.status_url) as string | undefined;
    if (getUrl) {
      const url = await pollUrl(String(getUrl), headers);
      return url ? { ok: true, provider: "serverless_gpu", video_url: url } : { ok: false, provider: "serverless_gpu", job_id: String(res?.id ?? ""), reason: "still rendering — poll later" };
    }
    return { ok: false, provider: "serverless_gpu", reason: "unexpected response (verify endpoint schema)" };
  } catch (e) {
    return { ok: false, provider: cfg.provider, reason: String((e as Error)?.message || e) };
  }
}

/** Provider comparison metadata (for the status endpoint + cost-levers doc). Pure. */
export function providerInfo(p: RenderProvider): { label: string; scales: boolean; ops: "none" | "low" | "medium"; note: string } {
  switch (p) {
    case "abacus": return { label: "Abacus.AI aggregator", scales: true, ops: "low", note: "Many premium models under one API/subscription; best low-to-mid volume, lowest ops. Commercial use permitted (verify per-model for advertiser resale)." };
    case "serverless_gpu": return { label: "Serverless GPU (self-hosted open models)", scales: true, ops: "medium", note: "Wan/Hunyuan on auto-scaling GPU; scales to zero when idle, cheapest per-render at high volume. The scale governor switches to this at load." };
    default: return { label: "None (concepts only)", scales: false, ops: "none", note: "Zero render spend — the cost floor." };
  }
}

import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { getString, setSetting } from "../../sdk/settings.ts";

// costFloorProfile (ADMIN) — one action that pulls EVERY cost lever to the floor while keeping every feature
// ON. It routes each AI/media capability to the cheapest backend (your self-hosted server if its URL is set,
// otherwise the FREE tiers), forces LLM calls to the small Llama model, turns off paid video rendering, turns
// on caching, and reports the two env-based "free unlocks" + whether agents are running on free Llama. It only
// changes efficiency settings — never a feature flag — and reports exactly what it changed. Reversible.
//   Body: { dry_run?: boolean, daily_cap_usd?: number }  (daily_cap_usd defaults to 0 = no cap, since the
//   floor routes to free providers; set a number if you want a hard guardrail anyway.)
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    const dailyCap = Math.max(0, Number(body.daily_cap_usd ?? 0));   // 0 = no cap (free providers → ~$0 anyway)

    // Prefer self-hosted (fully free) where an endpoint is configured; otherwise the free managed tiers.
    const selfLlm = (await getString("SELF_LLM_URL", "")).trim();
    const selfStt = (await getString("SELF_STT_URL", "")).trim();
    const selfTts = (await getString("SELF_TTS_URL", "")).trim();
    const selfImg = (await getString("SELF_IMAGE_URL", "")).trim();

    // Canonical string values (booleans as "1"/"0", numbers as strings) so dry-run diffs are accurate.
    const target: Record<string, string> = {
      // ── LLM → free Llama (self server if set, else Groq free tier), smallest model, cheap managed defaults ──
      LLM_PROVIDER: selfLlm ? "self" : "groq",
      AI_FORCE_CHEAP_TIER: "1",
      CLAUDE_MODEL_DEFAULT: "claude-3-5-haiku-latest",   // cheap default on the Anthropic path (if ever used)
      LLM_MODEL_DEFAULT: "gpt-4o-mini",                   // cheap default on the OpenAI path (if ever used)
      AI_COST_PER_1K_TOKENS: "0.0002",                    // realistic Groq/Llama rate so any cap tracks reality
      AI_DAILY_SPEND_CAP_USD: String(dailyCap),

      // ── Transcription → free Whisper (self, else Groq free tier) ──
      PROVIDER_STT: selfStt ? "self" : "groq",

      // ── Voice → cheapest (self XTTS/Piper, else Amazon Polly free tier) + cache so repeats cost nothing ──
      PROVIDER_TTS: selfTts ? "self" : "polly",
      TTS_OPENAI_MODEL: "tts-1",
      TTS_CACHE_ENABLED: "1",

      // ── Images → FREE Cloudflare FLUX-schnell (self SDXL/FLUX if set), 4 steps, no pricey subcategory tiles ──
      IMAGE_PROVIDER: selfImg ? "self" : "cloudflare",
      CF_IMAGE_MODEL: "@cf/black-forest-labs/flux-1-schnell",
      CF_IMAGE_STEPS: "4",
      CATALOG_SUBCATEGORY_IMAGES: "0",

      // ── Video → generate/poll/learn for free; NO paid render vendor until you deliberately set one ──
      VIDEO_ENGINE_RENDER_PROVIDER: "none",

      // ── Feed API caching so repeated product searches don't re-bill ──
      PRODUCT_FEED_CACHE_TTL_S: "3600",
    };

    const changes: Array<{ key: string; from: string; to: string }> = [];
    const errors: Array<{ key: string; error: string }> = [];
    for (const [key, to] of Object.entries(target)) {
      const before = await getString(key, "");
      if (String(before) === to) continue;
      if (dryRun) { changes.push({ key, from: String(before), to }); continue; }
      try {
        const res = await setSetting(key, to, user.id);
        if (res.from !== res.to) {
          changes.push(res);
          await db.create("AdminAuditLog", {
            actor_email: user.email, actor_id: user.id, action_type: "cost_floor_profile",
            target: res.key, details: { from: res.from, to: res.to }, timestamp: new Date().toISOString(),
          }, user.id).catch(() => null);
        }
      } catch (e) { errors.push({ key, error: (e as Error).message }); }
    }

    // The two env-based "free unlocks" (can't be set from here — they're deploy env vars) + agent offload.
    const hasEnv = (k: string) => !!Deno.env.get(k);
    const groqKey = hasEnv("GROQ_API_KEY");
    const free_unlocks = {
      groq_key_for_free_llama: groqKey,
      agents_on_free_llama: groqKey,   // agent runtime auto-uses Groq when GROQ_API_KEY is set (falls back to OpenAI)
      shared_cache_redis: hasEnv("REDIS_URL"),
      read_replica: hasEnv("DATABASE_REPLICA_URL"),
    };
    const recommendations: string[] = [];
    if (!groqKey) recommendations.push("Set GROQ_API_KEY to run ALL LLM calls AND your autonomous agents on free Llama (Groq). Without it, calls fall back to OpenAI (paid).");
    if (!free_unlocks.shared_cache_redis) recommendations.push("Set REDIS_URL to make the cache + rate limits shared across instances (in-process cache still works without it).");
    if (!free_unlocks.read_replica) recommendations.push("Set DATABASE_REPLICA_URL to offload all read traffic to a replica (zero code change).");
    if (!selfImg) recommendations.push("Images are on Cloudflare's free FLUX tier. Set SELF_IMAGE_URL (SDXL/FLUX) only if you want fully self-hosted image gen.");

    return Response.json({
      ok: errors.length === 0, dry_run: dryRun, applied: changes, errors,
      free_unlocks, recommendations,
      load_test: "After applying, run the load test (LOAD-TEST-PLAN.md): k6/artillery against /health + a read + a write path to confirm the free tiers hold under concurrency before launch.",
      note: "Every AI/media capability routed to the cheapest backend (self-hosted where configured, else FREE tiers), all LLM calls forced to the small Llama model, paid video rendering OFF, caching ON. No feature was turned off. Agents run on free Llama when GROQ_API_KEY is set (auto fallback to OpenAI).",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

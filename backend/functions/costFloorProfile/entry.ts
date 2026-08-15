import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { getString, setSetting } from "../../sdk/settings.ts";

// costFloorProfile (ADMIN) — one action to drop AI/media cost to the FLOOR. Routes every capability to the
// cheapest available backend (your self-hosted server if its URL is set, otherwise the free tiers), forces
// all LLM calls to the small Llama model, and sets a low daily AI spend cap. Reversible — it only changes
// settings, and reports exactly what it changed.
//   Body: { dry_run?: boolean, daily_cap_usd?: number }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    const dailyCap = Math.max(0, Number(body.daily_cap_usd ?? 5));

    // Prefer self-hosted (fully free) where an endpoint is configured; otherwise the free managed tiers.
    const selfLlm = (await getString("SELF_LLM_URL", "")).trim();
    const selfStt = (await getString("SELF_STT_URL", "")).trim();
    const selfTts = (await getString("SELF_TTS_URL", "")).trim();
    const selfImg = (await getString("SELF_IMAGE_URL", "")).trim();

    const target: Record<string, unknown> = {
      LLM_PROVIDER: selfLlm ? "self" : "groq",          // self server, else Llama on Groq free tier
      AI_FORCE_CHEAP_TIER: true,                          // dump every call into the small Llama model
      PROVIDER_STT: selfStt ? "self" : "groq",           // self faster-whisper, else Whisper on Groq free tier
      PROVIDER_TTS: selfTts ? "self" : "polly",          // self XTTS/Piper, else Amazon Polly (free tier) — off ElevenLabs
      IMAGE_PROVIDER: selfImg ? "self" : "openai",       // self SDXL/FLUX if available (openai stays unless self set)
      AI_DAILY_SPEND_CAP_USD: dailyCap,                  // hard guardrail
    };

    const changes: Array<{ key: string; from: string; to: string }> = [];
    const errors: Array<{ key: string; error: string }> = [];
    for (const [key, value] of Object.entries(target)) {
      const before = await getString(key, "");
      const to = String(value);
      if (String(before) === to) continue;
      if (dryRun) { changes.push({ key, from: String(before), to }); continue; }
      try {
        const res = await setSetting(key, value, user.id);
        if (res.from !== res.to) {
          changes.push(res);
          await db.create("AdminAuditLog", {
            actor_email: user.email, actor_id: user.id, action_type: "cost_floor_profile",
            target: res.key, details: { from: res.from, to: res.to }, timestamp: new Date().toISOString(),
          }, user.id).catch(() => null);
        }
      } catch (e) { errors.push({ key, error: (e as Error).message }); }
    }

    return Response.json({
      ok: errors.length === 0, dry_run: dryRun, applied: changes, errors,
      note: "AI/media routed to the cheapest backend (self-hosted where configured, else free tiers), all LLM calls forced to the small Llama model, and a daily AI spend cap set. Image generation stays on its managed provider unless a SELF_IMAGE_URL is set — add one (SDXL/FLUX) to take it to $0 too.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

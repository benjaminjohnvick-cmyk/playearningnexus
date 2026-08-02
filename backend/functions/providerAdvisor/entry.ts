import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { primeSettings, snapString } from "../../sdk/settings.ts";
import { monthlyUsage, adviseCapability, gpuMonthlyCostUsd, advisorMargin, Capability } from "../../sdk/provider-advisor.ts";

// providerAdvisor (ADMIN) — the self-host recommendation panel's data. For each AI capability it returns
// this month's REAL hosted spend, a run-rate projection, the self-hosted GPU break-even, whether to switch
// to self-hosting now, the current provider, and the exact setting + steps to flip. Free-tier / self-hosted
// usage shows $0 and never recommends. Read-only.
export default __handler(async (req) => {
  try {
    await primeSettings();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const usage = await monthlyUsage();
    const current: Record<Capability, string> = {
      llm: snapString("LLM_PROVIDER", "groq"),
      stt: snapString("PROVIDER_STT", "groq"),
      tts: snapString("PROVIDER_TTS", "managed"),
      image: snapString("IMAGE_PROVIDER", "aws_bedrock"),
    };
    const howTo: Record<Capability, { setting: string; value: string; steps: string }> = {
      llm: { setting: "LLM_PROVIDER", value: "self", steps: "Stand up an OpenAI-compatible server (vLLM/Ollama) with Llama, set SELF_LLM_URL + SELF_LLM_MODEL, then LLM_PROVIDER=self." },
      stt: { setting: "PROVIDER_STT", value: "self", steps: "Run a faster-whisper server, set SELF_STT_URL, then PROVIDER_STT=self." },
      tts: { setting: "PROVIDER_TTS", value: "self", steps: "Run an XTTS/Piper server, set SELF_TTS_URL, then PROVIDER_TTS=self." },
      image: { setting: "IMAGE_PROVIDER", value: "self", steps: "Run an SDXL/FLUX server, set SELF_IMAGE_URL, then IMAGE_PROVIDER=self (or use aws_sagemaker for a scale-to-zero endpoint)." },
    };

    const caps: Capability[] = ["llm", "stt", "tts", "image"];
    const recommendations = caps.map((cap) => {
      const advice = adviseCapability(cap, usage[cap] || 0);
      const alreadySelf = current[cap] === "self";
      return {
        ...advice,
        current_provider: current[cap],
        already_self_hosted: alreadySelf,
        recommend_self_host: advice.recommend_self_host && !alreadySelf,
        how_to: howTo[cap],
      };
    });

    return Response.json({
      month: new Date().toISOString().slice(0, 7),
      gpu_break_even_usd: gpuMonthlyCostUsd(),
      recommend_margin: advisorMargin(),
      any_recommended: recommendations.some((r) => r.recommend_self_host),
      recommendations,
      note: "Recommendations reflect REAL hosted spend only — free-tier (Groq) and self-hosted calls cost $0, so they never trigger a switch. Self-hosting is already coded in; this just tells you when it pays off.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

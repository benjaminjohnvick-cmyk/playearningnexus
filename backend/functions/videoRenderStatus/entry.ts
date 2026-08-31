import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { renderConfig, providerInfo, RENDER_PROVIDERS, type RenderProvider } from "../../sdk/video-render.ts";

// videoRenderStatus — read-only: the active video render provider, its config + daily caps, whether it's
// configured (has its key/endpoint), and the comparison across all providers (none / Abacus aggregator /
// serverless GPU). Admin only. Moves/renders nothing.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const cfg = renderConfig();
    return Response.json({
      ok: true,
      active_provider: cfg.provider,
      configured: cfg.configured,
      config: { model: cfg.model, resolution: cfg.resolution, duration_s: cfg.duration_s, daily_cap_count: cfg.daily_cap_count, daily_cap_usd: cfg.daily_cap_usd },
      providers: RENDER_PROVIDERS.map((p) => ({ id: p, ...providerInfo(p as RenderProvider) })),
      note: cfg.provider === "none"
        ? "Render is OFF (concepts only, zero spend). Set VIDEO_ENGINE_RENDER_PROVIDER to 'abacus' or 'serverless_gpu' + add its key to render winners."
        : `Rendering via ${cfg.provider}${cfg.configured ? "" : " (missing key/endpoint — not active yet)"}.`,
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});

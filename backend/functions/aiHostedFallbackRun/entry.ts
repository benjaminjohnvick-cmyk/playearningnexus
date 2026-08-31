import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool, getNumber } from "../../sdk/settings.ts";
import { decideAiHostFallback, buildAiHostBrief, type CampaignMetrics } from "../../sdk/ai-host.ts";
import { renderConfig, renderGate, renderVideoCall } from "../../sdk/video-render.ts";
import { resolveMonetization } from "../../sdk/hosting-monetization.ts";
import { AD_DISCLOSURE } from "../../sdk/disclosure.ts";

// aiHostedFallbackRun — the advertiser "backup channel." When a product isn't converting on social (weak CTR /
// few conversions despite enough impressions), this launches a live-shopping session hosted by an AI PRESENTER
// the advertiser configured for their target demographic, rendered on Abacus.AI (the engine wired earlier this
// session), monetized as live shopping (buyers pay Site Cash, the business is paid real money, users only get
// Site Cash). The AI host is disclosed as AI + #ad and never promises results. Gated behind
// AI_HOSTED_SESSIONS_ENABLED. Admin / scheduled.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const enabled = snapBool("AI_HOSTED_SESSIONS_ENABLED", false);
    const body = await req.json().catch(() => ({}));

    const metrics: CampaignMetrics = {
      impressions: Number(body?.metrics?.impressions) || 0,
      clicks: Number(body?.metrics?.clicks) || 0,
      conversions: Number(body?.metrics?.conversions) || 0,
    };
    const thresholds = {
      minImpressions: await getNumber("AI_HOST_MIN_IMPRESSIONS", 500),
      minCtrPct: await getNumber("AI_HOST_MIN_CTR_PCT", 0.5),
      minConversions: await getNumber("AI_HOST_MIN_CONVERSIONS", 1),
    };
    const decision = decideAiHostFallback(metrics, thresholds);

    if (!enabled) {
      return Response.json({ ok: true, enabled: false, decision, note: "AI-hosted fallback is OFF (AI_HOSTED_SESSIONS_ENABLED) — preview only." });
    }
    if (!decision.trigger || body.dry_run === true) {
      return Response.json({ ok: true, enabled, decision, launched: false });
    }

    // Build the compliant render brief and render the AI host on Abacus (gated + capped).
    const brief = buildAiHostBrief({
      productName: String(body?.product?.name || body?.product_name || "the product"),
      valueProps: Array.isArray(body?.product?.value_props) ? body.product.value_props : [],
      targetDemographic: String(body?.target_demographic || ""),
      disclosureTag: AD_DISCLOSURE,
    });
    const cfg = renderConfig();
    const gate = renderGate(cfg, Number(body?.rendered_today) || 0, Number(body?.spent_today_usd) || 0, Number(body?.est_cost_usd) || 0);
    let render: { ok: boolean; video_url?: string; job_id?: string; reason?: string } = { ok: false, reason: "render skipped" };
    if (gate.can_render) render = await renderVideoCall(cfg, brief.prompt).catch((e) => ({ ok: false, reason: String(e?.message || e) }));
    else render = { ok: false, reason: gate.reason };

    // Monetize as live shopping if that gate is on, else a plain (free) AI-hosted stream.
    const money = resolveMonetization("live_shopping_5050", {
      tournamentsSiteCash: false, tournamentsRealMoney: false, paidAccess: false,
      liveShopping: snapBool("HOSTING_LIVE_SHOPPING_ENABLED", false),
      platformSharePct: await getNumber("HOSTING_REVENUE_PLATFORM_PCT", 50),
    });
    const mode = money.allowed ? "live_shopping_5050" : "free";

    // Create a SERVER-hosted session with the AI as host + full disclosure recorded.
    const sessionId = `sess_aihost_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (body.dry_run !== true) {
      await db.create("GameSession", {
        session_id: sessionId, room_id: String(body?.campaign_id || body?.advertiser_id || "ai_host"),
        content_type: "stream", title: `AI host: ${String(body?.product?.name || body?.product_name || "product")}`,
        host_type: "server", host_player_id: null, ai_host: true,
        disclosure: brief.disclosure, video_url: render.video_url ?? null, render_job_id: render.job_id ?? null,
        monetization: mode, monetization_policy: money.policy ?? null,
        advertiser_id: body?.advertiser_id ?? null, campaign_id: body?.campaign_id ?? null,
        trigger_reason: decision.reason,
        status: "active", started_by: user.email ?? user.id, started_at: new Date().toISOString(), rewarded: false,
      }, user.email ?? String(user.id)).catch(() => null);
    }

    return Response.json({
      ok: true, enabled, launched: true, decision, session_id: sessionId,
      monetization: mode, render: { ok: render.ok, video_url: render.video_url ?? null, job_id: render.job_id ?? null, reason: render.reason ?? null },
      disclosure: brief.disclosure,
      note: `Launched an AI-hosted ${mode === "free" ? "" : "live-shopping "}session for the underperforming campaign. AI host is disclosed (${AD_DISCLOSURE}, not a real person, no guaranteed results). Business is paid real money; users only get Site Cash.`,
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});

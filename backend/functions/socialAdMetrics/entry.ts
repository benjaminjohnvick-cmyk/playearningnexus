import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { computeSocialAdMetrics, computeAllAdvertisersSocial, socialAdMetricsEnabled } from "../../sdk/social-ad-metrics.ts";

// socialAdMetrics — the full advertising-metric set for the SOCIAL channel, tracked for every advertiser AND
// the platform's own business ads. An advertiser gets their OWN social metrics; an admin can request any
// advertiser, the platform's own ads ("platform_own"), the platform-wide total ("all"), or the per-advertiser
// leaderboard. Measured from real SocialMediaPost activity; never a guaranteed result.
//   Body: { scope?: "own" | "all" | "platform_own" | "<advertiser_id>", window_days?, leaderboard? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!socialAdMetricsEnabled()) return Response.json({ success: true, enabled: false, note: "Social ad metrics are disabled (SOCIAL_AD_METRICS_ENABLED)." });

    const body = await req.json().catch(() => ({}));
    const windowDays = Math.max(1, Math.min(Number(body.window_days) || 7, 365));
    const isAdmin = user.role === "admin";
    const rawScope = String(body.scope || "own");

    // Non-admins can only ever see their OWN social metrics.
    if (!isAdmin) {
      const metrics = await computeSocialAdMetrics(user.id, windowDays);
      return Response.json({ success: true, admin: false, metrics });
    }

    // Admin: leaderboard of all advertisers + platform-wide totals.
    if (body.leaderboard || rawScope === "all") {
      const board = await computeAllAdvertisersSocial(windowDays, Math.max(1, Math.min(Number(body.limit) || 100, 500)));
      return Response.json({ success: true, admin: true, scope: "all", ...board });
    }

    // Admin: a specific scope — "own"(=admin's own advertiser id), "platform_own", or an explicit advertiser id.
    const scope = rawScope === "own" ? user.id : rawScope;
    const metrics = await computeSocialAdMetrics(scope, windowDays);
    return Response.json({ success: true, admin: true, scope, metrics });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

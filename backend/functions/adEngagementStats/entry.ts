import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { computeAdvertiserMetrics } from "../../sdk/advertiser-metrics.ts";
import {
  engagementRates, engagementInsight, ENGAGEMENT_PRIVACY_NOTE, adEngagementEnabled,
  type EngagementTotals,
} from "../../sdk/ad-engagement.ts";

// adEngagementStats (authenticated, read-only) — the advertiser-facing view of the two ad buttons.
// Shows, for the CALLING advertiser's own ads: Interested count + rate, Buy Now count + rate, and the
// interest→purchase conversion, per ad/campaign and overall, plus a plain-language AI insight. PRIVACY GUARDRAIL:
// only AGGREGATE counts and rates are returned — never the identities of the users behind them; retargeting of
// interested users happens on-platform.
//   Body: { window_days?, campaign_id?, ad_id? }
export default __handler(async (req) => {
  try {
    if (!adEngagementEnabled()) return Response.json({ enabled: false });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const uid = String(user.id);
    const body = await req.json().catch(() => ({}));
    const windowDays = Math.max(1, Math.round(Number(body.window_days) || 7));
    const sinceMs = Date.now() - windowDays * 86_400_000;
    const filterCampaign = String(body.campaign_id || "") || null;
    const filterAd = String(body.ad_id || "") || null;

    // this advertiser's engagement rows in the window
    const rows = (await db.filter("AdEngagement", { advertiser_id: uid }, "-created_date", 5000).catch(() => [])) as Record<string, unknown>[];
    const inWindow = (rows || []).filter((r) => {
      const at = new Date(String(r.at || r.created_date || 0)).getTime();
      if (!(at >= sinceMs)) return false;
      if (filterCampaign && String(r.campaign_id || "") !== filterCampaign) return false;
      if (filterAd && String(r.ad_id || "") !== filterAd) return false;
      return true;
    });

    let interested = 0, buyNow = 0;
    const perAd: Record<string, { ad_id: string; interested: number; buy_now: number }> = {};
    for (const r of inWindow) {
      const k = String(r.kind);
      const adId = String(r.ad_id || "unknown");
      perAd[adId] ||= { ad_id: adId, interested: 0, buy_now: 0 };
      if (k === "interested") { interested++; perAd[adId].interested++; }
      else if (k === "buy_now") { buyNow++; perAd[adId].buy_now++; }
    }

    // impressions + conversions come from the existing advertiser metrics (real measured activity).
    const metrics = await computeAdvertiserMetrics(uid, windowDays).catch(() => null);
    const impressions = Number(metrics?.impressions) || 0;
    const purchases = Number(metrics?.conversions) || buyNow; // best-effort: on-platform conversions, else buy-now as proxy

    const totals: EngagementTotals = { impressions, interested, buy_now: buyNow, purchases };
    const rates = engagementRates(totals);
    const insight = engagementInsight(totals, rates);

    const per_ad = Object.values(perAd)
      .map((a) => ({
        ...a,
        ...engagementRates({ impressions, interested: a.interested, buy_now: a.buy_now, purchases: 0 }),
      }))
      .sort((x, y) => (y.interested + y.buy_now) - (x.interested + x.buy_now))
      .slice(0, 100);

    return Response.json({
      enabled: true,
      window_days: windowDays,
      totals: { impressions, interested, buy_now: buyNow, purchases },
      rates,
      per_ad,
      insight,
      privacy_note: ENGAGEMENT_PRIVACY_NOTE,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

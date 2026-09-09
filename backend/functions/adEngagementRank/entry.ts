import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  buildAffinity, rankAdsForUser, adEngagementEnabled,
  type EngagementSignal, type AdCandidate,
} from "../../sdk/ad-engagement.ts";

// adEngagementRank (authenticated) — the AI ad-optimization read: given the caller and a set of candidate ads,
// return them ranked so each user sees the ads they're most likely to be Interested in / want to Buy. It blends
// (a) the user's own affinity, learned from their past Interested/Buy Now signals (buy-now weighted higher), with
// (b) each ad's proven pull (relative Interested/Buy Now popularity). New users cold-start to the strongest ads.
// Pass candidates in `ads`, or omit to rank active AdListings.
//   Body: { ads?: [{ ad_id, category?, advertiser_id? }], limit? }
export default __handler(async (req) => {
  try {
    if (!adEngagementEnabled()) return Response.json({ enabled: false, ranked: [] });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();          // guest → uid empty → pure cold-start ranking
    const uid = user ? String(user.id) : "";
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(200, Math.max(1, Math.round(Number(body.limit) || 60)));

    // 1) the user's affinity from their own signals
    let affinitySignals: EngagementSignal[] = [];
    if (uid) {
      const mine = (await db.filter("AdEngagement", { user_id: uid }, "-created_date", 500).catch(() => [])) as Record<string, unknown>[];
      affinitySignals = (mine || []).map((r) => ({
        kind: String(r.kind) === "buy_now" ? "buy_now" : "interested",
        category: (r.category as string) || null,
        advertiser_id: (r.advertiser_id as string) || null,
      }));
    }
    const affinity = buildAffinity(affinitySignals);

    // 2) each ad's proven pull — relative Interested/Buy Now popularity from recent global engagement (one query)
    const globalRows = (await db.filter("AdEngagement", {}, "-created_date", 5000).catch(() => [])) as Record<string, unknown>[];
    const tally: Record<string, { interested: number; buy_now: number }> = {};
    for (const r of globalRows || []) {
      const adId = String(r.ad_id || "");
      if (!adId) continue;
      tally[adId] ||= { interested: 0, buy_now: 0 };
      if (String(r.kind) === "buy_now") tally[adId].buy_now++; else tally[adId].interested++;
    }
    const maxI = Math.max(1, ...Object.values(tally).map((t) => t.interested));
    const maxB = Math.max(1, ...Object.values(tally).map((t) => t.buy_now));

    // 3) candidates: from the body, or active AdListings
    let candidates: AdCandidate[];
    if (Array.isArray(body.ads) && body.ads.length) {
      candidates = body.ads.slice(0, limit).map((a: Record<string, unknown>) => ({
        ad_id: String(a.ad_id || ""), category: (a.category as string) || null, advertiser_id: (a.advertiser_id as string) || null,
      }));
    } else {
      const listings = (await db.filter("AdListing", { status: "active" }, "-created_date", limit).catch(() => [])) as Record<string, unknown>[];
      candidates = (listings || []).map((a) => ({
        ad_id: String(a.id || a.ad_id || ""), category: (a.category as string) || null, advertiser_id: (a.advertiser_id as string) || null,
      }));
    }

    // attach relative pull (mapped into the scorer's expected 0–5% / 0–2% ranges as a popularity proxy)
    for (const c of candidates) {
      const t = tally[c.ad_id];
      c.interest_rate_pct = t ? (t.interested / maxI) * 5 : 0;
      c.buy_now_rate_pct = t ? (t.buy_now / maxB) * 2 : 0;
    }

    const ranked = rankAdsForUser(candidates.filter((c) => c.ad_id), affinity).slice(0, limit);
    return Response.json({
      enabled: true,
      cold_start: affinity.total === 0,
      buy_intent: affinity.buyIntent,
      ranked: ranked.map((r) => ({ ad_id: r.ad_id, score: r.score, reasons: r.reasons })),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import {
  advertiserFeatureCatalogEnabled, advertiserFeatureCatalog, tierFeatureRollup, type FeatureTier,
} from "../../sdk/advertiser-features.ts";
import { foundingPriceUsd } from "../../sdk/founding-advertiser.ts";

// advertiserFeatureCatalog — read the TIERED advertiser feature catalog: every advertiser-facing revenue stream
// as an add-on feature, mapped to Tiers 1–3, with its conventional value and readiness. Also returns the
// per-tier rollup showing how much delivered value the live features ADD (holding the price, so the value ratio
// climbs), and the founding view (the whole catalog, free — the PMF panel). Read-only; makes no claim of ROI.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!advertiserFeatureCatalogEnabled()) {
      return Response.json({ ok: true, enabled: false, note: "Advertiser feature catalog is OFF." });
    }

    const priceUsd = Number(foundingPriceUsd()) || 12000;
    const catalog = advertiserFeatureCatalog();
    const tiers: FeatureTier[] = [1, 2, 3];
    const rollups = tiers.map((t) => tierFeatureRollup(t, { priceUsd }));
    const founding = tierFeatureRollup(3, { founding: true, priceUsd });

    return Response.json({
      ok: true, enabled: true,
      pricing_posture: "Prices held; the delivered-value ratio climbs as live features stack. Values are advertising value delivered, never a revenue or ROI claim.",
      catalog,
      tiers: rollups.map((r) => ({
        tier: r.tier,
        price_usd: r.price_usd,
        included_features: r.features.map((f) => ({ key: f.key, name: f.name, value_usd: f.value_usd, live: f.live, readiness: f.readiness_note, revenue_type: f.revenue_type })),
        live_count: r.live_count,
        pending_count: r.pending_count,
        added_delivered_value_usd: r.added_delivered_value_usd,
        added_listed_value_usd: r.added_listed_value_usd,
      })),
      founding: {
        note: "Founding / pre-revenue Tier 1 includes the ENTIRE catalog free — the founding privilege and PMF panel.",
        included_feature_count: founding.features.length,
        live_count: founding.live_count,
        pending_count: founding.pending_count,
        added_delivered_value_usd: founding.added_delivered_value_usd,
        added_listed_value_usd: founding.added_listed_value_usd,
      },
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});

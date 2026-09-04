import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { pickHouseCrossSell } from "../../sdk/cross-promo.ts";
import { extensionEnabled, extensionOwnAdsEnabled } from "../../sdk/extension.ts";

// extensionAdServe (authenticated) — returns ONE ad creative for the extension's own surface (new-tab / popup)
// to render. Serves only from campaigns the advertiser made extension-eligible (the disclosed inventory clause);
// if none are available it returns a HOUSE cross-sell creative (refer / Premium / spend) so the slot is never
// empty and still markets the flywheel. Read-only — it never credits or bills; the reward happens after a real
// completed view via extensionAdReward. Never injects into third-party pages; this is our own surface.
//   {} → { ad: { ad_id, title, image_url, url, advertiser_id, house? } } | { error }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!extensionEnabled() || !extensionOwnAdsEnabled()) return Response.json({ error: "Extension ads aren't available right now." }, { status: 403 });

    // Eligible paid inventory: active campaigns the advertiser left extension-eligible (default true, opt-out).
    const active = await db.filter("AdCampaign", { status: "active" }, "-created_date", 200).catch(() => []) as Record<string, unknown>[];
    const eligible = (active || []).filter((c) => c.extension_eligible !== false && (c.image_url || c.title));

    let ad: Record<string, unknown>;
    if (eligible.length) {
      // Rotate deterministically by day + user so views spread across advertisers.
      const seed = (new Date().getUTCHours()) + String(user.id).length;
      const c = eligible[seed % eligible.length];
      ad = {
        ad_id: String(c.id || ""),
        advertiser_id: String(c.advertiser_user_id || c.advertiser || c.business_id || ""),
        title: String(c.title || c.headline || c.advertiser_name || "Sponsored"),
        image_url: String(c.image_url || ""),
        url: String(c.landing_url || c.target_url || "#"),
        house: false,
      };
    } else {
      // No paid inventory → house cross-sell so the slot still does marketing work (never empty, never billed).
      ad = pickHouseCrossSell(user as Record<string, unknown>);
    }

    return Response.json({ ad });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

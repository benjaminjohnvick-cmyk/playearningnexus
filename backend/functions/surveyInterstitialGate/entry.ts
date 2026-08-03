import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { snapBool, snapNumber } from "../../sdk/settings.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";

// surveyInterstitialGate (authenticated) — the mandatory ~30s ad BETWEEN surveys for non-premium users
// (flywheel #3 addition). Premium is exempt (an upgrade incentive). The ad is served from your OWN inventory
// (AdGrid / sponsored slots), so the impression feeds your ad revenue (flywheel #1) instead of a third party.
//   GET-style {}                 → { required, seconds, ad, premium }   (is an ad required before the next survey?)
//   { completed: true, ad_id }   → { ok }                               (record the impression; clears the gate)
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const enabled = snapBool("SURVEY_INTERSTITIAL_ENABLED", true);
    const seconds = Math.max(5, Math.min(60, snapNumber("SURVEY_INTERSTITIAL_SECONDS", 30)));
    const nonPremiumOnly = snapBool("SURVEY_INTERSTITIAL_NONPREMIUM_ONLY", true);
    const premium = await isPremiumUser(user.id);

    const body = await req.json().catch(() => ({}));

    // Record a completed impression (idempotent-ish; feeds ad revenue reporting).
    if (body.completed) {
      await base44.asServiceRole.entities.AdImpression.create({
        user_id: user.id, ad_id: String(body.ad_id || "house"), placement: "survey_interstitial",
        seconds, day: new Date().toISOString().slice(0, 10),
      }).catch(() => null);
      return Response.json({ ok: true });
    }

    const required = enabled && !(nonPremiumOnly && premium);
    if (!required) return Response.json({ required: false, premium });

    // Serve one ad from your own inventory: an active AdGrid/sponsored slot, else a house ad.
    const slots = await base44.asServiceRole.entities.AdGridAd.filter({ status: "active" }).then((r: any) => r || []).catch(() => []) as Record<string, unknown>[];
    const pick = (slots || [])[0] || null;
    const ad = pick
      ? { ad_id: pick.id, title: pick.title || pick.advertiser_name || "Sponsored", image_url: pick.image_url || "", url: pick.landing_url || "" }
      : { ad_id: "house", title: "Upgrade to Premium — skip the ads", image_url: "", url: "/Pricing" };

    return Response.json({ required: true, seconds, premium, ad });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

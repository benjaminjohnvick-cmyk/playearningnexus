import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { snapBool, snapNumber } from "../../sdk/settings.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";
import { db } from "../../sdk/db.ts";
import { noteFoundingImpression } from "../../sdk/founding-advertiser.ts";
import { pickInterstitialAd } from "../../sdk/interstitial-ad.ts";
import { premiumAdFreeActive } from "../../sdk/premium-adfree.ts";

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
    const seconds = Math.max(5, Math.min(60, snapNumber("SURVEY_INTERSTITIAL_SECONDS", 35)));
    const nonPremiumOnly = snapBool("SURVEY_INTERSTITIAL_NONPREMIUM_ONLY", true);
    const premium = await isPremiumUser(user.id);

    const body = await req.json().catch(() => ({}));

    // Record a completed impression (idempotent-ish; feeds ad revenue reporting). If the served ad belonged
    // to a founding advertiser, meter it against their yearly allotment.
    if (body.completed) {
      await base44.asServiceRole.entities.AdImpression.create({
        user_id: user.id, ad_id: String(body.ad_id || "house"), placement: "survey_interstitial",
        seconds, day: new Date().toISOString().slice(0, 10),
      }).catch(() => null);
      if (body.founding_owner_id) await noteFoundingImpression(db, String(body.founding_owner_id)).catch(() => {});
      // Make-good delivery meters against the SAME served counter, so the free top-up drives itself to
      // fulfillment (the daily sweep closes it out once the target is reached).
      if (body.makegood_owner_id) await noteFoundingImpression(db, String(body.makegood_owner_id)).catch(() => {});
      return Response.json({ ok: true });
    }

    // Premium members who opted into the ad-free arrangement AND completed today's extra minute skip the ad.
    const adFree = await premiumAdFreeActive(db, user, premium);
    const required = enabled && !(nonPremiumOnly && premium) && !adFree;
    if (!required) return Response.json({ required: false, premium, ad_free: adFree });

    // Serve one ad from your OWN inventory (founding → paying PPC → earned/free → residual make-good → house).
    // Shared with the in-app interstitial via pickInterstitialAd so the two placements never drift apart.
    const picked = await pickInterstitialAd(base44, db, {
      ppcPriority: snapBool("SURVEY_INTERSTITIAL_PPC_PRIORITY", true),
      houseTitle: "Get Goods Gratis",
      houseUrl: "/",
      user,
    });

    return Response.json({ required: true, seconds, premium, ad: picked.ad });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

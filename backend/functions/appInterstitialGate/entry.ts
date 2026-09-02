import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { snapBool, snapNumber } from "../../sdk/settings.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";
import { db } from "../../sdk/db.ts";
import { noteFoundingImpression } from "../../sdk/founding-advertiser.ts";
import { pickInterstitialAd } from "../../sdk/interstitial-ad.ts";

// appInterstitialGate (authenticated) — the full-screen IN-APP ad shown at natural breaks during general
// app use (NOT just between surveys). Served from your OWN inventory (AdGrid / sponsored / house), so the
// impression is your ad revenue. Shown to EVERYONE by default (IN_APP_AD_NONPREMIUM_ONLY can exempt premium).
// Frequency is capped CLIENT-side using the returned min_gap_min, so a user never sees two in-app ads within
// that window. Gated behind IN_APP_ADS_ENABLED.
//   {}                          → { required, seconds, min_gap_min, premium, ad }
//   { completed:true, ad_id }   → { ok }   (record the impression)
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const enabled = snapBool("IN_APP_ADS_ENABLED", true);
    const seconds = Math.max(5, Math.min(60, snapNumber("IN_APP_AD_SECONDS", 35)));
    const minGapMin = Math.max(0, Math.min(240, snapNumber("IN_APP_AD_MIN_GAP_MIN", 3)));
    const nonPremiumOnly = snapBool("IN_APP_AD_NONPREMIUM_ONLY", false);
    const premium = await isPremiumUser(user.id);

    const body = await req.json().catch(() => ({}));

    // Record a completed impression; meter founding / make-good owners against their allotment.
    if (body.completed) {
      await base44.asServiceRole.entities.AdImpression.create({
        user_id: user.id, ad_id: String(body.ad_id || "house"), placement: "in_app_interstitial",
        seconds, day: new Date().toISOString().slice(0, 10),
      }).catch(() => null);
      if (body.founding_owner_id) await noteFoundingImpression(db, String(body.founding_owner_id)).catch(() => {});
      if (body.makegood_owner_id) await noteFoundingImpression(db, String(body.makegood_owner_id)).catch(() => {});
      return Response.json({ ok: true });
    }

    const required = enabled && !(nonPremiumOnly && premium);
    if (!required) return Response.json({ required: false, premium, min_gap_min: minGapMin });

    const picked = await pickInterstitialAd(base44, db, {
      ppcPriority: snapBool("SURVEY_INTERSTITIAL_PPC_PRIORITY", true),
      houseTitle: "Get Goods Gratis",
      houseUrl: "/",
    });

    return Response.json({ required: true, seconds, min_gap_min: minGapMin, premium, ad: picked.ad });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { snapBool, snapNumber } from "../../sdk/settings.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";
import { db } from "../../sdk/db.ts";
import { foundingInterstitialPriority, activeFoundingAdOwners, noteFoundingImpression } from "../../sdk/founding-advertiser.ts";

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

    // Record a completed impression (idempotent-ish; feeds ad revenue reporting). If the served ad belonged
    // to a founding advertiser, meter it against their yearly allotment.
    if (body.completed) {
      await base44.asServiceRole.entities.AdImpression.create({
        user_id: user.id, ad_id: String(body.ad_id || "house"), placement: "survey_interstitial",
        seconds, day: new Date().toISOString().slice(0, 10),
      }).catch(() => null);
      if (body.founding_owner_id) await noteFoundingImpression(db, String(body.founding_owner_id)).catch(() => {});
      return Response.json({ ok: true });
    }

    const required = enabled && !(nonPremiumOnly && premium);
    if (!required) return Response.json({ required: false, premium });

    // Serve one ad from your own inventory. Founding advertisers' active creatives get PRIORITY (up to their
    // allotment); then any active AdGrid/sponsored slot; then a house ad.
    const slots = await base44.asServiceRole.entities.AdGridAd.filter({ status: "active" }).then((r: any) => r || []).catch(() => []) as Record<string, unknown>[];
    let pick = (slots || [])[0] || null;
    let foundingOwnerId: string | null = null;
    if (foundingInterstitialPriority() && (slots || []).length) {
      const owners = await activeFoundingAdOwners(db).catch(() => new Set<string>());
      const fpick = (slots || []).find((s) => owners.has(String(s.created_by)));
      if (fpick) { pick = fpick; foundingOwnerId = String(fpick.created_by); }
    }
    const ad = pick
      ? { ad_id: pick.id, title: pick.title || pick.advertiser_name || "Sponsored", image_url: pick.image_url || "", url: pick.landing_url || "", founding: !!foundingOwnerId, founding_owner_id: foundingOwnerId }
      : { ad_id: "house", title: "Upgrade to Premium — skip the ads", image_url: "", url: "/Pricing" };

    return Response.json({ required: true, seconds, premium, ad });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

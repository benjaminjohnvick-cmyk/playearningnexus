import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { snapBool, snapNumber } from "../../sdk/settings.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";
import { db } from "../../sdk/db.ts";
import { foundingInterstitialPriority, activeFoundingAdOwners, noteFoundingImpression } from "../../sdk/founding-advertiser.ts";
import { activeEarnedAdOwners } from "../../sdk/earned-advertiser.ts";

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

    // Serve one ad from your own inventory. Priority order:
    //   1) Founding advertisers' active creatives (up to their yearly allotment),
    //   2) Paying PPC-grid advertisers' active creatives,
    //   3) any active AdGrid/sponsored slot, then
    //   4) a house ad.
    const slots = await base44.asServiceRole.entities.AdGridAd.filter({ status: "active" }).then((r: any) => r || []).catch(() => []) as Record<string, unknown>[];
    let pick = (slots || [])[0] || null;
    let foundingOwnerId: string | null = null;
    let ppcAdvertiser = false;
    if (foundingInterstitialPriority() && (slots || []).length) {
      const owners = await activeFoundingAdOwners(db).catch(() => new Set<string>());
      const fpick = (slots || []).find((s) => owners.has(String(s.created_by)));
      if (fpick) { pick = fpick; foundingOwnerId = String(fpick.created_by); }
    }
    // If no founding ad was chosen, prefer an ad whose advertiser is actively paying for the PPC grid, so
    // paying PPC advertisers are placed in the mandatory between-survey slot ahead of any stray/house ad.
    if (!foundingOwnerId && snapBool("SURVEY_INTERSTITIAL_PPC_PRIORITY", true) && (slots || []).length) {
      const advertisers = await base44.asServiceRole.entities.User.filter({ ppc_grid_active: true }).then((r: any) => r || []).catch(() => []) as Record<string, unknown>[];
      const paying = new Set((advertisers || []).map((a) => String(a.id)));
      const ppick = (slots || []).find((s) => paying.has(String(s.advertiser_user_id)) || paying.has(String(s.created_by)));
      if (ppick) { pick = ppick; ppcAdvertiser = true; }
    }
    // Then earned / no-upfront advertisers whose free advertising is currently delivering (participating).
    // Their unlocked/free ad benefit actually shows here, after founding + paid PPC priority, before house.
    let earnedAdvertiser = false;
    if (!foundingOwnerId && !ppcAdvertiser && (slots || []).length) {
      const earnedOwners = await activeEarnedAdOwners(db, new Date().toISOString().slice(0, 10)).catch(() => new Set<string>());
      if (earnedOwners.size) {
        const epick = (slots || []).find((s) => earnedOwners.has(String(s.advertiser_user_id)) || earnedOwners.has(String(s.created_by)));
        if (epick) { pick = epick; earnedAdvertiser = true; }
      }
    }
    const ad = pick
      ? { ad_id: pick.id, title: pick.title || pick.product_name || pick.advertiser_name || "Sponsored", image_url: pick.image_url || "", url: pick.landing_url || pick.product_url || "", founding: !!foundingOwnerId, founding_owner_id: foundingOwnerId, ppc_advertiser: ppcAdvertiser, earned_advertiser: earnedAdvertiser }
      : { ad_id: "house", title: "Upgrade to Premium — skip the ads", image_url: "", url: "/Pricing" };

    return Response.json({ required: true, seconds, premium, ad });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

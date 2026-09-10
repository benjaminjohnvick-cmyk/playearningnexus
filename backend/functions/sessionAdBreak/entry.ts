import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool, snapNumber } from "../../sdk/settings.ts";
import { pickInterstitialAd } from "../../sdk/interstitial-ad.ts";
import { noteFoundingImpression } from "../../sdk/founding-advertiser.ts";

// sessionAdBreak — the audio/video AD BREAK that runs between product segments of a hosted livestream. It draws
// from the SAME ad inventory as every other placement (pickInterstitialAd → founding / PPC / earned / house),
// targeted to THIS viewer, with the creative's resolved audio/video media. So the livestream is a placement of
// the advertising ecosystem: each break is your ad revenue. Gated by SESSION_HOSTING_ENABLED +
// HOSTING_AD_BREAK_BETWEEN_PRODUCTS. Records a completed impression the same way appInterstitialGate does.
//   POST { room }                        → { required, seconds, ad }
//   POST { room, completed:true, ad_id } → { ok }   (record the impression / meter the owner)
export default __handler(async (req) => {
  try {
    if (!snapBool("SESSION_HOSTING_ENABLED", false)) return Response.json({ required: false, enabled: false });
    if (!snapBool("HOSTING_AD_BREAK_BETWEEN_PRODUCTS", true)) return Response.json({ required: false, ad_breaks: false });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const room = String(body.room || "").slice(0, 200);
    const seconds = Math.max(5, Math.min(60, snapNumber("HOSTING_AD_BREAK_SECONDS", 15)));

    // Record a completed impression; meter founding / make-good owners against their allotment.
    if (body.completed) {
      await base44.asServiceRole.entities.AdImpression.create({
        user_id: user.id, ad_id: String(body.ad_id || "house"), placement: "livestream_ad_break",
        seconds, day: new Date().toISOString().slice(0, 10),
      }).catch(() => null);
      if (body.founding_owner_id) await noteFoundingImpression(db, String(body.founding_owner_id)).catch(() => {});
      if (body.makegood_owner_id) await noteFoundingImpression(db, String(body.makegood_owner_id)).catch(() => {});
      return Response.json({ ok: true });
    }

    const picked = await pickInterstitialAd(base44, db, {
      ppcPriority: snapBool("SURVEY_INTERSTITIAL_PPC_PRIORITY", true),
      houseTitle: "Get Goods Gratis",
      houseUrl: "/",
      user,
    });

    return Response.json({
      required: true, seconds, room,
      ad: picked.ad,
      founding_owner_id: picked.foundingOwnerId ?? null,
      makegood_owner_id: picked.makegoodOwnerId ?? null,
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});

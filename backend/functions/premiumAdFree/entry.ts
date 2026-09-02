import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { snapBool, snapNumber } from "../../sdk/settings.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";
import { db } from "../../sdk/db.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { pickInterstitialAd } from "../../sdk/interstitial-ad.ts";
import { recordRevenue } from "../../sdk/revenue.ts";
import { impressionsValueUsd } from "../../sdk/full-value-guarantee.ts";
import { adFreeEnabled, adFreeEnrolled, adFreeAdSeconds, adFreeStatusToday, markAdFreeAdWatched, markAdFreeFeeCharged } from "../../sdk/premium-adfree.ts";

// premiumAdFree (authenticated) — the premium "skip ads by watching one extra ad a day" option. The extra
// "9th minute" is a 60-second SPONSORED full-screen ad; advertisers OPT IN to sponsor it (as part of their
// offer) and pay for the premium impression — that is the platform's revenue. The benefit is EARNED DAILY:
// the member must watch that day's extra ad, and it resets each UTC day.
//   {} | { action:"status" }                 → { enabled, premium, opted_in, ad_seconds, done_today, ad_free_now }
//   { action:"optin" | "optout" }            → set/clear the opt-in flag
//   { action:"start" }                       → auto-opt-in + return the 60s sponsored ad to display { ad, seconds }
//   { action:"complete", ad_id, ... }        → record the billable impression + mark the member ad-free for today
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const enabled = adFreeEnabled();
    const premium = await isPremiumUser(user.id);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "status");

    if (!enabled) {
      return Response.json({ ok: true, enabled: false, premium, opted_in: user.premium_adfree_optin === true, note: "The premium ad-free option is currently off (PREMIUM_ADFREE_ENABLED)." });
    }
    if (!premium && action !== "status") {
      return Response.json({ error: "The ad-free option is for premium members. Membership auto-activates after your first day." }, { status: 403 });
    }

    if (action === "optin") {
      // Re-enroll (premium members are enrolled by default; this clears a prior opt-out).
      await base44.asServiceRole.entities.User.update(user.id, {
        premium_adfree_optout: false,
        premium_adfree_optin_at: new Date().toISOString(),
        premium_adfree_consent: { accepted: true, ad_seconds: adFreeAdSeconds(), at: new Date().toISOString(), terms_version: body?.consent?.terms_version ?? "adfree-1" },
      }).catch(() => null);
      const st = await adFreeStatusToday(db, user.id);
      return Response.json({ ok: true, opted_in: true, ad_seconds: st.ad_seconds, done_today: st.met, note: `You're enrolled. Watch today's ${st.ad_seconds}-second ad to go ad-free — it resets each day, and only counts once you've watched it.` });
    }

    if (action === "optout") {
      await base44.asServiceRole.entities.User.update(user.id, { premium_adfree_optout: true, premium_adfree_optout_at: new Date().toISOString() }).catch(() => null);
      return Response.json({ ok: true, opted_in: false, note: "Turned off — you'll see ads like everyone else. Your membership fee still comes only from your earnings, never a bill. Turn it back on anytime." });
    }

    if (action === "start") {
      // Premium members are enrolled by default; starting the ad clears any prior opt-out (re-enroll).
      if (user.premium_adfree_optout === true) {
        await base44.asServiceRole.entities.User.update(user.id, {
          premium_adfree_optout: false, premium_adfree_optin_at: new Date().toISOString(),
          premium_adfree_consent: { accepted: true, ad_seconds: adFreeAdSeconds(), at: new Date().toISOString(), terms_version: "adfree-1", auto: true },
        }).catch(() => null);
      }
      // Serve a SPONSORED ad — only from advertisers who opted into this placement (adfree_minute); if none
      // opted in yet, a house ad is served so the member can still earn ad-free.
      const picked = await pickInterstitialAd(base44, db, { adfreeOnly: true, houseTitle: "Sponsored", houseUrl: "/" });
      return Response.json({ ok: true, opted_in: true, seconds: adFreeAdSeconds(), ad: picked.ad });
    }

    if (action === "complete") {
      // Record the billable premium impression for the sponsoring advertiser (your revenue), then mark the
      // member ad-free for the rest of today. Bill only for a shown impression — the client calls this after
      // the ad's countdown has actually elapsed.
      const adId = String(body?.ad_id || "house");
      const seconds = adFreeAdSeconds();
      await base44.asServiceRole.entities.AdImpression.create({
        user_id: user.id, ad_id: adId, placement: "adfree_minute", seconds, day: new Date().toISOString().slice(0, 10),
      }).catch(() => null);

      // AUTOMATIC per-impression CPM billing → your direct extra revenue. The extra ad-free minute is
      // incremental billable inventory (NOT metered against any prepaid package): the sponsoring advertiser is
      // charged PREMIUM_ADFREE_CPM_USD per impression, recorded to the revenue ledger. Server-authoritative —
      // the advertiser is looked up from the served ad, never taken from the client; a house ad bills nothing.
      let billedUsd = 0;
      if (adId !== "house") {
        const cpm = Math.max(0, snapNumber("PREMIUM_ADFREE_CPM_USD", 22));
        if (cpm > 0) {
          const adRow = await db.get("AdGridAd", adId).catch(() => null);
          const advId = adRow ? String((adRow as Record<string, unknown>).advertiser_user_id ?? (adRow as Record<string, unknown>).created_by ?? "") : "";
          if (advId) {
            billedUsd = impressionsValueUsd(1, cpm);
            await recordRevenue({ type: "advertising", amount_usd: billedUsd, business_id: advId, ref: adId, meta: { placement: "adfree_minute", cpm, impressions: 1, user_id: user.id } }).catch(() => {});
          }
        }
      }

      const res = await markAdFreeAdWatched(db, user.id, adId);

      // OPTIONAL extra points fee (default 0 — the advertiser already paid for the impression). Charged once
      // per ad-free day, only from earnings (floorZero → never a debt).
      let feeCharged = 0;
      if (res.just_met && !res.fee_charged) {
        const feePts = Math.max(0, Math.round(snapNumber("PREMIUM_ADFREE_FEE_POINTS", 0)));
        if (feePts > 0) {
          const before = Number((await db.get("User", user.id).catch(() => null))?.current_balance || 0);
          const after = await adjustUserBalance(user.id, -feePts, { field: "current_balance", floorZero: true });
          feeCharged = after === null ? 0 : Math.max(0, Math.round((before - after) * 100) / 100);
          if (feeCharged > 0) {
            await base44.asServiceRole.entities.Transaction.create({
              user_id: user.id, type: "premium_adfree_fee", amount_points: -feeCharged, cashable: false,
              description: `Ad-free day fee (${feeCharged} pts)`, at: new Date().toISOString(),
            }, user.id).catch(() => null);
          }
          await markAdFreeFeeCharged(db, user.id, feeCharged);
        }
      }

      return Response.json({ ok: true, ad_free_now: true, done_today: true, fee_charged: feeCharged, billed_usd: billedUsd, note: "Done — you watched today's ad, so you're ad-free for the rest of today. You keep all your survey earnings." });
    }

    // status (default) — premium members are ENROLLED by default; opted_in reflects "not opted out".
    const st = await adFreeStatusToday(db, user.id);
    const enrolled = adFreeEnrolled(user);
    return Response.json({
      ok: true, enabled: true, premium, opted_in: enrolled, ad_seconds: st.ad_seconds, done_today: st.met,
      ad_free_now: enabled && premium && enrolled && st.met,
      note: !premium ? "Premium membership auto-activates after your first day." : !enrolled ? "Ad-free is turned off for your account — turn it back on anytime." : st.met ? "You're ad-free for today." : `Watch today's ${st.ad_seconds}-second ad to skip all ads for the day — you keep all your survey earnings.`,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { computeSurveyReward, isPremiumUser } from "../../sdk/survey-reward.ts";
import { foundingFullKeepActive, recordFoundingFullKeepEarning } from "../../sdk/founding-advertiser.ts";
import { payReferralSignupBonusOnce, creditReferralOverrideOnEarn } from "../../sdk/referral-rewards.ts";
import { adgridThumbnailPrice, sessionGrossTarget, profileLine } from "../../sdk/adgrid.ts";

// adGridAnswer (authenticated) — the user answered a thumbnail's questions (incl. Option E interest). We:
//   1) record the response (suppresses the product if not interested),
//   2) append the answers to the user's plaintext product profile (AI-usable),
//   3) auto-add the product to their wishlist,
//   4) credit the survey value 50/50 (their 50% as points), running the referral hooks,
//   5) advance the daily session and hand back the product page to show next.
// Idempotent per (user, ad, day) so a re-submit can't double-pay.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const b = await req.json().catch(() => ({}));
    if (!b.ad_id) return Response.json({ error: "ad_id required" }, { status: 400 });
    const interested = b.interested !== false;
    const answers = (Array.isArray(b.answers) ? b.answers : []).map((a: any) => ({ q: String(a?.q || "").slice(0, 300), choice: String(a?.choice || "").slice(0, 120) }));

    const ad = await base44.asServiceRole.entities.AdGridAd.filter({ id: b.ad_id }).then((r: any) => r[0]);
    if (!ad) return Response.json({ error: "Ad not found" }, { status: 404 });

    const day = new Date().toISOString().slice(0, 10);
    const dup = await db.filter("AdGridResponse", { user_id: user.id, ad_id: ad.id, day }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const already = !!(dup && dup[0]);

    // 1) Record the response (append-only). interested:false suppresses this product for the user (adGridFeed filters it).
    if (!already) {
      await base44.asServiceRole.entities.AdGridResponse.create({
        user_id: user.id, ad_id: ad.id, day, answers, interested,
        product_name: ad.product_name, product_url: ad.product_url || null,
        created_at: new Date().toISOString(),
      }).catch(() => null);

      // 2) Append to the user's plaintext product profile (get-or-create).
      const profRows = await db.filter("UserProductProfile", { user_id: user.id }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
      const line = profileLine(day, String(ad.product_name), answers, interested);
      if (profRows && profRows[0]) {
        const prev = String(profRows[0].text || "");
        await db.update("UserProductProfile", String(profRows[0].id), { text: (prev + "\n" + line).slice(-100000), updated_at: new Date().toISOString() }).catch(() => null);
      } else {
        await base44.asServiceRole.entities.UserProductProfile.create({ user_id: user.id, text: line, updated_at: new Date().toISOString() }).catch(() => null);
      }

      // 3) Auto-wishlist the product (any product a user engages goes to their wishlist).
      const wl = await db.filter("ProductWishlistItem", { user_id: user.id, ad_id: ad.id }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
      if (!(wl && wl[0])) {
        await base44.asServiceRole.entities.ProductWishlistItem.create({
          user_id: user.id, ad_id: ad.id, product_name: ad.product_name, image_url: ad.image_url || null,
          product_url: ad.product_url || null, source: "adgrid", added_at: new Date().toISOString(),
        }).catch(() => null);
      }
    }

    // 4) Credit the thumbnail's survey value 50/50 (once per ad/day).
    let creditedPoints = 0;
    if (!already) {
      const gross = adgridThumbnailPrice();
      const premium = await isPremiumUser(user.id);
      const ff = await foundingFullKeepActive(db, user.id, day);
      const rw = await computeSurveyReward(premium, gross, ff.active ? 1 : undefined);
      if (rw.points > 0) { await adjustUserBalance(user.id, rw.points, { field: "points" }); creditedPoints = rw.points; }
      await adjustUserBalance(user.id, rw.realizedUsd, { field: "total_earnings" });
      if (ff.active && ff.record) await recordFoundingFullKeepEarning(db, ff.record, rw.realizedUsd, day);

      // DailyEarnings: gross drives the $8/day goal; realized is take-home value.
      const deRows = await base44.asServiceRole.entities.DailyEarnings.filter({ user_id: user.id, date: day }).catch(() => []) as Record<string, unknown>[];
      if (deRows && deRows[0]) {
        await base44.asServiceRole.entities.DailyEarnings.update(String(deRows[0].id), {
          survey_gross: (Number(deRows[0].survey_gross) || 0) + gross,
          total_earned: (Number(deRows[0].total_earned) || 0) + rw.realizedUsd,
          total_surveys_completed: (Number(deRows[0].total_surveys_completed) || 0) + 1,
        }).catch(() => null);
      } else {
        await base44.asServiceRole.entities.DailyEarnings.create({ user_id: user.id, date: day, survey_gross: gross, total_earned: rw.realizedUsd, total_surveys_completed: 1 }).catch(() => null);
      }

      // Referral rewards (single-level, platform-funded).
      await payReferralSignupBonusOnce(base44, user.id).catch(() => null);
      if (creditedPoints > 0) await creditReferralOverrideOnEarn(base44, user.id, creditedPoints).catch(() => null);
    }

    // 5) Advance the daily session.
    const sessRows = await db.filter("AdGridSession", { user_id: user.id, day }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    let done = 0, grossUsd = 0;
    if (sessRows && sessRows[0]) {
      done = (Number(sessRows[0].thumbnails_done) || 0) + (already ? 0 : 1);
      grossUsd = Math.round(((Number(sessRows[0].gross_usd) || 0) + (already ? 0 : adgridThumbnailPrice())) * 100) / 100;
      await db.update("AdGridSession", String(sessRows[0].id), { thumbnails_done: done, gross_usd: grossUsd, updated_at: new Date().toISOString() }).catch(() => null);
    } else {
      done = already ? 0 : 1; grossUsd = already ? 0 : adgridThumbnailPrice();
      await base44.asServiceRole.entities.AdGridSession.create({ user_id: user.id, day, thumbnails_done: done, gross_usd: grossUsd, created_at: new Date().toISOString() }).catch(() => null);
    }

    const target = sessionGrossTarget();
    return Response.json({
      success: true,
      already,
      credited_points: creditedPoints,
      interested,
      product_page: { product_name: ad.product_name, image_url: ad.image_url || null, product_url: ad.product_url || null, description: (ad.product_page as any)?.description || "" },
      session: { thumbnails_done: done, gross_usd: grossUsd, goal_usd: target, complete: grossUsd >= target },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

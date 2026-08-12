import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { qualifiedReferrals } from "../../sdk/earned-advertiser.ts";
import { upgradeDiscountState, upgradeQuote, signupCreditState, foundingCreditDisclosures } from "../../sdk/founding-rollover.ts";

// foundingRolloverStatus (read-only) — the caller's founding-advertiser credit picture:
//   • the founding UPGRADE DISCOUNT (a % off the upgrade, decoupled from what they paid) and its window,
//   • a QUOTE for the upgrade with the discount applied (net price), and
//   • the conditional $1,000 SIGN-UP credit vesting (feedback + 1 referral + active months).
// Never moves money. All credit is non-cashable Site Cash; nothing is ever owed.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const uid = String(user.id);
    const todayISO = new Date().toISOString();

    const recRows = await db.filter("FoundingAdvertiser", { user_id: uid }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const rec = recRows && recRows[0] ? recRows[0] : null;
    const purchasedISO = String((rec?.purchased_at ?? rec?.credit_start ?? rec?.created_date ?? todayISO));

    // Sign-up conditions: qualified referrals, feedback given, distinct active months.
    const referrals = (await qualifiedReferrals(db, uid).catch(() => [])).length;

    let feedbackGiven = false;
    for (const entity of ["FeedbackSurveyResponse", "PricingFeedback"]) {
      try {
        const rows = await db.filter(entity, { user_id: uid }, "-created_date", 1);
        if (rows && rows.length) { feedbackGiven = true; break; }
      } catch { /* try next */ }
    }

    // Distinct active months from the member's DailyEarnings (months with any surveys/earnings).
    let monthsActive = 0;
    try {
      const de = await db.filter("DailyEarnings", { user_id: uid }, "-created_date", 4000) as Record<string, unknown>[];
      const months = new Set<string>();
      for (const r of de || []) {
        const active = (Number(r.total_surveys_completed) || 0) > 0 || (Number(r.total_earned) || 0) > 0;
        if (!active) continue;
        const d = String(r.created_date ?? r.date ?? "");
        if (d.length >= 7) months.add(d.slice(0, 7));
      }
      monthsActive = months.size;
    } catch { monthsActive = 0; }

    const discount = upgradeDiscountState(purchasedISO, todayISO);
    const quote = upgradeQuote(discount);
    const signup = signupCreditState({ startISO: purchasedISO, todayISO, monthsActive, feedbackGiven, referralsQualified: referrals });

    return Response.json({
      has_founding_seat: !!rec,
      upgrade_discount: discount,
      upgrade_quote: quote,
      signup_credit: signup,
      disclosures: foundingCreditDisclosures(),
      note: "All figures are store credit (non-cashable Site Cash) or quotes. The upgrade discount is a promo % off the upgrade, decoupled from the amount paid. No charge is made here and nothing is ever owed.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

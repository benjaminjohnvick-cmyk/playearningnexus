import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { ensureBusinessAccount } from "../../sdk/business-accounts.ts";
import { recordRevenue, businessSignupFeeUsd, businessOnboardingFeeUsd } from "../../sdk/revenue.ts";
import { db } from "../../sdk/db.ts";

// businessSignup (A6) — a business/seller/advertiser joins. Records the one-time sign-up (+ optional
// onboarding) fee as platform revenue and activates the account. This is a BUSINESS charge — never a
// customer markup. Actual card collection is handled by the processor once card_charging is live; this
// books the revenue event and marks the account.
//   Body: { name }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const name = String(body.name || user.full_name || "Business").slice(0, 120);

    const acct = await ensureBusinessAccount(user.id, name);
    const signup = businessSignupFeeUsd();
    const onboarding = businessOnboardingFeeUsd();

    if (signup > 0) await recordRevenue({ type: "business_signup", amount_usd: signup, business_id: acct.id, user_id: user.id, ref: "signup" });
    if (onboarding > 0) await recordRevenue({ type: "business_onboarding", amount_usd: onboarding, business_id: acct.id, user_id: user.id, ref: "onboarding" });

    await db.update("BusinessAccount", acct.id, {
      name, status: "active", signup_paid: signup >= 0, onboarding_paid: onboarding >= 0,
    }).catch(() => null);

    return Response.json({
      success: true,
      business_id: acct.id,
      fees: { signup_usd: signup, onboarding_usd: onboarding, total_usd: Math.round((signup + onboarding) * 100) / 100 },
      note: "Fees are booked as revenue; card collection runs through the processor once card charging is live.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

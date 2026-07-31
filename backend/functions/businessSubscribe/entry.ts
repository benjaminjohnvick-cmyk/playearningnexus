import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { getBusinessAccount, ensureBusinessAccount } from "../../sdk/business-accounts.ts";
import { recordRevenue, saasTierPriceUsd } from "../../sdk/revenue.ts";
import { db } from "../../sdk/db.ts";

// businessSubscribe (A7) — a business subscribes to a monthly B2B SaaS tier (basic/pro/enterprise) for
// analytics, priority placement, more survey slots, audience access. Recurring business revenue that
// replaces the customer markup. Records the first month's revenue and sets the tier.
//   Body: { tier: "basic"|"pro"|"enterprise", name? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const tier = ["basic", "pro", "enterprise"].includes(String(body.tier)) ? String(body.tier) : "basic";
    const price = saasTierPriceUsd(tier);

    const acct = await getBusinessAccount(user.id) || await ensureBusinessAccount(user.id, String(body.name || user.full_name || "Business"));

    if (price > 0) await recordRevenue({ type: "business_subscription", amount_usd: price, business_id: acct.id, user_id: user.id, ref: `saas_${tier}`, meta: { tier, period: "monthly" } });

    await db.update("BusinessAccount", acct.id, {
      status: "active", subscription_tier: tier, subscription_active: true,
      subscription_started_at: new Date().toISOString(),
    }).catch(() => null);

    // A lightweight recurring record so a monthly job can re-bill (billing job wired when processor is live).
    await db.create("BusinessSubscription", {
      owner_user_id: user.id, business_id: acct.id, tier, price_usd: price,
      status: "active", started_at: new Date().toISOString(), next_bill_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    }, user.id).catch(() => null);

    return Response.json({ success: true, business_id: acct.id, tier, monthly_usd: price });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

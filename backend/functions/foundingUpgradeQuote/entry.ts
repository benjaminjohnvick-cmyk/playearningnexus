import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { upgradeDiscountState, upgradeQuote } from "../../sdk/founding-rollover.ts";

// foundingUpgradeQuote (read-only) — a QUOTE for the upgrade with the founding-advertiser DISCOUNT applied
// (a % off the upgrade price, decoupled from what the advertiser paid). Returns the upgrade name, list
// price, discount, and NET price. NEVER a charge — actual payment for a $200,000 upgrade must go through the
// payment processor under its own flow; this only prices it.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const uid = String(user.id);
    const todayISO = new Date().toISOString();

    const recRows = await db.filter("FoundingAdvertiser", { user_id: uid }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const rec = recRows && recRows[0] ? recRows[0] : null;
    const eligibleSinceISO = String((rec?.purchased_at ?? rec?.credit_start ?? rec?.created_date ?? todayISO));

    const discount = upgradeDiscountState(eligibleSinceISO, todayISO);
    const quote = upgradeQuote(discount);
    return Response.json({ upgrade_discount: discount, upgrade_quote: quote });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

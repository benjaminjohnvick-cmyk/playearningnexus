import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { premiumBoostConfig, poolAvailableUsd } from "../../sdk/premium-boost.ts";

// premiumBoostFund (INTERNAL/ADMIN) — record an advertiser's contribution to the member-boost pool. Call this
// when a PPC / Tier 1 advertiser payment is recorded: it adds one funded contribution (default
// PREMIUM_BOOST_PER_ADVERTISER_USD, i.e. $2,000 — 1:1 advertiser→member) that premium members can later
// claim. This never moves a member's money; it just records how much advertiser funding is available to gift.
//   Body: { advertiser_id, amount_paid_usd?, amount_usd? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    // Admin-only when a human calls it; scheduled/service callers pass through (they run with a service token).
    const isAdmin = Boolean(caller && ((caller as Record<string, unknown>).role === "admin" || (caller as Record<string, unknown>).is_admin));
    const body = await req.json().catch(() => ({}));
    if (caller && !isAdmin && body.scheduled !== true) return Response.json({ error: "Admin only." }, { status: 403 });

    const cfg = await premiumBoostConfig(null);
    if (!cfg.enabled) return Response.json({ error: "Premium boost is not available." }, { status: 400 });

    const advertiserId = String(body.advertiser_id || "").slice(0, 200);
    if (!advertiserId) return Response.json({ error: "advertiser_id is required." }, { status: 400 });
    // Amount funded = the configured per-advertiser contribution, capped by what they actually paid (if given).
    const paid = body.amount_paid_usd != null ? Math.max(0, Number(body.amount_paid_usd)) : Infinity;
    const amount = Math.round((Math.min(cfg.perAdvertiserUsd, body.amount_usd != null ? Number(body.amount_usd) : cfg.perAdvertiserUsd, paid)) * 100) / 100;
    if (amount <= 0) return Response.json({ error: "Nothing to fund." }, { status: 400 });

    const row = await db.create("PremiumBoostFunding", {
      advertiser_id: advertiserId, amount_usd: amount, remaining_usd: amount,
      source: "advertiser_fee", created_at: new Date().toISOString(),
    });
    return Response.json({ success: true, funding_id: (row as Record<string, unknown>)?.id ?? null, funded_usd: amount, pool_available_usd: await poolAvailableUsd() });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

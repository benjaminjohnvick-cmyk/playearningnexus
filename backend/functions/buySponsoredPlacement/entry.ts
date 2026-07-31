import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { getBusinessAccount, ensureBusinessAccount } from "../../sdk/business-accounts.ts";
import { recordRevenue, sponsoredPlacementPriceUsd } from "../../sdk/revenue.ts";
import { db } from "../../sdk/db.ts";

// buySponsoredPlacement (A3 / B13) — a business pays to FEATURE/boost a listing (or run an ad slot) for a
// period. Customer prices are unchanged; the business pays for visibility. Creates a SponsoredPlacement the
// store reads to boost sort order, and books the revenue.
//   Body: { listing_id?, slot?, days? }  (listing_id to boost a listing, or slot for an ad unit)
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const days = Math.max(1, Math.min(365, Math.round(Number(body.days) || 30)));
    const price = sponsoredPlacementPriceUsd() * (days / 30);
    if (price <= 0) return Response.json({ error: "Sponsored placement isn't priced yet (set SPONSORED_PLACEMENT_PRICE_USD)." }, { status: 400 });

    const acct = await getBusinessAccount(user.id) || await ensureBusinessAccount(user.id, String(body.name || user.full_name || "Business"));
    const until = new Date(Date.now() + days * 86400000).toISOString();

    const placement = await db.create("SponsoredPlacement", {
      owner_user_id: user.id, business_id: acct.id,
      listing_id: body.listing_id ? String(body.listing_id) : null,
      slot: body.slot ? String(body.slot) : "catalog_featured",
      price_usd: Math.round(price * 100) / 100,
      status: "active", starts_at: new Date().toISOString(), ends_at: until,
    }, user.id).catch(() => null);

    await recordRevenue({
      type: body.slot ? "advertising" : "sponsored_placement",
      amount_usd: price, business_id: acct.id, user_id: user.id,
      ref: (placement as Record<string, unknown>)?.id as string ?? null,
      meta: { listing_id: body.listing_id ?? null, slot: body.slot ?? "catalog_featured", days },
    });

    return Response.json({ success: true, placement_id: (placement as Record<string, unknown>)?.id ?? null, price_usd: Math.round(price * 100) / 100, ends_at: until });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

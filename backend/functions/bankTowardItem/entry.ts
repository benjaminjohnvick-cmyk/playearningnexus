import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";

// bankTowardItem (authenticated) — the user marks an item as a savings goal ("bank toward this").
// Progress is tracked live against their Site Cash balance (see savingsGoalStatus); when their earned
// Site Cash covers the price, they're notified and can redeem — the item ships fully covered. No cash
// leaves the platform; "banking" just sets the target the balance is measured against.
//   Body: { listing_id?, price_usd, title?, image_url? }  → { success, goal_id }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    let priceUsd = Number(body.price_usd) || 0;
    let title = String(body.title || "");
    let imageUrl = String(body.image_url || "");
    const listingId = body.listing_id ? String(body.listing_id) : null;

    if (listingId && (!priceUsd || !title)) {
      const l = await base44.asServiceRole.entities.MarketplaceListing.filter({ id: listingId }).then((r: any) => r[0]);
      if (l) {
        priceUsd = priceUsd || Number(l.price_usd) || 0;
        title = title || String(l.title || "Item");
        imageUrl = imageUrl || String(l.image_url || (Array.isArray(l.images) ? l.images[0] : "") || "");
      }
    }
    if (priceUsd <= 0) return Response.json({ error: "A priced item is required to bank toward." }, { status: 400 });

    // One active goal per (user, listing). Reactivate/update if it exists.
    const existing = listingId
      ? await db.filter("ItemSavingsGoal", { created_by: user.id, listing_id: listingId }, "-created_date", 1).catch(() => []) as Record<string, unknown>[]
      : [];
    if (existing && existing[0]) {
      await db.update("ItemSavingsGoal", existing[0].id as string, { status: "active", price_usd: priceUsd, title, image_url: imageUrl, notified_covered: false }).catch(() => null);
      return Response.json({ success: true, already: true, goal_id: existing[0].id, message: `Banking toward ${title || "your item"}.` });
    }

    const goal = await base44.asServiceRole.entities.ItemSavingsGoal.create({
      created_by: user.id,
      user_id: user.id,
      listing_id: listingId,
      title: title.slice(0, 200) || "Item",
      image_url: imageUrl.slice(0, 1000),
      price_usd: Math.round(priceUsd * 100) / 100,
      status: "active",
      notified_covered: false,
    });

    return Response.json({ success: true, goal_id: goal.id, message: `Banking toward ${title || "your item"}. We'll tell you the moment it's covered.` });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

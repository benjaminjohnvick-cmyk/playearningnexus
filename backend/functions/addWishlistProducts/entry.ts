import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";

// addWishlistProducts (authenticated) — from the profile/KYC step: the user names products they want; each is
// added to their wishlist (source "profile" → shows under "You added"). De-duped by name. Up to 20.
//   Body: { products: [{ name, image_url?, product_url? }] }  → { added }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const items = (Array.isArray(body.products) ? body.products : []).slice(0, 20);
    if (!items.length) return Response.json({ error: "No products given" }, { status: 400 });

    const existing = await db.filter("ProductWishlistItem", { user_id: user.id }, "-created_date", 1000).catch(() => []) as Record<string, unknown>[];
    const seen = new Set((existing || []).map((w) => String(w.product_name || "").toLowerCase().trim()));

    let added = 0;
    for (const it of items) {
      const name = String(it?.name || "").trim().slice(0, 200);
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      await base44.asServiceRole.entities.ProductWishlistItem.create({
        user_id: user.id, product_name: name, image_url: String(it?.image_url || "").slice(0, 1000) || null,
        product_url: String(it?.product_url || "").slice(0, 1000) || null, source: "profile", added_at: new Date().toISOString(),
      }).catch(() => null);
      added++;
    }
    return Response.json({ success: true, added });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

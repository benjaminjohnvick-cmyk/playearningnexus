import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";

// wishlistGet (authenticated) — the user's wishlist, split into what THEY added vs what the AI picked.
//   Body: {}  → { mine: [...], ai: [...] }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await db.filter("ProductWishlistItem", { user_id: user.id }, "-created_date", 1000).catch(() => []) as Record<string, unknown>[];
    const map = (w: Record<string, unknown>) => ({
      id: w.id, product_name: w.product_name, image_url: w.image_url || null, product_url: w.product_url || null,
      source: w.source || "user", added_at: w.added_at || w.created_date,
    });
    const all = (rows || []).map(map);
    const ai = all.filter((w) => w.source === "ai");
    const mine = all.filter((w) => w.source !== "ai");

    return Response.json({ mine, ai, counts: { mine: mine.length, ai: ai.length } });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

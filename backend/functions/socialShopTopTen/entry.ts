import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { getNumber } from "../../sdk/settings.ts";
import { rankTopSellers, type OrderLike } from "../../sdk/social-shop.ts";

// socialShopTopTen — the AI Social Shop's auto storefront: the current top-selling items over a rolling window,
// no manual curation. Reads recent orders and ranks them (units, then revenue). Returned as the default shop
// view in Buddy Chat, and used by the auto-feature job that promotes top sellers to the Omni-Channel Livestream
// and consented social posts. Read-only; authenticated.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(50, Number(body?.limit) || (await getNumber("SOCIAL_SHOP_TOP_N", 10))));
    const windowDays = Math.max(1, Number(body?.window_days) || (await getNumber("SOCIAL_SHOP_TOP_WINDOW_DAYS", 7)));
    const sinceISO = new Date(Date.now() - windowDays * 24 * 3600_000).toISOString();

    // Recent sales. Bounded read; scan the window and rank in memory (top-N is small).
    const orders = await db.filter("Order", { created_date: { $gte: sinceISO } }, "-created_date", 5000).catch(() => []) as OrderLike[];
    const top = rankTopSellers(orders, limit);

    return Response.json({
      ok: true, window_days: windowDays, count: top.length, top_sellers: top,
      note: top.length ? `Top ${top.length} sellers over the last ${windowDays} day(s).` : "No sales in the window yet.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});

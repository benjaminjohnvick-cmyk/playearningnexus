import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { findProduct } from "../../sdk/ai-funnel.ts";

// aiFunnelCommit — the customer picked a product; start its commitment window. Upserts the active journey.
// This records intent + starts the clock; it does NOT charge (payment runs through the normal purchase flow).
//   Body: { product_key: string }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const jurisdiction = (user as Record<string, unknown>).jurisdiction as string | null ?? null;
    if (!(await isEnabled("ai_funnel", jurisdiction))) {
      return Response.json({ error: "The concierge is not available.", code: "funnel_off" }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const product = findProduct(body.product_key ? String(body.product_key) : null);
    if (!product) return Response.json({ error: "Unknown product." }, { status: 400 });

    const nowISO = new Date().toISOString();
    const existing = await db.filter("FunnelJourney", { user_id: user.id, kind: "active" }, "-created_date", 1).catch(() => []);
    const doc = {
      user_id: user.id, kind: "active", current_key: product.key, product_name: product.name,
      window_days: product.window_days, window_start: nowISO, metric: product.metric,
      upsell_attempts: 0, committed_at: nowISO,
    };
    let row;
    if (existing && existing[0]) row = await db.update("FunnelJourney", String((existing[0] as Record<string, unknown>).id), doc);
    else row = await db.create("FunnelJourney", doc, user.id);

    return Response.json({ success: true, journey: row, note: `Commitment window started (${product.window_days} days). Payment, if any, runs through the normal purchase flow.` });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

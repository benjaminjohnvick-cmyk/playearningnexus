import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";

// wishlistAISuggest (authenticated) — AI keeps the wishlist growing: from the user's profile + what they've
// already wished for, suggest more products and add them (source "ai" → shows under "Picked for you"). Cheap
// model tier; de-duped. Can be called on demand or by a scheduled job.
//   Body: { count? }  → { added, suggestions }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const count = Math.max(1, Math.min(12, Number(body.count) || 6));

    // Context: their profile answers + existing wishlist names.
    const profRows = await db.filter("SurveyProfile", { user_id: user.id }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const answers = (profRows?.[0]?.answers || {}) as Record<string, string>;
    const existing = await db.filter("ProductWishlistItem", { user_id: user.id }, "-created_date", 1000).catch(() => []) as Record<string, unknown>[];
    const have = (existing || []).map((w) => String(w.product_name || ""));
    const haveLc = new Set(have.map((n) => n.toLowerCase().trim()));

    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: "gpt_5_mini",
      prompt: `Suggest ${count} specific consumer products this shopper would likely want, as gift/shopping ideas.
Shopper profile (demographics): ${JSON.stringify(answers)}
Already on their wishlist (avoid duplicates): ${JSON.stringify(have.slice(0, 40))}
Return ONLY JSON {"products":[{"name":"..."}]} with short, real product names. No commentary.`,
      response_json_schema: { type: "object", properties: { products: { type: "array", items: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } } }, required: ["products"] },
    }).catch(() => null);

    const suggestions: string[] = Array.isArray(res?.products) ? res.products.map((p: Record<string, unknown>) => String(p?.name || "").trim()).filter(Boolean) : [];

    let added = 0;
    for (const name of suggestions) {
      const clean = name.slice(0, 200);
      if (!clean || haveLc.has(clean.toLowerCase())) continue;
      haveLc.add(clean.toLowerCase());
      await base44.asServiceRole.entities.ProductWishlistItem.create({
        user_id: user.id, product_name: clean, source: "ai", added_at: new Date().toISOString(),
      }).catch(() => null);
      added++;
    }
    return Response.json({ success: true, added, suggestions });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

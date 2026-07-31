import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";

// giftCardStockAdd (INTERNAL/ADMIN) — add gift-card inventory (bought in bulk, often at a discount = margin).
// Accepts one card or a batch.
//   Body: { retailer, face_value_usd, code, pin?, cost_usd? }  OR  { cards: [ {retailer, face_value_usd, code, ...} ] }
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const cards = Array.isArray(body.cards) ? body.cards : [body];
    let added = 0;
    for (const c of cards) {
      const retailer = String(c.retailer || "").trim();
      const face = Number(c.face_value_usd) || 0;
      if (!retailer || face <= 0 || !c.code) continue;
      await base44.asServiceRole.entities.GiftCardStock.create({
        retailer, face_value_usd: face, code: String(c.code), pin: c.pin ? String(c.pin) : null,
        cost_usd: Number(c.cost_usd) || null, status: "available", created_at: new Date().toISOString(),
      }).catch(() => null);
      added++;
    }
    return Response.json({ success: true, added });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

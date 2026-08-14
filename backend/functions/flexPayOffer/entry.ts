import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { flexPayConfig, assessFlexPayOffer } from "../../sdk/flexpay.ts";
import { findProduct } from "../../sdk/ai-funnel.ts";

// flexPayOffer (read-only) — the LAST-RESORT flexible-payment offer for a product. Returns the installment
// plan + disclosures ONLY when the program is live (flag + licensed provider + counsel sign-off), the
// customer has declined the other options (last_resort), and ability-to-repay is confirmed. Otherwise it
// returns available:false with a reason. Never originates or charges.
//   Body: { product_key: string, last_resort?: boolean, ability_to_repay?: boolean }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const jurisdiction = (user as Record<string, unknown>).jurisdiction as string | null ?? null;
    const body = await req.json().catch(() => ({}));
    const product = findProduct(body.product_key ? String(body.product_key) : null);
    if (!product) return Response.json({ error: "Unknown product." }, { status: 400 });

    const cfg = await flexPayConfig(jurisdiction);
    const offer = assessFlexPayOffer(cfg, product.price_usd, {
      lastResort: body.last_resort === true,
      abilityToRepay: body.ability_to_repay === true,
    });
    return Response.json({ product: { key: product.key, name: product.name, price_usd: product.price_usd }, offer });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

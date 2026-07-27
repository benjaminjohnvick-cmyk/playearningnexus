import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// ingestPricingFeedback (authenticated user) — records a user's answers to an AI-generated pricing
// survey into PricingFeedback, the dataset aiPricingOptimizer reads. Accepts the raw responses and
// derives a representative acceptable price_point (Van Westendorp "cheap"/"expensive" midpoint, or a
// Gabor-Granger accepted price) so the optimizer can track willingness-to-pay over time.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { survey_id, target, responses } = body;
    const r = (responses ?? {}) as Record<string, unknown>;
    const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

    // Representative acceptable price: midpoint of "cheap"/"expensive" if present, else any numeric.
    const cheap = num(r.cheap);
    const expensive = num(r.expensive);
    let pricePoint: number | null = null;
    if (cheap != null && expensive != null) pricePoint = Math.round(((cheap + expensive) / 2) * 100) / 100;
    else pricePoint = cheap ?? expensive ?? num(r.too_expensive) ?? num(r.too_cheap);

    const willBuy = typeof r.would_buy === "boolean" ? r.would_buy : (String(r.would_buy).toLowerCase() === "yes" || r.would_buy === true);

    await base44.asServiceRole.entities.PricingFeedback.create({
      user_id: user.id,
      survey_id: survey_id ?? null,
      target: target ?? null,
      responses: r,
      price_point: pricePoint,
      would_buy: !!willBuy,
      collected_at: new Date().toISOString(),
    });

    return Response.json({ success: true, price_point: pricePoint });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Daily: AI-powered dynamic pricing adjustments for Products
export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const pricingRules = await base44.asServiceRole.entities.DynamicPricing.filter({ is_active: true });
    let updated = 0;

    for (const rule of pricingRules) {
      if (!rule.product_id) continue;

      const products = await base44.asServiceRole.entities.Product.filter({ id: rule.product_id });
      if (products.length === 0) continue;
      const product = products[0];

      const aiPrice = await base44.integrations.Core.InvokeLLM({
        prompt: `Calculate optimal dynamic price for a gaming platform product:
Product: "${product.name}"
Current price: $${product.price}
Base price: $${rule.base_price || product.price}
Min price: $${rule.min_price || product.price * 0.7}
Max price: $${rule.max_price || product.price * 1.5}
Demand score (0-100): ${rule.demand_score || 50}
Stock: ${product.stock_count || 'unlimited'}
Days since last sale: ${rule.days_since_last_sale || 0}
Competitor avg price: $${rule.competitor_avg_price || product.price}

Return: recommended_price (number), reasoning (one sentence), should_run_sale (boolean)`,
        response_json_schema: {
          type: 'object',
          properties: {
            recommended_price: { type: 'number' },
            reasoning: { type: 'string' },
            should_run_sale: { type: 'boolean' }
          }
        }
      });

      const newPrice = Math.max(rule.min_price || 0, Math.min(rule.max_price || 9999, aiPrice.recommended_price));
      const oldPrice = product.price;

      if (Math.abs(newPrice - oldPrice) > 0.01) {
        await base44.asServiceRole.entities.Product.update(product.id, {
          price: parseFloat(newPrice.toFixed(2)),
          previous_price: oldPrice,
          on_sale: aiPrice.should_run_sale
        });

        await base44.asServiceRole.entities.DynamicPricing.update(rule.id, {
          last_adjusted_at: new Date().toISOString(),
          last_reasoning: aiPrice.reasoning,
          previous_price: oldPrice,
          current_price: newPrice
        });

        updated++;
      }
    }

    return Response.json({ ok: true, products_updated: updated });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
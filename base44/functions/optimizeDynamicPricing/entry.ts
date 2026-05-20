import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch products with sales velocity data
    const products = await base44.entities.RevenueProduct.filter({
      is_active: true
    }, '-total_sold', 100);

    let priceChanges = 0;
    const recommendations = [];

    for (const product of products) {
      try {
        // Get recent sales data (past 30 days would be ideal, using total as proxy)
        const daysSinceCreated = Math.max(1, Math.floor(
          (new Date() - new Date(product.created_date)) / (1000 * 60 * 60 * 24)
        ));
        const salesVelocity = product.total_sold / daysSinceCreated;

        // Use AI to recommend optimal price
        const priceRecommendation = await base44.integrations.Core.InvokeLLM({
          prompt: `Analyze pricing for this digital product and recommend optimal price point.

Product: ${product.name}
Category: ${product.category}
Current Price: $${product.price_usd}
Units Sold: ${product.total_sold}
Sales Velocity: ${salesVelocity.toFixed(2)} units/day
Days Active: ${daysSinceCreated}

Return JSON with recommended_price, reasoning, and confidence (0-100). Consider:
- High velocity (>2/day): may support price increase
- Low velocity (<0.5/day): consider discount or repositioning
- Standard velocity: minor optimizations only`,
          response_json_schema: {
            type: 'object',
            properties: {
              recommended_price: { type: 'number' },
              price_change_percent: { type: 'number' },
              reasoning: { type: 'string' },
              confidence: { type: 'number' }
            },
            required: ['recommended_price', 'reasoning', 'confidence']
          }
        });

        const priceChange = Math.abs(priceRecommendation.recommended_price - product.price_usd);
        const shouldUpdate = priceRecommendation.confidence >= 75 && priceChange >= 0.50;

        if (shouldUpdate) {
          await base44.entities.RevenueProduct.update(product.id, {
            price_usd: priceRecommendation.recommended_price
          });
          priceChanges++;
        }

        recommendations.push({
          product_id: product.id,
          product_name: product.name,
          current_price: product.price_usd,
          recommended_price: priceRecommendation.recommended_price,
          change_percent: priceRecommendation.price_change_percent,
          confidence: priceRecommendation.confidence,
          reasoning: priceRecommendation.reasoning,
          applied: shouldUpdate,
          awaiting_review: !shouldUpdate && priceRecommendation.confidence >= 70
        });
      } catch (error) {
        console.error(`Price optimization failed for ${product.name}:`, error);
      }
    }

    return Response.json({
      price_changes_applied: priceChanges,
      total_analyzed: products.length,
      awaiting_human_review: recommendations.filter(r => r.awaiting_review).length,
      recommendations: recommendations
    });
  } catch (error) {
    console.error('Dynamic pricing error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

/**
 * AI Pricing Engine
 * Searches for a product across multiple major retailers,
 * scores each listing, and returns a ranked recommendation
 * with a "Best Price" vendor for automated fulfillment.
 */
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { product_name, image_url } = await req.json();

    if (!product_name && !image_url) {
      return Response.json({ error: 'product_name or image_url required' }, { status: 400 });
    }

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are an AI pricing engine. Search across ALL major retailers to find the absolute best price for this product.

Product: "${product_name || 'product shown in image'}"

Search these retailers: Amazon, Walmart, Target, Best Buy, eBay, Newegg, B&H Photo, Costco, GameStop, Sam's Club, Micro Center, Office Depot, Home Depot, Overstock, Rakuten, and any other relevant stores.

For each retailer listing found, return:
- vendor: retailer name
- url: direct product URL
- price: numeric price (no currency symbol; 0 if unknown)
- original_price: original/MSRP price if there's a sale (0 if no sale)
- discount_percentage: % off if on sale (0 if none)
- in_stock: boolean
- shipping_cost: numeric shipping cost (0 = free)
- shipping_days: estimated days to ship
- total_landed_cost: price + shipping_cost
- fulfillment_score: 0–100 score weighing price, reliability, speed, and stock (higher = better)
- is_major_retailer: boolean
- fulfillment_ease: "easy" | "medium" | "hard" (how automatable is checkout)
- notes: any deal notes (e.g. "Lightning deal", "Member price")

Also return:
- best_price_vendor: the vendor with the lowest total_landed_cost that is in stock
- best_price_amount: that vendor's price
- best_fulfillment_vendor: the vendor with the highest fulfillment_score (best combo of price + reliability + speed)
- price_range_low: lowest price found
- price_range_high: highest price found
- average_price: average price across listings
- ai_recommendation: 1-2 sentence recommendation on which vendor to buy from and why
- confidence: 0.0–1.0 confidence in accuracy of results

Return AT LEAST 5 retailer listings sorted by total_landed_cost ascending.`,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      file_urls: image_url ? [image_url] : undefined,
      response_json_schema: {
        type: 'object',
        properties: {
          listings: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                vendor:               { type: 'string' },
                url:                  { type: 'string' },
                price:                { type: 'number' },
                original_price:       { type: 'number' },
                discount_percentage:  { type: 'number' },
                in_stock:             { type: 'boolean' },
                shipping_cost:        { type: 'number' },
                shipping_days:        { type: 'number' },
                total_landed_cost:    { type: 'number' },
                fulfillment_score:    { type: 'number' },
                is_major_retailer:    { type: 'boolean' },
                fulfillment_ease:     { type: 'string' },
                notes:                { type: 'string' }
              }
            }
          },
          best_price_vendor:       { type: 'string' },
          best_price_amount:       { type: 'number' },
          best_fulfillment_vendor: { type: 'string' },
          price_range_low:         { type: 'number' },
          price_range_high:        { type: 'number' },
          average_price:           { type: 'number' },
          ai_recommendation:       { type: 'string' },
          confidence:              { type: 'number' }
        }
      }
    });

    // Sort listings by total_landed_cost
    if (result?.listings) {
      result.listings.sort((a, b) => (a.total_landed_cost || a.price || 0) - (b.total_landed_cost || b.price || 0));
    }

    return Response.json({ success: true, ...result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
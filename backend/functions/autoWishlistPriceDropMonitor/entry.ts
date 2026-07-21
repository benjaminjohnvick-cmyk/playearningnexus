import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Hourly: monitor ProductWishlistItems for price drops and alert users
export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const items = await base44.asServiceRole.entities.ProductWishlistItem.list('-updated_date', 200);
    const results = [];

    for (const item of items) {
      if (!item.product_id || !item.user_id) continue;

      const products = await base44.asServiceRole.entities.Product.filter({ id: item.product_id });
      if (products.length === 0) continue;
      const product = products[0];
      const currentPrice = product.price || 0;
      const trackedPrice = item.price_when_added || currentPrice;

      if (currentPrice < trackedPrice && currentPrice > 0) {
        const savings = trackedPrice - currentPrice;
        const pctOff = ((savings / trackedPrice) * 100).toFixed(0);

        // Update wishlist item
        await base44.asServiceRole.entities.ProductWishlistItem.update(item.id, {
          current_price: currentPrice,
          price_drop_amount: savings,
          price_drop_alerted: true,
          last_price_check: new Date().toISOString()
        });

        // Notify user
        await base44.asServiceRole.entities.Notification.create({
          user_id: item.user_id,
          type: 'price_drop',
          title: `📉 Price Drop! "${product.name}" is ${pctOff}% off!`,
          message: `"${product.name}" dropped from $${trackedPrice.toFixed(2)} to $${currentPrice.toFixed(2)}. Save $${savings.toFixed(2)}! Grab it now.`,
          is_read: false
        });

        results.push({ item_id: item.id, product_id: item.product_id, savings });
      }

      // Check for low stock alert
      if ((product.stock_count || 0) <= 5 && (product.stock_count || 0) > 0) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: item.user_id,
          type: 'low_stock',
          title: `⚠️ Only ${product.stock_count} Left: "${product.name}"`,
          message: `Your wishlisted item is almost sold out! Grab it before it's gone.`,
          is_read: false
        });
      }
    }

    return Response.json({ ok: true, alerts_sent: results.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
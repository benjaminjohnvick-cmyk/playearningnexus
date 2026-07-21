import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data, old_data } = body;

  try {
    const price = data;
    if (!price?.id || event?.type !== 'update') return Response.json({ ok: true });

    const oldPrice = old_data?.price || 0;
    const newPrice = price.price || 0;

    if (newPrice === oldPrice) return Response.json({ ok: true });

    const isPriceDrop = newPrice < oldPrice;
    const changePercent = oldPrice > 0 ? Math.abs(((newPrice - oldPrice) / oldPrice) * 100).toFixed(1) : 0;

    if (isPriceDrop && changePercent >= 5) {
      // Find all users who have this app in their wishlist
      const wishlistItems = await base44.asServiceRole.entities.ProductWishlistItem.filter({ product_id: price.app_id });
      for (const item of wishlistItems.slice(0, 50)) {
        if (item.user_id) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: item.user_id,
            type: 'app_price_drop',
            title: `📉 Price Drop: ${price.app_name || 'App'} -${changePercent}%!`,
            message: `"${price.app_name || 'An app on your wishlist'}" dropped from $${oldPrice} to $${newPrice} (${changePercent}% off)! Now's a great time to buy.`,
            is_read: false
          });

          // Update wishlist item with new price
          await base44.asServiceRole.entities.ProductWishlistItem.update(item.id, {
            current_price: newPrice,
            last_price_check: new Date().toISOString(),
            price_history: [...(item.price_history || []), { price: oldPrice, date: old_data?.updated_date || new Date().toISOString() }]
          });
        }
      }

      // Also update the AppStorePrice with price drop metadata
      await base44.asServiceRole.entities.AppStorePrice.update(price.id, {
        previous_price: oldPrice,
        price_drop_percent: parseFloat(changePercent),
        last_drop_date: new Date().toISOString()
      });
    }

    return Response.json({ ok: true, price_drop: isPriceDrop, change_percent: changePercent });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
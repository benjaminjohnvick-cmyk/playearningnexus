import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's wishlist items
    const wishlistItems = await base44.asServiceRole.entities.ProductWishlistItem.filter({
      user_id: user.id,
      status: 'active'
    });

    const priceDrops = [];

    for (const item of wishlistItems) {
      // Simulate price fetch from vendor (in production, use real API)
      const currentPrice = item.best_price * (0.85 + Math.random() * 0.15);
      const priceDropPercentage = ((item.best_price - currentPrice) / item.best_price) * 100;

      // If price dropped by 5% or more, notify
      if (priceDropPercentage >= 5) {
        priceDrops.push({
          item_id: item.id,
          product_name: item.product_name,
          old_price: item.best_price,
          new_price: currentPrice,
          savings: item.best_price - currentPrice,
          percentage_drop: priceDropPercentage,
        });

        // Update wishlist item with new price
        await base44.asServiceRole.entities.ProductWishlistItem.update(item.id, {
          best_price: currentPrice,
          price_with_markup: currentPrice * 1.1,
        });

        // Send push notification
        try {
          await base44.functions.invoke('sendPushNotification', {
            user_id: user.id,
            title: `💰 Price Drop on "${item.product_name}"`,
            body: `Price dropped ${priceDropPercentage.toFixed(1)}%! Now $${currentPrice.toFixed(2)}. Buy with BNPL & cover with earnings.`,
            tag: `price-drop-${item.id}`,
            url: `/Wishlist?item=${item.id}`,
          });
        } catch (e) {
          console.error('Push notification failed:', e);
        }
      }
    }

    return Response.json({
      monitored: wishlistItems.length,
      price_drops_detected: priceDrops.length,
      drops: priceDrops,
    });
  } catch (error) {
    console.error('Price monitoring error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
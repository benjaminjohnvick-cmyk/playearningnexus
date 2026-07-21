import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

/**
 * Price Alert Checker
 * Runs on schedule — fetches all active wishlist items with price_alert_enabled,
 * runs aiPriceEngine to get current prices, and sends email + notification
 * if price has dropped 5% or more since it was saved.
 */
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all active wishlist items with alerts enabled
    const items = await base44.asServiceRole.entities.ProductWishlistItem.filter({
      price_alert_enabled: true,
      status: 'active'
    });

    console.log(`Price alert check: ${items.length} items to check`);

    const results = { checked: 0, alerts_sent: 0, errors: 0 };

    for (const item of items) {
      try {
        if (!item.product_name) continue;

        // Use existing AI price engine
        const priceData = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are a price checking AI. Find the current lowest price for this product online right now.

Product: "${item.product_name}"
${item.vendor_name ? `Preferred vendor: ${item.vendor_name}` : ''}

Return:
- current_best_price: the lowest price found across major retailers (number)
- retailer: which retailer has this price
- product_url: direct URL to the listing
- in_stock: boolean
- price_drop_from_msrp: percentage drop from typical/MSRP price`,
          add_context_from_internet: true,
          response_json_schema: {
            type: 'object',
            properties: {
              current_best_price: { type: 'number' },
              retailer: { type: 'string' },
              product_url: { type: 'string' },
              in_stock: { type: 'boolean' },
              price_drop_from_msrp: { type: 'number' }
            }
          }
        });

        results.checked++;

        const savedPrice = item.best_price || item.price_with_markup;
        if (!savedPrice || !priceData?.current_best_price) continue;

        const currentPrice = priceData.current_best_price;
        const dropPercent = ((savedPrice - currentPrice) / savedPrice) * 100;

        console.log(`${item.product_name}: saved=$${savedPrice}, current=$${currentPrice}, drop=${dropPercent.toFixed(1)}%`);

        if (dropPercent >= 5) {
          // Update wishlist item with new price
          await base44.asServiceRole.entities.ProductWishlistItem.update(item.id, {
            best_price: currentPrice,
            last_price_check: new Date().toISOString(),
            price_drop_detected: true,
            price_drop_percentage: Math.round(dropPercent)
          });

          // Create notification
          await base44.asServiceRole.entities.Notification.create({
            user_id: item.user_id,
            type: 'price_drop',
            title: `🔥 Price Drop! ${Math.round(dropPercent)}% off`,
            message: `${item.product_name} dropped from $${savedPrice.toFixed(2)} to $${currentPrice.toFixed(2)} at ${priceData.retailer}!`,
            is_read: false,
            action_url: priceData.product_url || item.vendor_url
          }).catch(() => {});

          // Send email alert
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: item.user_id,
            subject: `💰 Price Drop Alert: ${item.product_name} is ${Math.round(dropPercent)}% off!`,
            body: `Great news! An item on your GamerGain wishlist just dropped in price.\n\n` +
              `<strong>${item.product_name}</strong>\n\n` +
              `<strong>Was:</strong> $${savedPrice.toFixed(2)}\n` +
              `<strong>Now:</strong> $${currentPrice.toFixed(2)} at ${priceData.retailer}\n` +
              `<strong>You save:</strong> $${(savedPrice - currentPrice).toFixed(2)} (${Math.round(dropPercent)}% off)\n\n` +
              (priceData.product_url ? `<a href="${priceData.product_url}">View Deal →</a>\n\n` : '') +
              `<a href="/Wishlist">Go to My Wishlist</a> to order this item through GamerGain.\n\n` +
              `You're receiving this because you enabled price alerts for this item. <a href="/Wishlist">Manage alerts</a>.`
          });

          results.alerts_sent++;
        } else {
          // Update last check time even if no drop
          await base44.asServiceRole.entities.ProductWishlistItem.update(item.id, {
            last_price_check: new Date().toISOString(),
            price_drop_detected: false
          }).catch(() => {});
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));

      } catch (itemErr) {
        console.error(`Error checking ${item.product_name}:`, itemErr.message);
        results.errors++;
      }
    }

    console.log(`Price alert done: ${JSON.stringify(results)}`);
    return Response.json({ success: true, ...results });

  } catch (error) {
    console.error('priceAlertChecker error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
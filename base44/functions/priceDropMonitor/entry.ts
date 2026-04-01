import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { wishlistItemId, currentPrice } = await req.json();

    const item = await base44.entities.ProductWishlistItem.filter({ id: wishlistItemId });
    if (!item || item.length === 0) return Response.json({ error: 'Item not found' }, { status: 404 });

    const wishlistItem = item[0];
    const previousBestPrice = wishlistItem.best_price || wishlistItem.original_search_price || 0;

    if (currentPrice > 0 && currentPrice < previousBestPrice && previousBestPrice > 0) {
      const savings = previousBestPrice - currentPrice;
      const savingsPct = Math.round((savings / previousBestPrice) * 100);

      // Update the item with new best price
      await base44.entities.ProductWishlistItem.update(wishlistItemId, {
        best_price: currentPrice,
        price_with_markup: currentPrice * 1.1,
      });

      // Send email alert
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: user.email,
        subject: `🔥 Price Drop Alert: ${wishlistItem.product_name} is now cheaper!`,
        body: `
Hi ${user.full_name || 'there'},

Great news! A product in your GamerGain wishlist just dropped in price.

🛍️ Product: ${wishlistItem.product_name}
💸 Old Price: $${previousBestPrice.toFixed(2)}
🎉 New Price: $${currentPrice.toFixed(2)}
💰 You Save: $${savings.toFixed(2)} (${savingsPct}% off!)
🛒 Vendor: ${wishlistItem.vendor_name || 'Best available retailer'}

Buy it now before the price goes back up:
${wishlistItem.vendor_url || 'https://gamergain.app/Wishlist'}

Visit your wishlist: https://gamergain.app/Wishlist

Happy saving,
The GamerGain Team
        `.trim(),
      });

      return Response.json({
        price_dropped: true,
        old_price: previousBestPrice,
        new_price: currentPrice,
        savings,
        savings_pct: savingsPct,
      });
    }

    return Response.json({ price_dropped: false });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
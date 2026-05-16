import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Get wishlist
    const wishlist = await base44.asServiceRole.entities.ProductWishlistItem.filter({
      user_id: user.id,
      status: 'active'
    });

    if (wishlist.length === 0) {
      return Response.json({ message: 'Wishlist is empty' });
    }

    // Auto-sort by priority (earned % completion)
    const sorted = wishlist.sort((a, b) => {
      const aProgress = a.amount_earned / (a.price_with_markup || 1);
      const bProgress = b.amount_earned / (b.price_with_markup || 1);
      return bProgress - aProgress; // Higher progress first
    });

    // Update order
    let order = 1;
    for (const item of sorted) {
      await base44.asServiceRole.entities.ProductWishlistItem.update(item.id, {
        display_order: order
      });
      order++;
    }

    // Auto-enable price alerts for items close to purchase (>75% earned)
    const updates = [];
    for (const item of wishlist) {
      const progress = item.amount_earned / (item.price_with_markup || 1);
      if (progress > 0.75 && !item.price_alert_enabled) {
        await base44.asServiceRole.entities.ProductWishlistItem.update(item.id, {
          price_alert_enabled: true,
          price_alert_threshold: item.price_with_markup * 0.95 // Alert at 5% drop
        });
        updates.push(item.id);
      }
    }

    // Auto-add complementary items based on first item category
    if (wishlist.length > 0 && wishlist.length < 5) {
      const firstItem = wishlist[0];
      const relatedProducts = await base44.asServiceRole.entities.Product.filter({
        category: firstItem.category,
        id: { $nin: wishlist.map(w => w.product_id) }
      }, 'popularity', 3);

      for (const product of relatedProducts) {
        try {
          await base44.asServiceRole.entities.ProductWishlistItem.create({
            user_id: user.id,
            product_id: product.id,
            product_name: product.name,
            price_with_markup: product.price,
            status: 'active'
          });
        } catch (e) {
          // Item may already exist
        }
      }
    }

    return Response.json({
      success: true,
      items_reordered: sorted.length,
      price_alerts_enabled: updates.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
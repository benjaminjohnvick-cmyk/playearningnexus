import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const item = data;
    if (!item?.id) return Response.json({ ok: true });

    if (event?.type === 'create') {
      const user = item.user_id ? (await base44.asServiceRole.entities.User.filter({ id: item.user_id }))[0] : null;

      // Confirm item added to wishlist
      if (item.user_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: item.user_id,
          type: 'wishlist_item_added',
          title: '❤️ Added to Wishlist',
          message: `"${item.product_name || item.title}" has been added to your wishlist. We'll alert you when the price drops!`,
          is_read: false
        });
      }

      // AI-generate savings projection
      if (item.target_price && item.current_price && item.user_id) {
        const savings = item.current_price - item.target_price;
        if (savings > 0) {
          // Calculate how many surveys needed to afford it
          const avgSurveyEarning = 0.50;
          const surveysNeeded = Math.ceil((item.target_price || item.current_price) / avgSurveyEarning);
          await base44.asServiceRole.entities.ProductWishlistItem.update(item.id, {
            surveys_needed: surveysNeeded,
            potential_savings: parseFloat(savings.toFixed(2))
          });
        }
      }
    }

    if (event?.type === 'update') {
      // Price dropped to at or below target → alert user immediately
      if (item.current_price && item.target_price && item.current_price <= item.target_price && item.user_id) {
        const user = (await base44.asServiceRole.entities.User.filter({ id: item.user_id }))[0];
        await base44.asServiceRole.entities.Notification.create({
          user_id: item.user_id,
          type: 'wishlist_price_target_hit',
          title: `🎯 Price Target Reached: ${item.product_name}!`,
          message: `"${item.product_name}" is now $${item.current_price} — at or below your $${item.target_price} target! Grab it now!`,
          is_read: false
        });
        if (user?.email) {
          await base44.integrations.Core.SendEmail({
            to: user.email,
            subject: `🎯 Price Alert: "${item.product_name}" hit your target price!`,
            body: `Great news! "${item.product_name}" is now available at $${item.current_price} — which matches your $${item.target_price} target price. Log in to GamerGain to purchase it now!`
          });
        }
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
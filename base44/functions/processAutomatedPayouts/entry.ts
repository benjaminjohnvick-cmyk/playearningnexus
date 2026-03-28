import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Daily automation: scan all users, check their balance vs. payout threshold
 * (which equals the sum of their selected wishlist items), and create payout
 * requests for those who qualify.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow scheduled (no user) or admin-triggered
    let callerIsAdmin = false;
    try {
      const user = await base44.auth.me();
      callerIsAdmin = user?.role === 'admin';
    } catch (_) {
      // Called from scheduler — no user context, that's fine
      callerIsAdmin = true;
    }

    if (!callerIsAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const users = await base44.asServiceRole.entities.User.list();
    let processed = 0;
    let triggered = 0;
    const results = [];

    for (const user of users) {
      processed++;
      const balance = user.total_earnings || 0;
      if (balance <= 0) continue;

      // Fetch their payout preference
      const prefs = await base44.asServiceRole.entities.PayoutPreference.filter({ user_id: user.id });
      const pref = prefs[0] || null;

      // Fetch active wishlist items tagged for payout goal
      const wishlistItems = await base44.asServiceRole.entities.ProductWishlistItem.filter({
        user_id: user.id,
        status: 'active',
      });

      // Sum wishlist items marked for payout goal (use_for_payout_goal flag or all active)
      const goalItems = wishlistItems.filter(i => i.use_for_payout_goal !== false);
      const wishlistTotal = goalItems.reduce((sum, i) => sum + (i.price_with_markup || i.best_price || 0), 0);

      // Threshold = wishlist total if set, else fall back to pref threshold or $50
      const threshold = wishlistTotal > 0
        ? wishlistTotal
        : (pref?.minimum_payout_threshold || 50);

      if (balance < threshold) continue;

      // Check if there's already a pending automated payout
      const existingPayouts = await base44.asServiceRole.entities.Payout.filter({
        user_id: user.id,
        status: 'pending',
        payout_type: 'automated_threshold',
      });
      if (existingPayouts.length > 0) continue;

      // Create the automated payout request
      const method = pref?.payout_method || 'paypal';
      const estimatedArrival = new Date();
      estimatedArrival.setDate(estimatedArrival.getDate() + 3); // 3 business days

      await base44.asServiceRole.entities.Payout.create({
        user_id: user.id,
        recipient_type: 'user',
        recipient_id: user.id,
        recipient_email: pref?.paypal_email || user.email,
        amount: balance,
        currency: 'USD',
        method,
        payout_type: 'automated_threshold',
        status: 'pending',
        description: wishlistTotal > 0
          ? `Auto-payout: Wishlist goal reached ($${wishlistTotal.toFixed(2)} total). Balance: $${balance.toFixed(2)}`
          : `Auto-payout: Balance $${balance.toFixed(2)} hit threshold $${threshold.toFixed(2)}`,
        notes: JSON.stringify({
          threshold,
          wishlist_total: wishlistTotal,
          wishlist_item_count: goalItems.length,
          triggered_at: new Date().toISOString(),
          estimated_arrival: estimatedArrival.toISOString(),
        }),
      });

      triggered++;
      results.push({ user_id: user.id, amount: balance, threshold });
    }

    return Response.json({
      success: true,
      processed,
      triggered,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
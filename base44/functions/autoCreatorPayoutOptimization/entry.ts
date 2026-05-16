import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Get creators with pending payouts
    const creators = await base44.asServiceRole.entities.CreatorProfile.filter({
      has_pending_payout: true
    });

    const optimizations = [];

    for (const creator of creators) {
      // Fetch pending earnings
      const earnings = await base44.asServiceRole.entities.CreatorPayout.filter({
        creator_id: creator.user_id,
        status: 'pending'
      });

      const totalAmount = earnings.reduce((sum, e) => sum + e.amount, 0);

      // Auto-optimize payout timing
      if (totalAmount >= 100) {
        // Large payout: Process immediately for cash flow
        for (const earning of earnings) {
          await base44.asServiceRole.entities.CreatorPayout.update(earning.id, {
            status: 'processing'
          });
        }

        // Process via fastest method
        const method = creator.preferred_payout_method || 'paypal';
        await base44.functions.invoke(`${method}Payout`, {
          user_id: creator.user_id,
          amount: totalAmount
        });

        optimizations.push({
          creator_id: creator.user_id,
          amount: totalAmount,
          method,
          action: 'auto_processed'
        });
      }
    }

    return Response.json({ success: true, optimized: optimizations.length, optimizations });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
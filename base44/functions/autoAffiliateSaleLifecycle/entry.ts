import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const sale = data;
    if (!sale?.id) return Response.json({ ok: true });

    if (event?.type === 'create') {
      // Notify affiliate of new sale
      if (sale.affiliate_user_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: sale.affiliate_user_id,
          type: 'affiliate_sale',
          title: `💰 Affiliate Sale: $${sale.commission_earned} Commission!`,
          message: `You earned $${sale.commission_earned} commission from a $${sale.sale_amount} sale via your referral link! Payment will process when confirmed.`,
          is_read: false
        });
        // Award XP
        await base44.asServiceRole.entities.UserActivity.create({
          user_id: sale.affiliate_user_id,
          activity_type: 'affiliate_sale',
          points_earned: Math.max(10, Math.floor(sale.commission_earned * 10)),
          metadata: { sale_id: sale.id, commission: sale.commission_earned }
        });
      }
    }

    if (event?.type === 'update' && data.status === 'confirmed' && !data.commission_paid) {
      // Auto-process commission payment
      if (sale.affiliate_user_id) {
        const user = (await base44.asServiceRole.entities.User.filter({ id: sale.affiliate_user_id }))[0];
        if (user) {
          await base44.asServiceRole.entities.User.update(sale.affiliate_user_id, {
            total_earnings: (user.total_earnings || 0) + (sale.commission_earned || 0)
          });
        }
        await base44.asServiceRole.entities.AffiliateSale.update(sale.id, { commission_paid: true, status: 'paid' });
        await base44.asServiceRole.entities.Notification.create({
          user_id: sale.affiliate_user_id,
          type: 'affiliate_commission_paid',
          title: `✅ Affiliate Commission Paid: $${sale.commission_earned}`,
          message: `Your $${sale.commission_earned} commission has been added to your GamerGain balance!`,
          is_read: false
        });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
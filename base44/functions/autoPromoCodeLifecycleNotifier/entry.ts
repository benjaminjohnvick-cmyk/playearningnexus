import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const promo = data;
    if (!promo?.id) return Response.json({ ok: true });

    if (event?.type === 'create') {
      // Broadcast new promo code to eligible users
      const discount = promo.discount_percent ? `${promo.discount_percent}% off` : promo.discount_amount ? `$${promo.discount_amount} off` : 'special discount';
      const users = await base44.asServiceRole.entities.User.list('-created_date', 30);
      for (const user of users) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: user.id,
          type: 'promo_code_new',
          title: `🎟️ New Promo Code: ${discount}!`,
          message: `Use code "${promo.code}" for ${discount} on ${promo.applicable_to || 'purchases'}. Expires: ${promo.expires_at ? new Date(promo.expires_at).toLocaleDateString() : 'soon'}!`,
          is_read: false
        });
      }
    }

    if (event?.type === 'update' && data.times_used > 0 && data.times_used !== data.times_used - 1) {
      // A promo was redeemed — check if limit reached
      if (promo.max_uses && data.times_used >= promo.max_uses) {
        await base44.asServiceRole.entities.PromoCode.update(promo.id, { is_active: false });
        // Notify admin
        const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
        for (const admin of admins.slice(0, 1)) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: admin.id,
            type: 'promo_maxed',
            title: `🎟️ Promo "${promo.code}" Maxed Out`,
            message: `Promo code "${promo.code}" reached its ${promo.max_uses} use limit and has been deactivated.`,
            is_read: false
          });
        }
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
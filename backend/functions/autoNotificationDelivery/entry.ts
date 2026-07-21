import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const notif = data;
    if (!notif?.id || !notif?.user_id) return Response.json({ ok: true });

    if (event?.type === 'create') {
      // High-priority notifications → also send email
      const highPriority = ['payout_completed', 'withdrawal_completed', 'campaign_budget_exhausted',
        'fraud_alert', 'account_suspended', 'tournament_win', 'leaderboard_top10'];

      if (highPriority.includes(notif.type)) {
        const user = (await base44.asServiceRole.entities.User.filter({ id: notif.user_id }))[0];
        if (user?.email) {
          await base44.integrations.Core.SendEmail({
            to: user.email,
            subject: notif.title || 'GamerGain Notification',
            body: `${notif.message}\n\nLog in to GamerGain to take action.`
          });
        }
      }

      // Auto-expire old unread notifications (older than 30 days)
      const oldNotifs = await base44.asServiceRole.entities.Notification.filter({
        user_id: notif.user_id,
        is_read: false
      });
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
      for (const old of oldNotifs) {
        if (new Date(old.created_date) < thirtyDaysAgo) {
          await base44.asServiceRole.entities.Notification.update(old.id, { is_read: true, auto_expired: true });
        }
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
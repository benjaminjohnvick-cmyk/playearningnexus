import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data, old_data } = body;

  try {
    const credit = data;
    if (!credit?.id || event?.type !== 'update') return Response.json({ ok: true });

    const oldRevenue = old_data?.iap_revenue || 0;
    const newRevenue = credit.iap_revenue || 0;
    if (newRevenue === oldRevenue) return Response.json({ ok: true });

    const pct = (credit.advertising_credit_percentage || 20) / 100;
    const totalCredit = parseFloat((newRevenue * pct).toFixed(2));
    const available = parseFloat((totalCredit - (credit.credit_used || 0)).toFixed(2));

    await base44.asServiceRole.entities.IAPAdvertisingCredit.update(credit.id, {
      total_advertising_credit: totalCredit,
      credit_available: Math.max(0, available),
      last_updated: new Date().toISOString()
    });

    // Notify developer when significant new credit available
    const newCredit = totalCredit - ((old_data?.total_advertising_credit) || 0);
    if (newCredit >= 5 && credit.developer_id) {
      const devClient = (await base44.asServiceRole.entities.BusinessClient.filter({ id: credit.developer_id }))[0];
      if (devClient) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: devClient.owner_user_id || credit.developer_id,
          type: 'iap_ad_credit',
          title: `📣 $${newCredit.toFixed(2)} New Ad Credit Available!`,
          message: `Your in-app purchase revenue generated $${newCredit.toFixed(2)} in new social media advertising credit (${credit.advertising_credit_percentage || 20}% of IAP). Total available: $${available.toFixed(2)}.`,
          is_read: false
        });
      }
    }

    return Response.json({ ok: true, total_credit: totalCredit, available });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
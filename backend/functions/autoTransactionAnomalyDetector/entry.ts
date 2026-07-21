import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const tx = data;
    if (!tx?.id || event?.type !== 'create') return Response.json({ ok: true });

    // Flag anomalous transactions: large amounts, duplicate within 1 min, unusual type
    const flags = [];

    if (tx.amount > 1000) flags.push('large_amount');
    if (tx.amount < 0) flags.push('negative_amount');

    // Check for duplicates (same user, same amount, last 60 seconds)
    if (tx.user_id) {
      const recentTx = await base44.asServiceRole.entities.Transaction.filter({ user_id: tx.user_id, amount: tx.amount });
      const lastMinute = recentTx.filter(t => t.id !== tx.id && (new Date() - new Date(t.created_date)) < 60000);
      if (lastMinute.length > 0) flags.push('duplicate_within_60s');
    }

    if (flags.length > 0) {
      await base44.asServiceRole.entities.Transaction.update(tx.id, {
        status: flags.includes('duplicate_within_60s') ? 'failed' : 'pending',
        notes: `⚠️ Anomaly flags: ${flags.join(', ')}`
      });

      // Alert admins
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins.slice(0, 2)) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: admin.id,
          type: 'transaction_anomaly',
          title: `⚠️ Transaction Anomaly Detected`,
          message: `Transaction ID ${tx.id}: $${tx.amount} (${tx.transaction_type}). Flags: ${flags.join(', ')}`,
          is_read: false
        });
      }
    }

    return Response.json({ ok: true, flags });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
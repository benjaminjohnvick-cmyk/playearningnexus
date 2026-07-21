import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    if (!['create', 'update'].includes(event?.type)) return Response.json({ ok: true });
    const vc = data;
    if (!vc?.user_id) return Response.json({ ok: true });

    // Sync UserInventory balance
    const inventories = await base44.asServiceRole.entities.UserInventory.filter({ user_id: vc.user_id });
    if (inventories.length > 0) {
      await base44.asServiceRole.entities.UserInventory.update(inventories[0].id, {
        virtual_currency_balance: vc.balance || 0,
        last_synced: new Date().toISOString()
      });
    } else {
      await base44.asServiceRole.entities.UserInventory.create({
        user_id: vc.user_id,
        virtual_currency_balance: vc.balance || 0,
        items: []
      });
    }

    // Log transaction for significant changes
    if (event?.type === 'update' && (vc.balance || 0) > 0) {
      await base44.asServiceRole.entities.Transaction.create({
        user_id: vc.user_id,
        amount: vc.balance,
        currency: 'CREDITS',
        transaction_type: 'in_game_purchase',
        status: 'completed',
        notes: `Virtual currency balance sync: ${vc.currency_type || 'coins'}`
      });
    }

    // Notify on balance milestones
    const milestones = [100, 500, 1000, 5000];
    for (const m of milestones) {
      if ((vc.balance || 0) >= m) {
        const key = `vc_milestone_${m}`;
        const existing = await base44.asServiceRole.entities.UserAchievement.filter({ user_id: vc.user_id, achievement_key: key });
        if (existing.length === 0) {
          await base44.asServiceRole.entities.UserAchievement.create({
            user_id: vc.user_id,
            achievement_key: key,
            title: `💰 ${m} Virtual Currency Accumulated!`,
            unlocked_at: new Date().toISOString()
          });
        }
        break;
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Daily: recalculate BusinessClient total_revenue from all game orders and transactions
export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const clients = await base44.asServiceRole.entities.BusinessClient.filter({ account_status: 'active' });
    let updated = 0;

    for (const client of clients) {
      const games = await base44.asServiceRole.entities.Game.filter({ developer_id: client.id });
      const gameIds = games.map(g => g.id);

      let totalRevenue = 0;
      let totalInstalls = 0;

      for (const game of games) {
        totalRevenue += game.total_revenue || 0;
        totalInstalls += game.total_installs || 0;
      }

      // Also sum completed DeveloperPayout records
      const payouts = await base44.asServiceRole.entities.DeveloperPayout.filter({ developer_id: client.id, status: 'completed' });
      const totalPaidOut = payouts.reduce((s, p) => s + (p.amount || 0), 0);

      await base44.asServiceRole.entities.BusinessClient.update(client.id, {
        total_revenue: parseFloat(totalRevenue.toFixed(2)),
        total_installs: totalInstalls,
        games_count: games.length
      });

      // Revenue milestone notifications
      const milestones = [100, 500, 1000, 5000, 10000, 50000, 100000];
      const prevRevenue = client.total_revenue || 0;
      for (const m of milestones) {
        if (totalRevenue >= m && prevRevenue < m) {
          if (client.owner_user_id) {
            await base44.asServiceRole.entities.Notification.create({
              user_id: client.owner_user_id,
              type: 'revenue_milestone',
              title: `💰 $${m.toLocaleString()} Revenue Milestone!`,
              message: `Your games have generated $${m.toLocaleString()} in total revenue on GamerGain. Congratulations!`,
              is_read: false
            });
          }
          break;
        }
      }

      updated++;
    }

    return Response.json({ ok: true, clients_updated: updated });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
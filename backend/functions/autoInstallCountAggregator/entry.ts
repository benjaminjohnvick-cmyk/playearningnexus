import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Triggered when DeveloperInstallCost is updated — syncs total_installs to Game + BusinessClient
export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data, old_data } = body;

  try {
    const costRecord = data;
    if (!costRecord?.id || event?.type !== 'update') return Response.json({ ok: true });

    const oldInstalls = old_data?.total_installs || 0;
    const newInstalls = costRecord.total_installs || 0;
    const delta = newInstalls - oldInstalls;
    if (delta === 0) return Response.json({ ok: true });

    // Update Game total_installs
    if (costRecord.app_id) {
      const games = await base44.asServiceRole.entities.Game.filter({ id: costRecord.app_id });
      if (games.length > 0) {
        const game = games[0];
        const updatedInstalls = (game.total_installs || 0) + delta;
        await base44.asServiceRole.entities.Game.update(game.id, { total_installs: Math.max(0, updatedInstalls) });

        // Notify developer on install milestones
        const milestones = [1000, 5000, 10000, 25000, 50000, 100000];
        for (const m of milestones) {
          if (updatedInstalls >= m && (game.total_installs || 0) < m) {
            await base44.asServiceRole.entities.Notification.create({
              user_id: costRecord.developer_id,
              type: 'install_milestone',
              title: `🎮 "${game.title}" hit ${m.toLocaleString()} Installs!`,
              message: `Your game has reached ${m.toLocaleString()} installs on GamerGain. Keep it up!`,
              is_read: false
            });
            break;
          }
        }
      }
    }

    // Update BusinessClient total_installs
    if (costRecord.developer_id) {
      const clients = await base44.asServiceRole.entities.BusinessClient.filter({ id: costRecord.developer_id });
      if (clients.length > 0) {
        const client = clients[0];
        await base44.asServiceRole.entities.BusinessClient.update(client.id, {
          total_installs: Math.max(0, (client.total_installs || 0) + delta)
        });
      }
    }

    return Response.json({ ok: true, delta });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
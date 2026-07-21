import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    // LeaderboardEntry created/updated → check for rank changes and notify
    if (event?.type === 'create' || event?.type === 'update') {
      const entry = data;
      if (!entry?.id) return Response.json({ ok: true });

      // Check if user broke top 10
      const allEntries = await base44.asServiceRole.entities.LeaderboardEntry.list('-score', 10);
      const rank = allEntries.findIndex(e => e.user_id === entry.user_id) + 1;

      if (rank > 0 && rank <= 10 && entry.user_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: entry.user_id,
          type: 'leaderboard_top10',
          title: `🏆 You're #${rank} on the Leaderboard!`,
          message: `Amazing! You've broken into the Top 10 with ${entry.score} points. Keep it up!`,
          is_read: false
        });

        if (rank === 1) {
          // Award prestige for #1
          const existingPrestige = await base44.asServiceRole.entities.GlobalPrestige.filter({ user_id: entry.user_id });
          if (existingPrestige.length === 0) {
            await base44.asServiceRole.entities.GlobalPrestige.create({
              user_id: entry.user_id,
              prestige_level: 1,
              total_points: entry.score || 0,
              rank: 1,
              title: 'GamerGain Champion'
            });
          } else {
            await base44.asServiceRole.entities.GlobalPrestige.update(existingPrestige[0].id, {
              prestige_level: Math.min((existingPrestige[0].prestige_level || 0) + 1, 10),
              rank: 1
            });
          }
        }
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Partner Notification Webhook
 * Triggered by entity automations for:
 *   - new_review        : a GameReview record was created
 *   - install_milestone : a Game's total_installs crossed a milestone (100, 500, 1k, 5k, 10k, 50k, 100k…)
 *   - game_featured     : a Game's status changed to 'featured'
 */

const INSTALL_MILESTONES = [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000];

function hitMilestone(oldInstalls, newInstalls) {
  return INSTALL_MILESTONES.find(m => (oldInstalls || 0) < m && newInstalls >= m) || null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data, old_data } = body;

    if (!event || !data) {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const entityName = event.entity_name;
    const eventType = event.type;

    // ── NEW REVIEW ──────────────────────────────────────────────
    if (entityName === 'GameReview' && eventType === 'create') {
      const gameId = data.game_id;
      const reviewerName = data.user_name || 'A user';
      const rating = data.rating;
      const stars = '⭐'.repeat(rating);

      // Find the game to get developer_id
      const games = await base44.asServiceRole.entities.Game.filter({ id: gameId });
      const game = games[0];
      if (!game || !game.developer_id) return Response.json({ skipped: 'No game/developer found' });

      // Find the BusinessClient -> User mapping via developer_id stored in Game
      // developer_id on Game is a BusinessClient id; BusinessClient has a user_id field
      const clients = await base44.asServiceRole.entities.BusinessClient.filter({ id: game.developer_id });
      const client = clients[0];
      if (!client) return Response.json({ skipped: 'No BusinessClient found' });

      const devUserId = client.user_id || client.created_by;
      if (!devUserId) return Response.json({ skipped: 'No developer user_id' });

      await base44.asServiceRole.entities.Notification.create({
        user_id: devUserId,
        type: 'partner_new_review',
        channel: 'partner_exclusive',
        title: `New ${stars} Review on ${game.title}`,
        message: `${reviewerName} left a ${rating}-star review on your game "${game.title}"${data.review_text ? `: "${data.review_text.slice(0, 120)}${data.review_text.length > 120 ? '…' : ''}"` : '.'}`,
        related_item_id: gameId,
        action_url: `/GameDetail?id=${gameId}`,
        icon: '⭐',
        status: 'unread',
        delivery_method: ['in_app'],
      });

      return Response.json({ success: true, event: 'new_review', game: game.title });
    }

    // ── INSTALL MILESTONE + GAME FEATURED (Game update events) ──
    if (entityName === 'Game' && eventType === 'update') {
      const game = data;
      if (!game.developer_id) return Response.json({ skipped: 'No developer_id on game' });

      const clients = await base44.asServiceRole.entities.BusinessClient.filter({ id: game.developer_id });
      const client = clients[0];
      if (!client) return Response.json({ skipped: 'No BusinessClient found' });

      const devUserId = client.user_id || client.created_by;
      if (!devUserId) return Response.json({ skipped: 'No developer user_id' });

      const notifications = [];

      // Check install milestone
      const milestone = hitMilestone(old_data?.total_installs, game.total_installs);
      if (milestone) {
        const formatted = milestone >= 1000000 ? `${milestone / 1000000}M`
          : milestone >= 1000 ? `${milestone / 1000}k`
          : `${milestone}`;

        notifications.push(base44.asServiceRole.entities.Notification.create({
          user_id: devUserId,
          type: 'partner_install_milestone',
          channel: 'partner_exclusive',
          title: `🎉 ${formatted} Installs for ${game.title}!`,
          message: `Your game "${game.title}" just hit ${formatted} installs. Keep it up — the community loves it!`,
          related_item_id: game.id,
          action_url: `/BusinessDashboard`,
          icon: '🚀',
          status: 'unread',
          delivery_method: ['in_app'],
        }));
      }

      // Check if game was just promoted to featured
      const wasNotFeatured = old_data?.status !== 'featured';
      const isNowFeatured = game.status === 'featured';
      if (wasNotFeatured && isNowFeatured) {
        notifications.push(base44.asServiceRole.entities.Notification.create({
          user_id: devUserId,
          type: 'partner_game_featured',
          channel: 'partner_exclusive',
          title: `🏆 "${game.title}" is Now Featured!`,
          message: `Congratulations! The GamerGain community voted "${game.title}" into the Featured section. Your game will now receive prime visibility across the platform.`,
          related_item_id: game.id,
          action_url: `/GameVotingHub`,
          icon: '🏆',
          status: 'unread',
          delivery_method: ['in_app'],
        }));
      }

      if (notifications.length === 0) return Response.json({ skipped: 'No milestone or status change' });

      await Promise.all(notifications);
      return Response.json({ success: true, notifications_sent: notifications.length });
    }

    return Response.json({ skipped: 'No matching handler' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
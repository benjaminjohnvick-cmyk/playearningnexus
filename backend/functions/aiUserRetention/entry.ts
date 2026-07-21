import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Scheduled daily: identify at-risk users and send personalized retention messages
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const users = await base44.asServiceRole.entities.User.list('-updated_date', 200);
    const now = new Date();
    let retentionActionsCount = 0;

    for (const user of users) {
      const lastActive = new Date(user.updated_date);
      const daysSinceActive = (now - lastActive) / (1000 * 60 * 60 * 24);

      // Target users inactive for 3-14 days (still recoverable)
      if (daysSinceActive < 3 || daysSinceActive > 14) continue;

      const [userSessions, userEarnings] = await Promise.all([
        base44.asServiceRole.entities.PPCSession.filter({ user_id: user.id }),
        base44.asServiceRole.entities.PPCTransaction.filter({ user_id: user.id })
      ]);

      const totalEarned = userEarnings.reduce((sum, t) => sum + (t.amount || 0), 0);

      const prompt = `You are a user retention AI for GamerGain. Create a personalized re-engagement message.

User: ${user.full_name}
Days Inactive: ${Math.floor(daysSinceActive)}
Total Earnings: $${totalEarned.toFixed(2)}
Total Sessions: ${userSessions.length}

Write a short, compelling notification (max 2 sentences) to bring them back. Be specific about their earnings and what they're missing.`;

      const retention = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            notification_title: { type: 'string' },
            notification_message: { type: 'string' },
            email_subject: { type: 'string' }
          }
        }
      });

      await base44.asServiceRole.entities.Notification.create({
        user_id: user.id,
        type: 'retention',
        title: retention.notification_title,
        message: retention.notification_message,
        is_read: false
      });

      retentionActionsCount++;
    }

    return Response.json({ success: true, retention_actions: retentionActionsCount });
  } catch (error) {
    console.error('AI retention error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
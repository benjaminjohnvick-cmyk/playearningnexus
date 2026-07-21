import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Daily: send deadline reminders for sponsored content approaching due date
export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in72h = new Date(now.getTime() + 72 * 60 * 60 * 1000);
    const results = [];

    const activeContent = await base44.asServiceRole.entities.SponsoredContent.filter({ status: 'approved' });

    for (const content of activeContent) {
      if (!content.deadline) continue;
      const deadline = new Date(content.deadline);
      const isPast = deadline < now;
      const isWithin24h = deadline >= now && deadline <= in24h;
      const isWithin72h = deadline >= now && deadline <= in72h && deadline > in24h;

      if (isPast) {
        // Auto-expire overdue content
        await base44.asServiceRole.entities.SponsoredContent.update(content.id, { status: 'completed' });
        results.push(`expired_content_${content.id}`);
      } else if (isWithin24h && content.creator_user_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: content.creator_user_id,
          type: 'sponsorship_deadline_urgent',
          title: `🚨 Sponsorship Due in 24 Hours!`,
          message: `"${content.title}" must be published TODAY to receive payment of $${content.agreed_price}.`,
          is_read: false
        });
        results.push(`24h_reminder_${content.id}`);
      } else if (isWithin72h && content.creator_user_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: content.creator_user_id,
          type: 'sponsorship_deadline_reminder',
          title: `⏰ Sponsorship Deadline in 3 Days`,
          message: `Don't forget: "${content.title}" is due ${new Date(content.deadline).toLocaleDateString()}. Publish to earn $${content.agreed_price}.`,
          is_read: false
        });
        results.push(`72h_reminder_${content.id}`);
      }
    }

    return Response.json({ ok: true, results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
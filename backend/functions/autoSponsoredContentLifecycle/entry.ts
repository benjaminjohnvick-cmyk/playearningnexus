import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data, old_data } = body;

  try {
    const content = data;
    if (!content?.id) return Response.json({ ok: true });

    if (event?.type === 'create') {
      // Notify creator of new sponsorship deal
      if (content.creator_user_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: content.creator_user_id,
          type: 'sponsorship_received',
          title: `💼 New Sponsorship Deal: $${content.agreed_price}!`,
          message: `You have a new sponsored ${content.content_type} opportunity worth $${content.agreed_price}. Deadline: ${content.deadline ? new Date(content.deadline).toLocaleDateString() : 'flexible'}. Check your creator dashboard.`,
          is_read: false
        });
        const creator = (await base44.asServiceRole.entities.User.filter({ id: content.creator_user_id }))[0];
        if (creator?.email) {
          await base44.integrations.Core.SendEmail({
            to: creator.email,
            subject: `💼 New Sponsorship Opportunity: $${content.agreed_price}`,
            body: `You have a new sponsored content deal!\n\nType: ${content.content_type}\nTitle: ${content.title}\nPayment: $${content.agreed_price}\nDeadline: ${content.deadline ? new Date(content.deadline).toLocaleDateString() : 'Flexible'}\n\nLog in to your Creator Dashboard to accept and view requirements.`
          });
        }
      }
    }

    if (event?.type === 'update') {
      const oldStatus = old_data?.status;
      const newStatus = data.status;
      if (oldStatus === newStatus) return Response.json({ ok: true });

      if (newStatus === 'approved' && content.creator_user_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: content.creator_user_id,
          type: 'sponsorship_approved',
          title: `✅ Sponsorship Approved — Start Creating!`,
          message: `Your sponsored "${content.title}" has been approved! Deadline: ${content.deadline ? new Date(content.deadline).toLocaleDateString() : 'N/A'}. Publish to get paid.`,
          is_read: false
        });
      }

      if (newStatus === 'published' && content.sponsor_business_id) {
        // Notify sponsor
        const sponsor = (await base44.asServiceRole.entities.BusinessClient.filter({ id: content.sponsor_business_id }))[0];
        if (sponsor?.contact_email) {
          await base44.integrations.Core.SendEmail({
            to: sponsor.contact_email,
            subject: `📢 Sponsored Content Published: "${content.title}"`,
            body: `Your sponsored content "${content.title}" has been published by the creator! View it here: ${content.content_url || 'N/A'}. We will send performance reports as views and engagement accumulate.`
          });
        }
      }

      if (newStatus === 'completed') {
        // Process payment to creator
        if (content.creator_user_id) {
          const totalPayment = (content.agreed_price || 0) + (content.performance_bonus || 0);
          await base44.asServiceRole.entities.CreatorPayout.create({
            creator_id: content.creator_user_id,
            amount: totalPayment,
            payout_type: 'sponsorship',
            status: 'pending',
            notes: `Sponsorship: ${content.title} — Base: $${content.agreed_price}, Bonus: $${content.performance_bonus || 0}`
          });
          await base44.asServiceRole.entities.Notification.create({
            user_id: content.creator_user_id,
            type: 'sponsorship_paid',
            title: `💰 Sponsorship Payment: $${totalPayment}`,
            message: `Your sponsorship "${content.title}" is complete! $${totalPayment} payout has been initiated.`,
            is_read: false
          });
        }
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
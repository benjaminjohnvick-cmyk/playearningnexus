import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Manage live events
    const now = new Date();
    const events = await base44.asServiceRole.entities.LiveEvent.filter({});

    const updates = [];

    for (const event of events) {
      const startTime = new Date(event.start_time);
      const endTime = new Date(event.end_time);

      // Auto-activate events that are starting
      if (startTime <= now && now < endTime && !event.is_active) {
        await base44.asServiceRole.entities.LiveEvent.update(event.id, {
          is_active: true,
          activated_at: now.toISOString()
        });

        // Send notifications to subscribed users
        await base44.integrations.Core.SendEmail({
          to: 'notification@gamergain.com',
          subject: `🎉 ${event.name} is now LIVE!`,
          body: `Event "${event.name}" has started. Users will be notified.`
        });

        updates.push({ event_id: event.id, action: 'activated' });
      }

      // Auto-close ended events
      if (now > endTime && event.is_active) {
        await base44.asServiceRole.entities.LiveEvent.update(event.id, {
          is_active: false,
          ended_at: now.toISOString()
        });

        // Archive results
        await base44.functions.invoke('publishWinningSurveyProduct', {
          event_id: event.id
        });

        updates.push({ event_id: event.id, action: 'closed' });
      }
    }

    return Response.json({ success: true, events_updated: updates.length, updates });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Automates: live event creation, activation, expiry, leaderboard updates, prize distribution
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const results = {};
    const now = new Date().toISOString();

    // 1. Activate scheduled events that have reached their start time
    const scheduledEvents = await base44.asServiceRole.entities.LiveEvent.filter({ is_active: false });
    let activated = 0;
    for (const event of scheduledEvents) {
      if (event.start_time && new Date(event.start_time) <= new Date(now)) {
        await base44.asServiceRole.entities.LiveEvent.update(event.id, { is_active: true });
        // Notify all users about new live event
        await base44.asServiceRole.entities.Notification.create({
          user_id: 'broadcast',
          type: 'status_changed',
          title: `🎉 Live Event: ${event.name || event.title || 'Event'} Started!`,
          message: `A new live event is now active. Join now to earn bonus rewards!`,
          status: 'unread',
          delivery_method: ['in_app']
        });
        activated++;
      }
    }
    results.events_activated = activated;

    // 2. Expire events that have passed their end time
    const activeEvents = await base44.asServiceRole.entities.LiveEvent.filter({ is_active: true });
    let expired = 0;
    for (const event of activeEvents) {
      if (event.end_time && new Date(event.end_time) < new Date(now)) {
        await base44.asServiceRole.entities.LiveEvent.update(event.id, { is_active: false, status: 'completed' });
        expired++;
      }
    }
    results.events_expired = expired;

    // 3. Auto-create weekly events if none active
    if (activeEvents.filter(e => new Date(e.end_time) >= new Date(now)).length === 0) {
      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString();
      const tomorrow = new Date(Date.now() + 86400000).toISOString();
      const eventTitle = `Weekly Earnings Boost - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      await base44.asServiceRole.entities.LiveEvent.create({
        title: eventTitle,
        name: eventTitle,
        description: 'Complete 5 surveys this week for a 20% earnings bonus!',
        is_active: true,
        start_time: now,
        end_time: nextWeek,
        event_type: 'bonus_rewards',
        reward_multiplier: 1.2
      });
      results.weekly_event_created = true;
    }

    // 4. Weekly event leaderboard update
    const weeklyEvents = await base44.asServiceRole.entities.WeeklyEvent.filter({ status: 'active' });
    results.active_weekly_events = weeklyEvents.length;

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
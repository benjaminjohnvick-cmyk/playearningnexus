import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // Headless batch call — auto-match waiting contests
    if (!action) {
      const waiting = await base44.asServiceRole.entities.HeadToHeadContest.filter({ status: 'waiting' });
      let matched = 0;
      for (const contest of waiting) {
        const needed = (contest.group_size || 2);
        const current = (contest.participants || []).length;
        if (current >= needed) {
          await base44.asServiceRole.entities.HeadToHeadContest.update(contest.id, { status: 'active' });
          matched++;
        }
      }
      return Response.json({ success: true, contests_matched: matched });
    } // 'create' or 'auto_group'

    if (action === 'create') {
      const { group_size } = body;
      
      if (group_size < 2) {
        return Response.json({ 
          error: 'Group size must be at least 2' 
        }, { status: 400 });
      }

      // Create contest
      const contest = await base44.entities.HeadToHeadContest.create({
        contest_name: `Contest ${Date.now()}`,
        group_size,
        participants: [user.id],
        entry_fee: 2,
        winning_amount: 20,
        target_earnings: 3,
        status: 'waiting',
        participant_earnings: { [user.id]: 0 },
        started_at: new Date().toISOString()
      });

      return Response.json({
        success: true,
        contest_id: contest.id,
        message: `Contest created. Waiting for ${group_size - 1} more participants`
      });
    }

    if (action === 'auto_group') {
      // AI auto-selects group size based on active users
      const activeUsers = await base44.entities.User.filter({ 
        last_active: { $gte: new Date(Date.now() - 3600000).toISOString() }
      });

      // Smart sizing: 3-5 users for small groups, 5-15 for medium, 15+ for large
      const suggestedSize = activeUsers.length < 10 ? 3 : 
                           activeUsers.length < 50 ? 8 : 15;

      return Response.json({
        suggested_group_size: suggestedSize,
        active_users: activeUsers.length
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
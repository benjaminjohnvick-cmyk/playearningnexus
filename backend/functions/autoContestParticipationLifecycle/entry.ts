import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const entry = data;
    if (!entry?.id) return Response.json({ ok: true });

    if (event?.type === 'create') {
      const user = entry.user_id ? (await base44.asServiceRole.entities.User.filter({ id: entry.user_id }))[0] : null;
      const contest = entry.contest_id ? (await base44.asServiceRole.entities.ReferralContest.filter({ id: entry.contest_id }))[0] : null;

      // Confirm entry
      if (entry.user_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: entry.user_id,
          type: 'contest_entered',
          title: `🏆 Contest Entry Confirmed!`,
          message: `You've entered ${contest?.name || 'the contest'}! Refer friends and earn points to climb the leaderboard.`,
          is_read: false
        });
        if (user?.email) {
          await base44.integrations.Core.SendEmail({
            to: user.email,
            subject: `🏆 Contest Entry Confirmed: ${contest?.name || 'GamerGain Contest'}`,
            body: `You're officially entered in "${contest?.name || 'the contest'}"!\n\nTop prize: ${contest?.top_prize || 'Amazing rewards'}\nEnds: ${contest?.end_date || 'TBD'}\n\nShare your referral link to earn points and win!`
          });
        }
      }

      // Update contest entry count
      if (entry.contest_id) {
        const allEntries = await base44.asServiceRole.entities.ContestParticipation.filter({ contest_id: entry.contest_id });
        await base44.asServiceRole.entities.ReferralContest.update(entry.contest_id, {
          participant_count: allEntries.length
        });
      }
    }

    if (event?.type === 'update' && data.rank === 1) {
      // User hit #1 — notify them
      if (entry.user_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: entry.user_id,
          type: 'contest_rank_1',
          title: '🥇 You\'re #1 in the Contest!',
          message: 'Amazing! You\'re currently leading the contest. Keep referring to hold your spot!',
          is_read: false
        });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
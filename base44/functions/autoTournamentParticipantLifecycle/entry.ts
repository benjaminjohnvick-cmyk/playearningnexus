import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const participant = data;
    if (!participant?.id) return Response.json({ ok: true });

    if (event?.type === 'create') {
      const tournament = participant.tournament_id
        ? (await base44.asServiceRole.entities.Tournament.filter({ id: participant.tournament_id }))[0]
        : null;

      // Confirm registration to participant
      if (participant.user_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: participant.user_id,
          type: 'tournament_joined',
          title: `⚔️ Registered: ${tournament?.name || 'Tournament'}!`,
          message: `You're registered for ${tournament?.name || 'the tournament'}! Match schedules will be announced soon. Prepare to compete!`,
          is_read: false
        });
        const user = (await base44.asServiceRole.entities.User.filter({ id: participant.user_id }))[0];
        if (user?.email) {
          await base44.integrations.Core.SendEmail({
            to: user.email,
            subject: `⚔️ Tournament Registration Confirmed: ${tournament?.name || 'Tournament'}`,
            body: `You're officially registered for "${tournament?.name || 'the tournament'}"!\n\nStart: ${tournament?.start_date || 'TBD'}\nPrize Pool: $${tournament?.prize_pool || 0}\n\nGood luck!`
          });
        }
      }

      // Update participant count on tournament
      if (participant.tournament_id && tournament) {
        const allParticipants = await base44.asServiceRole.entities.TournamentParticipant.filter({ tournament_id: participant.tournament_id });
        await base44.asServiceRole.entities.Tournament.update(participant.tournament_id, {
          participant_count: allParticipants.length
        });
        // Auto-start if max capacity reached
        if (tournament.max_participants && allParticipants.length >= tournament.max_participants) {
          await base44.asServiceRole.entities.Tournament.update(participant.tournament_id, { status: 'active' });
        }
      }
    }

    if (event?.type === 'update' && data.status === 'eliminated') {
      if (participant.user_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: participant.user_id,
          type: 'tournament_eliminated',
          title: '😤 Eliminated from Tournament',
          message: `You've been eliminated from the tournament. Great effort! Join another tournament to compete again.`,
          is_read: false
        });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
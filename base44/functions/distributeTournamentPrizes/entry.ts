import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admins can distribute prizes
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { tournament_id } = await req.json();
    if (!tournament_id) return Response.json({ error: 'Missing tournament_id' }, { status: 400 });

    // Get tournament
    const tournament = await base44.asServiceRole.entities.Tournament.filter({ id: tournament_id }).then(r => r[0]);
    if (!tournament) return Response.json({ error: 'Tournament not found' }, { status: 404 });

    if (tournament.prizes_distributed) {
      return Response.json({ error: 'Prizes already distributed' }, { status: 400 });
    }

    // Get final placements
    const participants = await base44.asServiceRole.entities.TournamentParticipant.filter({
      tournament_id,
      status: 'won',
    });

    // Sort by placement
    const sorted = participants.sort((a, b) => (a.final_placement || 999) - (b.final_placement || 999));

    const prizeDistribution = {
      1: Math.floor(tournament.total_prize_pool * 0.5),
      2: Math.floor(tournament.total_prize_pool * 0.3),
      3: Math.floor(tournament.total_prize_pool * 0.2),
    };

    const distributions = [];

    // Award prizes to top 3
    for (let i = 0; i < Math.min(3, sorted.length); i++) {
      const participant = sorted[i];
      const placement = i + 1;
      const prize = prizeDistribution[placement] || 0;

      if (prize > 0) {
        // Update participant
        await base44.asServiceRole.entities.TournamentParticipant.update(participant.id, {
          prize_awarded: prize,
          final_placement: placement,
        });

        // Award to user balance
        const userRecord = await base44.asServiceRole.entities.User.filter({ id: participant.user_id }).then(r => r[0]);
        if (userRecord) {
          await base44.asServiceRole.entities.User.update(userRecord.id, {
            total_earnings: (userRecord.total_earnings || 0) + prize,
          });
        }

        // Send notification email
        await base44.integrations.Core.SendEmail({
          to: participant.user_email,
          subject: `🏆 Congratulations! You Won $${prize} in the Tournament!`,
          body: `Hi ${participant.user_name},\n\nCongratulations on placing ${placement} in the ${tournament.tournament_name}!\n\nYour prize of $${prize} has been added to your account and is ready to withdraw.\n\nThank you for competing! 🎉`,
          from_name: 'GamerGain Tournaments',
        });

        distributions.push({
          placement,
          user_id: participant.user_id,
          user_name: participant.user_name,
          prize,
        });
      }
    }

    // Mark tournament as distributed
    await base44.asServiceRole.entities.Tournament.update(tournament_id, {
      prizes_distributed: true,
      distributed_at: new Date().toISOString(),
      status: 'completed',
    });

    return Response.json({
      success: true,
      tournament_id,
      total_distributed: distributions.reduce((sum, d) => sum + d.prize, 0),
      distributions,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
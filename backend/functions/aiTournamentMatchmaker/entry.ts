import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { tournament_id } = await req.json();

    // Fetch tournament details
    const tournament = await base44.asServiceRole.entities.Tournament.get(tournament_id);
    const participants = await base44.asServiceRole.entities.TournamentParticipant.filter({
      tournament_id
    });

    // Enrich participants with trust scores and engagement history
    const enrichedParticipants = await Promise.all(
      participants.map(async (p) => {
        const user = await base44.asServiceRole.entities.User.get(p.user_id);
        const trustScore = await base44.asServiceRole.functions.invoke('calculateTrustScore', {
          user_id: p.user_id
        });

        // Get recent UX session data for engagement
        const sessions = await base44.asServiceRole.entities.UXSessionRecording.filter({
          user_id: p.user_id,
          recorded_at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }
        });

        const avgFraudScore = sessions.length > 0
          ? sessions.reduce((sum, s) => sum + (s.fraud_score || 0), 0) / sessions.length
          : 0;

        return {
          ...p,
          skill_level: p.rating || 1000, // ELO rating
          trust_score: trustScore.score,
          engagement_sessions: sessions.length,
          avg_fraud_score: avgFraudScore,
          is_legitimate: avgFraudScore < 50 && trustScore.score > 50
        };
      })
    );

    // Filter out suspicious participants
    const legitimateParticipants = enrichedParticipants.filter(p => p.is_legitimate);

    if (legitimateParticipants.length < 2) {
      return Response.json({ error: 'Not enough legitimate participants for tournament' }, { status: 400 });
    }

    // Sort by skill level for bracket seeding
    legitimateParticipants.sort((a, b) => b.skill_level - a.skill_level);

    // Create matches using Swiss-system style pairing for fairness
    const matches = [];
    const rounds = Math.ceil(Math.log2(legitimateParticipants.length));

    for (let round = 0; round < rounds; round++) {
      const roundMatches = createRoundMatches(legitimateParticipants, round);
      matches.push(...roundMatches);
    }

    // Create match records in database
    const createdMatches = await Promise.all(
      matches.map(match =>
        base44.asServiceRole.entities.TournamentMatch.create({
          tournament_id,
          player_1_id: match.player_1_id,
          player_2_id: match.player_2_id,
          round: match.round,
          status: 'scheduled',
          scheduled_time: new Date(Date.now() + match.round * 24 * 60 * 60 * 1000).toISOString()
        })
      )
    );

    // Send push notifications to all participants
    await Promise.all(
      legitimateParticipants.map(async (p) => {
        const userMatches = createdMatches.filter(
          m => m.player_1_id === p.user_id || m.player_2_id === p.user_id
        );

        await base44.integrations.Core.SendEmail({
          to: p.email || `user_${p.user_id}@gamergain.local`,
          subject: `🏆 You\'re In! Tournament Bracket Ready`,
          body: `Your ${tournament.title} tournament bracket is set! You have ${userMatches.length} matches scheduled. Check your dashboard for match times and opponents.`
        });
      })
    );

    return Response.json({
      success: true,
      tournament_id,
      total_participants: legitimateParticipants.length,
      total_matches: createdMatches.length,
      rounds: rounds,
      bracket: createdMatches
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Swiss-system style pairing: group by skill level, pair within groups
function createRoundMatches(participants, roundNumber) {
  const matches = [];
  const groupSize = Math.pow(2, roundNumber + 1);

  for (let i = 0; i < participants.length; i += groupSize) {
    const group = participants.slice(i, Math.min(i + groupSize, participants.length));

    // Pair highest vs lowest in group for competitive balance
    for (let j = 0; j < Math.floor(group.length / 2); j++) {
      matches.push({
        player_1_id: group[j].user_id,
        player_2_id: group[group.length - 1 - j].user_id,
        round: roundNumber + 1
      });
    }
  }

  return matches;
}
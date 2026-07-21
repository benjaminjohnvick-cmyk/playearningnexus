import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tournament_id, match_id, winner_id, loser_id, winner_score, loser_score } = await req.json();

    // Get both players' UX sessions during tournament time to verify legitimacy
    const match = await base44.asServiceRole.entities.TournamentMatch.get(match_id);
    const matchStartTime = new Date(match.started_at);
    const matchEndTime = new Date(match.completed_at || new Date());

    const [winnerSessions, loserSessions] = await Promise.all([
      base44.asServiceRole.entities.UXSessionRecording.filter({
        user_id: winner_id,
        recorded_at: { $gte: matchStartTime.toISOString(), $lte: matchEndTime.toISOString() }
      }),
      base44.asServiceRole.entities.UXSessionRecording.filter({
        user_id: loser_id,
        recorded_at: { $gte: matchStartTime.toISOString(), $lte: matchEndTime.toISOString() }
      })
    ]);

    // Verify both players had legitimate activity during match
    const winnerFraudScore = winnerSessions[0]?.fraud_score || 0;
    const loserFraudScore = loserSessions[0]?.fraud_score || 0;

    const isSuspicious = winnerFraudScore > 70 || loserFraudScore > 70 || 
                        !winnerSessions.length || !loserSessions.length;

    // Record the match result
    const result = await base44.asServiceRole.entities.TournamentMatch.update(match_id, {
      winner_id,
      loser_id,
      winner_score,
      loser_score,
      completed_at: new Date().toISOString(),
      fraud_verified: !isSuspicious,
      winner_fraud_score: winnerFraudScore,
      loser_fraud_score: loserFraudScore
    });

    // Update tournament bracket
    await base44.asServiceRole.entities.Tournament.update(tournament_id, {
      last_match_updated: new Date().toISOString()
    });

    // Notify both players
    if (!isSuspicious) {
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: `Match Result Recorded - ${match.tournament_id}`,
        body: `Your match has been verified and recorded. Winner: ${winner_id} with score ${winner_score}-${loser_score}`
      });
    } else {
      // Flag suspicious match for admin review
      await base44.asServiceRole.entities.FraudReport.create({
        report_type: 'suspicious_tournament_match',
        user_id: winner_id,
        related_entity: 'TournamentMatch',
        related_entity_id: match_id,
        fraud_score: Math.max(winnerFraudScore, loserFraudScore),
        details: `Match appears suspicious - fraud scores: winner ${winnerFraudScore}, loser ${loserFraudScore}`
      });
    }

    return Response.json({
      success: true,
      match_recorded: result,
      fraud_verified: !isSuspicious
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
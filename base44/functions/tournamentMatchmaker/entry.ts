import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { tournament_id } = body;
    if (!tournament_id) return Response.json({ error: 'tournament_id required' }, { status: 400 });

    // Fetch tournament
    const tournaments = await base44.asServiceRole.entities.Tournament.filter({ id: tournament_id });
    const tournament = tournaments[0];
    if (!tournament) return Response.json({ error: 'Tournament not found' }, { status: 404 });

    // Fetch participants
    const participants = await base44.asServiceRole.entities.TournamentParticipant.filter({ tournament_id });
    if (participants.length < 2) return Response.json({ error: 'Need at least 2 participants' }, { status: 400 });

    // Fetch user skill data (use total_earnings as skill proxy)
    const userIds = participants.map(p => p.user_id).filter(Boolean);
    const users = await base44.asServiceRole.entities.User.list('-created_date', 500);
    const userMap = {};
    for (const u of users) { userMap[u.id] = u; }

    // AI skill-based matchmaking
    let matchPairs;
    try {
      const skillProfiles = participants.map(p => ({
        user_id: p.user_id,
        earnings: userMap[p.user_id]?.total_earnings || 0,
        score: p.score || 0,
      }));

      const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are a tournament matchmaker AI. Create fair head-to-head brackets pairing users of similar skill.

PARTICIPANTS (${skillProfiles.length} total):
${JSON.stringify(skillProfiles.slice(0, 20))}

Rules:
- Pair users with closest skill scores
- Create a single-elimination bracket (round 1 pairs)
- If odd number, one user gets a bye (auto-advance)
- Return array of match pairs

Return JSON: {
  "matches": [
    {"player1_id": "...", "player2_id": "...", "round": 1, "skill_delta": 0}
  ],
  "byes": ["user_id_with_bye"],
  "bracket_rounds": number
}`,
        response_json_schema: {
          type: 'object',
          properties: {
            matches: { type: 'array', items: { type: 'object' } },
            byes: { type: 'array', items: { type: 'string' } },
            bracket_rounds: { type: 'number' },
          }
        }
      });
      matchPairs = aiResult.matches || [];
    } catch (_) {
      // Fallback: simple sequential pairing
      matchPairs = [];
      for (let i = 0; i < participants.length - 1; i += 2) {
        matchPairs.push({ player1_id: participants[i].user_id, player2_id: participants[i + 1].user_id, round: 1, skill_delta: 0 });
      }
    }

    // Create TournamentMatch records
    let created = 0;
    for (const match of matchPairs) {
      if (!match.player1_id || !match.player2_id) continue;
      await base44.asServiceRole.entities.TournamentMatch.create({
        tournament_id,
        player1_id: match.player1_id,
        player2_id: match.player2_id,
        round: match.round || 1,
        skill_delta: match.skill_delta || 0,
        status: 'pending',
        scheduled_at: new Date(Date.now() + 3600000).toISOString(),
      });
      created++;
    }

    // Update tournament status to in_progress
    await base44.asServiceRole.entities.Tournament.update(tournament_id, {
      status: 'active',
      bracket_generated: true,
      bracket_generated_at: new Date().toISOString(),
    });

    return Response.json({ success: true, matches_created: created, bracket_rounds: Math.ceil(Math.log2(participants.length)) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Users, TrendingUp, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function AITournamentMatchmaking({ tournament, participants }) {
  const [generating, setGenerating] = useState(false);
  const [bracket, setBracket] = useState(null);

  const generateBracketMutation = useMutation({
    mutationFn: async () => {
      setGenerating(true);

      // Get participant stats for better matchmaking
      const participantData = await Promise.all(
        participants.map(async (p) => {
          const user = await base44.entities.User.filter({ id: p.user_id });
          const engagements = await base44.entities.GameEngagement.filter({
            user_id: p.user_id,
            game_id: tournament.game_id
          });
          
          return {
            ...p,
            user_name: user[0]?.full_name,
            skill_rating: user[0]?.gamification_points || 0,
            play_time: engagements.reduce((sum, e) => sum + (e.time_spent || 0), 0)
          };
        })
      );

      // Call AI for intelligent matchmaking
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a balanced tournament bracket with intelligent seeding.

Tournament: ${tournament.title}
Format: ${tournament.bracket_type}
Participants: ${participantData.length}

Participant Data:
${participantData.map(p => `- ${p.user_name}: ${p.skill_rating} points, ${p.play_time}m playtime`).join('\n')}

Create a balanced bracket by:
1. Seeding players based on skill level and experience
2. Ensuring competitive matches in early rounds
3. Balancing bracket to avoid mismatches
4. Generating match pairings for round 1

Return a structured bracket.`,
        response_json_schema: {
          type: 'object',
          properties: {
            seeding: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  seed: { type: 'number' },
                  participant_id: { type: 'string' },
                  rationale: { type: 'string' }
                }
              }
            },
            round1_matches: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  match_number: { type: 'number' },
                  participant1_id: { type: 'string' },
                  participant2_id: { type: 'string' },
                  predicted_competitiveness: { type: 'string' }
                }
              }
            },
            balance_score: { type: 'number' }
          }
        }
      });

      // Save bracket to database
      for (const match of result.round1_matches) {
        await base44.entities.TournamentMatch.create({
          tournament_id: tournament.id,
          round: 1,
          match_number: match.match_number,
          participant1_id: match.participant1_id,
          participant2_id: match.participant2_id,
          status: 'pending'
        });
      }

      // Update participant seeding
      for (const seed of result.seeding) {
        await base44.entities.TournamentParticipant.update(seed.participant_id, {
          seed: seed.seed
        });
      }

      return result;
    },
    onSuccess: (data) => {
      setBracket(data);
      setGenerating(false);
      toast.success('AI bracket generated successfully!');
    },
    onError: () => {
      setGenerating(false);
      toast.error('Failed to generate bracket');
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          AI-Powered Matchmaking
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!bracket ? (
          <div className="text-center py-8">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">
              Use AI to create balanced brackets with intelligent seeding
            </p>
            <p className="text-sm text-gray-500 mb-4">
              {participants.length} participants ready for matchmaking
            </p>
            <Button
              onClick={() => generateBracketMutation.mutate()}
              disabled={generating || participants.length < 2}
              className="bg-gradient-to-r from-indigo-600 to-purple-600"
            >
              <Zap className="w-4 h-4 mr-2" />
              {generating ? 'Generating Bracket...' : 'Generate AI Bracket'}
            </Button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-lg border-2 border-indigo-200">
              <div>
                <p className="font-semibold">Bracket Generated Successfully</p>
                <p className="text-sm text-gray-600">
                  {bracket.round1_matches.length} matches created for round 1
                </p>
              </div>
              <div className="text-center">
                <Badge className="bg-indigo-600 text-lg px-4 py-2">
                  {bracket.balance_score}/100
                </Badge>
                <p className="text-xs text-gray-600 mt-1">Balance Score</p>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Seeding Results</h4>
              <div className="space-y-2">
                {bracket.seeding.slice(0, 5).map((seed) => {
                  const participant = participants.find(p => p.id === seed.participant_id);
                  return (
                    <div key={seed.seed} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Badge variant="outline" className="w-8 text-center">
                        #{seed.seed}
                      </Badge>
                      <div className="flex-1">
                        <p className="font-medium">{participant?.user_name || 'Player'}</p>
                        <p className="text-xs text-gray-600">{seed.rationale}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Round 1 Matches</h4>
              <div className="grid md:grid-cols-2 gap-3">
                {bracket.round1_matches.map((match) => {
                  const p1 = participants.find(p => p.id === match.participant1_id);
                  const p2 = participants.find(p => p.id === match.participant2_id);
                  return (
                    <div key={match.match_number} className="bg-white border-2 border-gray-200 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-2">Match {match.match_number}</p>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{p1?.user_name || 'TBD'}</span>
                        <span className="text-gray-400">vs</span>
                        <span className="font-medium">{p2?.user_name || 'TBD'}</span>
                      </div>
                      <Badge variant="outline" className="mt-2 text-xs">
                        {match.predicted_competitiveness}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
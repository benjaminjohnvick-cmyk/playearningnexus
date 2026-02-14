import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Gamepad2, Trophy, Zap, Users, Star, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function CrossGameTournamentSystem() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [balancingScores, setBalancingScores] = useState(false);
  const queryClient = useQueryClient();

  const { data: crossGameTournaments = [] } = useQuery({
    queryKey: ['cross-game-tournaments'],
    queryFn: async () => {
      return await base44.entities.Tournament.filter({
        is_cross_game: true
      }, '-created_date');
    }
  });

  const { data: availableGames = [] } = useQuery({
    queryKey: ['tournament-games'],
    queryFn: async () => {
      return await base44.entities.Game.filter({ status: 'approved' });
    }
  });

  const createCrossGameTournamentMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.Tournament.create({
        ...data,
        is_cross_game: true,
        status: 'registration',
        current_round: 0
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['cross-game-tournaments']);
      setShowCreateForm(false);
      toast.success('Cross-game tournament created!');
    }
  });

  const balanceScoresWithAI = async (tournament) => {
    setBalancingScores(true);
    try {
      const participants = await base44.entities.TournamentParticipant.filter({ tournament_id: tournament.id });
      const matches = await base44.entities.TournamentMatch.filter({ tournament_id: tournament.id });
      
      // Get game difficulties and player stats
      const gameStats = {};
      for (const gameId of tournament.game_stages || []) {
        const game = await base44.entities.Game.filter({ id: gameId });
        const engagement = await base44.entities.GameEngagement.filter({ game_id: gameId });
        gameStats[gameId] = {
          avgScore: engagement.reduce((sum, e) => sum + (e.score || 0), 0) / engagement.length || 100,
          difficulty: game[0]?.difficulty_level || 'medium'
        };
      }

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Balance tournament scores across different games:

Tournament: ${tournament.title}
Games: ${JSON.stringify(tournament.game_stages)}
Game Stats: ${JSON.stringify(gameStats)}

Create a balanced scoring system that:
1. Normalizes scores across different game difficulties
2. Accounts for game-specific mechanics
3. Provides fair competition across all stages
4. Suggests weight multipliers per game`,
        response_json_schema: {
          type: "object",
          properties: {
            score_multipliers: {
              type: "object",
              additionalProperties: { type: "number" }
            },
            normalization_formula: { type: "string" },
            challenge_adjustments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  game_id: { type: "string" },
                  suggested_challenge: { type: "string" }
                }
              }
            }
          }
        }
      });

      // Update tournament with AI-balanced scoring
      await base44.entities.Tournament.update(tournament.id, {
        score_multipliers: result.score_multipliers,
        normalization_formula: result.normalization_formula,
        ai_balanced: true
      });

      toast.success('AI balancing applied!');
    } catch (error) {
      toast.error('Failed to balance scores');
    }
    setBalancingScores(false);
  };

  const { data: unifiedLeaderboard } = useQuery({
    queryKey: ['unified-leaderboard', selectedTournament?.id],
    queryFn: async () => {
      if (!selectedTournament) return [];
      
      const participants = await base44.entities.TournamentParticipant.filter({ 
        tournament_id: selectedTournament.id 
      });
      
      // Calculate unified scores across all games
      const leaderboard = await Promise.all(participants.map(async (p) => {
        const matches = await base44.entities.TournamentMatch.filter({
          tournament_id: selectedTournament.id,
          $or: [{ participant1_id: p.user_id }, { participant2_id: p.user_id }]
        });
        
        let totalScore = 0;
        let gamesPlayed = 0;
        
        for (const match of matches) {
          const score = match.participant1_id === p.user_id ? match.participant1_score : match.participant2_score;
          const gameId = match.game_id;
          const multiplier = selectedTournament.score_multipliers?.[gameId] || 1;
          
          totalScore += score * multiplier;
          gamesPlayed++;
        }
        
        // Fetch achievements for bonus points
        const achievements = await base44.entities.Achievement.filter({ user_id: p.user_id });
        const achievementBonus = achievements.length * 10;
        
        return {
          ...p,
          unified_score: totalScore + achievementBonus,
          games_played: gamesPlayed,
          achievement_bonus: achievementBonus
        };
      }));
      
      return leaderboard.sort((a, b) => b.unified_score - a.unified_score);
    },
    enabled: !!selectedTournament
  });

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-6 h-6" />
              Cross-Game Tournament System
            </div>
            <Button variant="secondary" onClick={() => setShowCreateForm(true)}>
              Create Tournament
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <p className="text-gray-600 mb-4">
            Multi-stage tournaments where players compete across different games with unified scoring and leaderboards.
          </p>
        </CardContent>
      </Card>

      {/* Active Cross-Game Tournaments */}
      <div className="grid md:grid-cols-2 gap-6">
        {crossGameTournaments.map((tournament) => (
          <Card key={tournament.id} className="border-2 border-purple-200">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
              <CardTitle className="flex items-center justify-between">
                <span>{tournament.title}</span>
                {tournament.ai_balanced && (
                  <Badge className="bg-purple-600">
                    <Sparkles className="w-3 h-3 mr-1" />
                    AI Balanced
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Gamepad2 className="w-4 h-4" />
                <span className="text-sm text-gray-600">
                  {tournament.game_stages?.length || 0} Games
                </span>
                <Users className="w-4 h-4 ml-3" />
                <span className="text-sm text-gray-600">
                  {tournament.current_participants}/{tournament.max_participants} Players
                </span>
              </div>
              
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="w-4 h-4 text-yellow-600" />
                  <span className="font-semibold text-sm">Prize Pool</span>
                </div>
                <p className="text-lg font-bold text-yellow-900">
                  ${tournament.prize_pool_amount}
                </p>
              </div>

              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  className="flex-1"
                  onClick={() => setSelectedTournament(tournament)}
                >
                  View Leaderboard
                </Button>
                {!tournament.ai_balanced && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => balanceScoresWithAI(tournament)}
                    disabled={balancingScores}
                  >
                    {balancingScores ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Unified Leaderboard Dialog */}
      <Dialog open={!!selectedTournament} onOpenChange={() => setSelectedTournament(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Unified Tournament Leaderboard
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {unifiedLeaderboard?.map((player, idx) => (
              <div key={player.id} className={`p-4 rounded-lg ${idx < 3 ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-bold text-gray-400">#{idx + 1}</div>
                    <div>
                      <p className="font-semibold">{player.user_id}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-600">
                        <span>{player.games_played} games</span>
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-600" />
                          +{player.achievement_bonus} bonus
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-purple-600">{player.unified_score}</p>
                    <p className="text-xs text-gray-500">points</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Tournament Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Cross-Game Tournament</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const selectedGames = Array.from(formData.getAll('games'));
            
            createCrossGameTournamentMutation.mutate({
              title: formData.get('title'),
              description: formData.get('description'),
              max_participants: parseInt(formData.get('max_participants')),
              prize_pool_amount: parseFloat(formData.get('prize')),
              prize_pool_type: 'virtual_currency',
              game_stages: selectedGames,
              start_time: new Date(formData.get('start')).toISOString(),
              registration_end: new Date(formData.get('reg_end')).toISOString()
            });
          }} className="space-y-4">
            <Input name="title" placeholder="Tournament Name" required />
            <Input name="description" placeholder="Description" />
            <Input name="max_participants" type="number" placeholder="Max Participants" defaultValue="32" required />
            <Input name="prize" type="number" step="0.01" placeholder="Prize Pool ($)" required />
            <Input name="start" type="datetime-local" required />
            <Input name="reg_end" type="datetime-local" required />
            
            <div>
              <label className="text-sm font-medium mb-2 block">Select Games for Tournament Stages</label>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                {availableGames.map((game) => (
                  <label key={game.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input type="checkbox" name="games" value={game.id} />
                    <span className="text-sm">{game.title}</span>
                    <Badge className="ml-auto">{game.category}</Badge>
                  </label>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full">Create Tournament</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Zap, Award } from "lucide-react";
import { toast } from "sonner";

export default function AutomatedBracketSystem({ tournament, participants }) {
  const [generating, setGenerating] = useState(false);
  const queryClient = useQueryClient();

  const generateBracketMutation = useMutation({
    mutationFn: async () => {
      setGenerating(true);
      
      // Shuffle and seed participants
      const shuffled = [...participants].sort(() => Math.random() - 0.5);
      const seeded = shuffled.map((p, idx) => ({
        ...p,
        seed: idx + 1
      }));

      // Update seeds
      for (const participant of seeded) {
        await base44.entities.TournamentParticipant.update(participant.id, {
          seed: participant.seed
        });
      }

      // Generate bracket based on format
      const rounds = Math.ceil(Math.log2(participants.length));
      let matchNumber = 1;

      for (let round = 1; round <= rounds; round++) {
        const matchesInRound = Math.pow(2, rounds - round);
        
        for (let i = 0; i < matchesInRound; i++) {
          const p1Idx = i * 2;
          const p2Idx = i * 2 + 1;
          
          if (p1Idx < seeded.length && p2Idx < seeded.length) {
            await base44.entities.TournamentMatch.create({
              tournament_id: tournament.id,
              round,
              match_number: matchNumber++,
              participant1_id: seeded[p1Idx].user_id,
              participant2_id: seeded[p2Idx].user_id,
              status: round === 1 ? 'pending' : 'pending'
            });
          }
        }
      }

      await base44.entities.Tournament.update(tournament.id, {
        status: 'in_progress',
        current_round: 1
      });

      setGenerating(false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tournament-matches']);
      toast.success('Bracket generated!');
    }
  });

  const distributePrizesMutation = useMutation({
    mutationFn: async () => {
      const sortedParticipants = [...participants].sort((a, b) => (b.wins || 0) - (a.wins || 0));
      const winners = sortedParticipants.slice(0, 3);
      
      const prizeDistribution = tournament.prize_distribution || { first: 0.5, second: 0.3, third: 0.2 };
      const prizes = [
        { participant: winners[0], amount: tournament.prize_pool_amount * prizeDistribution.first, place: 1, points: 500 },
        { participant: winners[1], amount: tournament.prize_pool_amount * prizeDistribution.second, place: 2, points: 300 },
        { participant: winners[2], amount: tournament.prize_pool_amount * prizeDistribution.third, place: 3, points: 200 }
      ];

      for (const { participant, amount, place, points } of prizes) {
        if (!participant) continue;

        // Update placement
        await base44.entities.TournamentParticipant.update(participant.id, {
          placement: place,
          status: place === 1 ? 'winner' : 'eliminated'
        });

        // Award currency/money
        if (tournament.prize_pool_type === 'virtual_currency') {
          const user = await base44.entities.User.filter({ id: participant.user_id });
          await base44.entities.User.update(participant.user_id, {
            virtual_currency: (user[0].virtual_currency || 0) + amount
          });
        } else if (tournament.prize_pool_type === 'real_money') {
          const user = await base44.entities.User.filter({ id: participant.user_id });
          await base44.entities.User.update(participant.user_id, {
            current_balance: (user[0].current_balance || 0) + amount
          });
        }

        // Award gamification points
        const user = await base44.entities.User.filter({ id: participant.user_id });
        await base44.entities.User.update(participant.user_id, {
          gamification_points: (user[0].gamification_points || 0) + points
        });

        // Create achievement badge for winner
        if (place === 1) {
          await base44.entities.Achievement.create({
            user_id: participant.user_id,
            title: `${tournament.title} Champion`,
            description: `Won 1st place in ${tournament.title}`,
            icon: 'trophy',
            points_awarded: points,
            is_unlocked: true
          });
        }

        // Record transaction
        await base44.entities.Transaction.create({
          user_id: participant.user_id,
          amount,
          transaction_type: 'tournament_prize',
          currency: tournament.prize_pool_type === 'virtual_currency' ? 'CREDITS' : 'USD',
          status: 'completed',
          notes: `${tournament.title} - Place #${place}`
        });

        // Activity log
        await base44.entities.UserActivity.create({
          user_id: participant.user_id,
          activity_type: 'tournament_participated',
          points_earned: points,
          description: `Placed #${place} in ${tournament.title}`,
          related_entity_id: tournament.id
        });
      }

      // Update tournament status
      await base44.entities.Tournament.update(tournament.id, {
        status: 'completed',
        winner_user_id: winners[0]?.user_id,
        end_time: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Prizes distributed!');
    }
  });

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-6 h-6" />
          Automated Tournament Management
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-700 mb-3">
            <strong>Participants:</strong> {participants.length}/{tournament.max_participants}
          </p>
          <p className="text-sm text-gray-700">
            <strong>Format:</strong> {tournament.bracket_type.replace('_', ' ')}
          </p>
        </div>

        {tournament.status === 'registration' && (
          <Button
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600"
            onClick={() => generateBracketMutation.mutate()}
            disabled={generating || participants.length < 2}
          >
            <Zap className="w-4 h-4 mr-2" />
            {generating ? 'Generating...' : 'Generate Bracket & Start Tournament'}
          </Button>
        )}

        {tournament.status === 'in_progress' && (
          <Button
            className="w-full bg-gradient-to-r from-yellow-600 to-orange-600"
            onClick={() => distributePrizesMutation.mutate()}
          >
            <Award className="w-4 h-4 mr-2" />
            Distribute Prizes & Complete
          </Button>
        )}

        <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Prize Distribution
          </h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>🥇 1st Place:</span>
              <span className="font-semibold">${(tournament.prize_pool_amount * 0.5).toFixed(0)} + 500 pts</span>
            </div>
            <div className="flex justify-between">
              <span>🥈 2nd Place:</span>
              <span className="font-semibold">${(tournament.prize_pool_amount * 0.3).toFixed(0)} + 300 pts</span>
            </div>
            <div className="flex justify-between">
              <span>🥉 3rd Place:</span>
              <span className="font-semibold">${(tournament.prize_pool_amount * 0.2).toFixed(0)} + 200 pts</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
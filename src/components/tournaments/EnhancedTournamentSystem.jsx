import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Users, Crown, Medal, DollarSign, Swords } from "lucide-react";
import { toast } from "sonner";

export default function EnhancedTournamentSystem({ tournament, user }) {
  const [scoreUpdate, setScoreUpdate] = useState({ participantId: '', score: 0 });
  const queryClient = useQueryClient();

  const { data: participants = [] } = useQuery({
    queryKey: ['tournament-participants', tournament?.id],
    queryFn: async () => {
      const parts = await base44.entities.TournamentParticipant.filter({
        tournament_id: tournament.id
      });
      
      const userIds = parts.map(p => p.user_id);
      const users = userIds.length > 0 ? await base44.entities.User.filter({
        id: { $in: userIds }
      }) : [];
      
      return parts.map(p => ({
        ...p,
        user: users.find(u => u.id === p.user_id)
      }));
    },
    enabled: !!tournament
  });

  const { data: matches = [] } = useQuery({
    queryKey: ['tournament-matches', tournament?.id],
    queryFn: async () => {
      return await base44.entities.TournamentMatch.filter({
        tournament_id: tournament.id
      }, 'round');
    },
    enabled: !!tournament
  });

  const joinTournamentMutation = useMutation({
    mutationFn: async () => {
      if (participants.length >= tournament.max_participants) {
        throw new Error('Tournament is full');
      }

      return await base44.entities.TournamentParticipant.create({
        tournament_id: tournament.id,
        user_id: user.id,
        seed: participants.length + 1,
        status: 'registered'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tournament-participants']);
      toast.success('Joined tournament!');
    },
    onError: (error) => toast.error(error.message)
  });

  const updateScoreMutation = useMutation({
    mutationFn: async ({ matchId, participant1Score, participant2Score }) => {
      const match = matches.find(m => m.id === matchId);
      if (!match) throw new Error('Match not found');

      const winnerId = participant1Score > participant2Score 
        ? match.participant1_id 
        : match.participant2_id;

      await base44.entities.TournamentMatch.update(matchId, {
        participant1_score: participant1Score,
        participant2_score: participant2Score,
        winner_id: winnerId,
        status: 'completed',
        completed_time: new Date().toISOString()
      });

      // Update participant records
      const winner = participants.find(p => p.user_id === winnerId);
      if (winner) {
        await base44.entities.TournamentParticipant.update(winner.id, {
          wins: (winner.wins || 0) + 1
        });
      }

      return { winnerId, matchId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tournament-matches']);
      queryClient.invalidateQueries(['tournament-participants']);
      toast.success('Score updated!');
    }
  });

  const distributePrizesMutation = useMutation({
    mutationFn: async () => {
      const sortedParticipants = [...participants]
        .sort((a, b) => (b.wins || 0) - (a.wins || 0))
        .slice(0, 3);

      const distribution = tournament.prize_distribution || {
        first: 0.5,
        second: 0.3,
        third: 0.2
      };

      const prizes = [
        { participant: sortedParticipants[0], amount: tournament.prize_pool_amount * distribution.first, place: 1 },
        { participant: sortedParticipants[1], amount: tournament.prize_pool_amount * distribution.second, place: 2 },
        { participant: sortedParticipants[2], amount: tournament.prize_pool_amount * distribution.third, place: 3 }
      ];

      for (const { participant, amount, place } of prizes) {
        if (!participant) continue;

        await base44.entities.TournamentParticipant.update(participant.id, {
          placement: place,
          status: place === 1 ? 'winner' : 'eliminated'
        });

        if (tournament.prize_pool_type === 'virtual_currency') {
          await base44.auth.updateMe({
            virtual_currency: (participant.user.virtual_currency || 0) + amount
          });
        }

        await base44.entities.Transaction.create({
          user_id: participant.user_id,
          amount,
          transaction_type: 'tournament_prize',
          currency: tournament.prize_pool_type === 'virtual_currency' ? 'CREDITS' : 'USD',
          status: 'completed'
        });

        await base44.entities.UserActivity.create({
          user_id: participant.user_id,
          activity_type: 'tournament_participated',
          points_earned: place === 1 ? 500 : place === 2 ? 300 : 200,
          description: `Placed #${place} in ${tournament.title}`
        });
      }

      await base44.entities.Tournament.update(tournament.id, {
        status: 'completed',
        winner_user_id: sortedParticipants[0]?.user_id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Prizes distributed!');
    }
  });

  const isHost = tournament.host_user_id === user.id;
  const isParticipant = participants.some(p => p.user_id === user.id);
  const leaderboard = [...participants].sort((a, b) => (b.wins || 0) - (a.wins || 0));

  return (
    <div className="space-y-6">
      {/* Tournament Header */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-3xl font-bold mb-2">{tournament.title}</h2>
              <p className="text-purple-100">{tournament.description}</p>
            </div>
            <Trophy className="w-16 h-16 opacity-50" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/20 p-3 rounded-lg backdrop-blur-sm">
              <p className="text-sm text-purple-100">Prize Pool</p>
              <p className="text-2xl font-bold">${tournament.prize_pool_amount}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg backdrop-blur-sm">
              <p className="text-sm text-purple-100">Participants</p>
              <p className="text-2xl font-bold">{participants.length}/{tournament.max_participants}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg backdrop-blur-sm">
              <p className="text-sm text-purple-100">Format</p>
              <p className="text-lg font-bold capitalize">{tournament.bracket_type.replace('_', ' ')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Join/Actions */}
      {!isParticipant && tournament.status === 'registration' && (
        <Button
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600"
          onClick={() => joinTournamentMutation.mutate()}
        >
          <Trophy className="w-4 h-4 mr-2" />
          Join Tournament
        </Button>
      )}

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {leaderboard.map((participant, idx) => (
              <div key={participant.id} className={`flex items-center justify-between p-4 rounded-lg ${
                idx === 0 ? 'bg-yellow-50 border-2 border-yellow-500' :
                idx === 1 ? 'bg-gray-100 border-2 border-gray-400' :
                idx === 2 ? 'bg-orange-50 border-2 border-orange-400' :
                'bg-gray-50'
              }`}>
                <div className="flex items-center gap-3">
                  {idx === 0 && <Crown className="w-6 h-6 text-yellow-500" />}
                  {idx === 1 && <Medal className="w-6 h-6 text-gray-500" />}
                  {idx === 2 && <Medal className="w-6 h-6 text-orange-500" />}
                  <span className="font-bold text-xl">#{idx + 1}</span>
                  <span className="font-semibold">{participant.user?.full_name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <Badge>{participant.wins || 0} wins</Badge>
                  <Badge variant="outline">{participant.losses || 0} losses</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bracket Matches */}
      {matches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Bracket</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...new Set(matches.map(m => m.round))].map(round => (
                <div key={round}>
                  <h4 className="font-bold mb-3">Round {round}</h4>
                  <div className="space-y-2">
                    {matches.filter(m => m.round === round).map(match => (
                      <div key={match.id} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold">Match {match.match_number}</span>
                          <Badge className={
                            match.status === 'completed' ? 'bg-green-100 text-green-700' :
                            match.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-200'
                          }>
                            {match.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className={`p-2 rounded ${match.winner_id === match.participant1_id ? 'bg-green-100 border-2 border-green-500' : 'bg-white'}`}>
                            <p className="text-sm font-medium">
                              {participants.find(p => p.user_id === match.participant1_id)?.user?.full_name || 'TBD'}
                            </p>
                            <p className="text-lg font-bold">{match.participant1_score || 0}</p>
                          </div>
                          <div className={`p-2 rounded ${match.winner_id === match.participant2_id ? 'bg-green-100 border-2 border-green-500' : 'bg-white'}`}>
                            <p className="text-sm font-medium">
                              {participants.find(p => p.user_id === match.participant2_id)?.user?.full_name || 'TBD'}
                            </p>
                            <p className="text-lg font-bold">{match.participant2_score || 0}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Host Controls */}
      {isHost && tournament.status === 'in_progress' && (
        <Card>
          <CardHeader>
            <CardTitle>Tournament Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full bg-gradient-to-r from-yellow-600 to-orange-600"
              onClick={() => distributePrizesMutation.mutate()}
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Distribute Prizes & End Tournament
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
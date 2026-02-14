import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Trophy, Medal, Users, Briefcase, TrendingUp } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function ContestLeaderboard({ contestId, currentUserId }) {
  const { data: participations = [], isLoading } = useQuery({
    queryKey: ['leaderboard', contestId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const parts = await base44.entities.ContestParticipation.filter({ date: today });
      return parts.sort((a, b) => (b.users_referred + b.businesses_referred) - (a.users_referred + a.businesses_referred));
    },
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  const userReferrals = participations
    .filter(p => p.users_referred > 0)
    .sort((a, b) => b.users_referred - a.users_referred)
    .slice(0, 10);

  const businessReferrals = participations
    .filter(p => p.businesses_referred > 0)
    .sort((a, b) => b.businesses_referred - a.businesses_referred)
    .slice(0, 10);

  const getRankBadge = (index) => {
    if (index === 0) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (index === 1) return <Medal className="w-5 h-5 text-gray-400" />;
    if (index === 2) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="text-gray-500 font-semibold">#{index + 1}</span>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Referrals Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            User Referrals Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {userReferrals.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No user referrals yet</p>
            ) : (
              userReferrals.map((participant, index) => {
                const isCurrentUser = participant.user_id === currentUserId;
                return (
                  <div
                    key={participant.id}
                    className={`flex items-center justify-between p-4 rounded-lg ${
                      isCurrentUser ? 'bg-blue-50 border-2 border-blue-500' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 flex justify-center">
                        {getRankBadge(index)}
                      </div>
                      <Avatar>
                        <AvatarFallback>U{index + 1}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {isCurrentUser ? 'You' : `Participant ${participant.user_id.slice(0, 8)}`}
                        </p>
                        <p className="text-sm text-gray-500">
                          {participant.users_referred} referrals
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">
                        ${(participant.users_referred * 0.25).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">Potential earnings</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Business Referrals Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-purple-600" />
            Business Referrals Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {businessReferrals.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No business referrals yet</p>
            ) : (
              businessReferrals.map((participant, index) => {
                const isCurrentUser = participant.user_id === currentUserId;
                return (
                  <div
                    key={participant.id}
                    className={`flex items-center justify-between p-4 rounded-lg ${
                      isCurrentUser ? 'bg-purple-50 border-2 border-purple-500' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 flex justify-center">
                        {getRankBadge(index)}
                      </div>
                      <Avatar>
                        <AvatarFallback>B{index + 1}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {isCurrentUser ? 'You' : `Participant ${participant.user_id.slice(0, 8)}`}
                        </p>
                        <p className="text-sm text-gray-500">
                          {participant.businesses_referred} referrals
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-purple-600">
                        ${(participant.businesses_referred * 0.50).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">Potential earnings</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Summary */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
        <CardContent className="p-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <TrendingUp className="w-6 h-6 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">{participations.length}</p>
              <p className="text-sm text-gray-600">Total Participants</p>
            </div>
            <div>
              <Users className="w-6 h-6 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">
                {participations.reduce((sum, p) => sum + (p.users_referred || 0), 0)}
              </p>
              <p className="text-sm text-gray-600">Total User Referrals</p>
            </div>
            <div>
              <Briefcase className="w-6 h-6 text-purple-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">
                {participations.reduce((sum, p) => sum + (p.businesses_referred || 0), 0)}
              </p>
              <p className="text-sm text-gray-600">Total Business Referrals</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Crown, Medal, Star, TrendingUp } from 'lucide-react';

const RANK_CONFIG = {
  1: { icon: '🥇', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-300', perk: 'Priority Survey Access + $5 Bonus' },
  2: { icon: '🥈', color: 'text-gray-500',   bg: 'bg-gray-50 border-gray-300',     perk: 'VIP Survey Pool + $3 Bonus' },
  3: { icon: '🥉', color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-300',   perk: 'High-Value Surveys + $1 Bonus' },
};

export default function GamificationLeaderboard({ currentUserId }) {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['leaderboard_users'],
    queryFn: () => base44.entities.User.list('-total_earnings', 50),
    staleTime: 1000 * 60 * 5,
  });

  const rankedUsers = users
    .filter(u => (u.total_earnings || 0) > 0)
    .slice(0, 20);

  const myRank = rankedUsers.findIndex(u => u.id === currentUserId) + 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="w-5 h-5 text-yellow-600" />
          Earnings Leaderboard
          {myRank > 0 && (
            <Badge className="bg-blue-600 ml-auto">Your Rank: #{myRank}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Top 3 Perks Banner */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[1, 2, 3].map(rank => (
            <div key={rank} className={`p-2 rounded-lg border text-center text-xs ${RANK_CONFIG[rank].bg}`}>
              <p className="text-lg">{RANK_CONFIG[rank].icon}</p>
              <p className="font-bold text-gray-700">#{rank}</p>
              <p className="text-gray-500 text-[10px] mt-0.5">{RANK_CONFIG[rank].perk}</p>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-1.5">
            {rankedUsers.map((u, idx) => {
              const rank = idx + 1;
              const isMe = u.id === currentUserId;
              const config = RANK_CONFIG[rank];
              return (
                <div
                  key={u.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg text-xs transition-all ${
                    isMe ? 'bg-blue-50 border-2 border-blue-400 font-bold' :
                    config ? `${config.bg} border` :
                    'bg-gray-50'
                  }`}
                >
                  <span className="w-6 text-center font-bold text-gray-600">
                    {config ? config.icon : `#${rank}`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold truncate ${isMe ? 'text-blue-700' : 'text-gray-800'}`}>
                      {u.full_name || 'Anonymous'} {isMe && '(You)'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-green-700">${(u.total_earnings || 0).toFixed(2)}</p>
                    {config && <p className="text-[10px] text-purple-600 font-medium">🎁 Perk Active</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs">
          <p className="font-bold text-purple-700 mb-1">🏆 Leaderboard Perks</p>
          <p className="text-purple-600">Top earners unlock real financial perks: priority surveys, cash bonuses, and VIP status. Resets monthly.</p>
        </div>
      </CardContent>
    </Card>
  );
}
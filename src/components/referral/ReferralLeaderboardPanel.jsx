import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, Medal } from 'lucide-react';

const MEDAL_COLORS = ['text-yellow-500', 'text-gray-400', 'text-orange-400'];
const RANK_BG = ['bg-yellow-50 border-yellow-200', 'bg-gray-50 border-gray-200', 'bg-orange-50 border-orange-200'];

export default function ReferralLeaderboardPanel({ currentUserId }) {
  const { data: allReferrals = [] } = useQuery({
    queryKey: ['all-referrals-leaderboard'],
    queryFn: () => base44.entities.Referral.list('-commission_earned', 100),
  });

  // Aggregate referrals per referrer
  const leaderMap = {};
  allReferrals.forEach(r => {
    if (!r.referrer_user_id) return;
    if (!leaderMap[r.referrer_user_id]) {
      leaderMap[r.referrer_user_id] = { user_id: r.referrer_user_id, count: 0, commission: 0 };
    }
    leaderMap[r.referrer_user_id].count += 1;
    leaderMap[r.referrer_user_id].commission += r.commission_earned || 0;
  });

  const leaderboard = Object.values(leaderMap)
    .sort((a, b) => b.commission - a.commission)
    .slice(0, 10);

  const myRank = leaderboard.findIndex(l => l.user_id === currentUserId) + 1;

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" /> Referral Leaderboard
          {myRank > 0 && (
            <Badge className="ml-auto bg-purple-100 text-purple-700">You: #{myRank}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {leaderboard.length === 0 ? (
          <p className="text-center text-gray-400 py-6">No referral data yet — be the first!</p>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((entry, i) => {
              const isMe = entry.user_id === currentUserId;
              const rank = i + 1;
              return (
                <div
                  key={entry.user_id}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                    isMe ? 'border-purple-400 bg-purple-50' :
                    rank <= 3 ? RANK_BG[rank - 1] : 'border-gray-100 bg-white'
                  }`}
                >
                  <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                    {rank <= 3 ? (
                      <Medal className={`w-6 h-6 ${MEDAL_COLORS[rank - 1]}`} />
                    ) : (
                      <span className="text-sm font-bold text-gray-400">#{rank}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-800">
                        {isMe ? '⭐ You' : `User ${entry.user_id.slice(0, 6).toUpperCase()}`}
                      </p>
                      {isMe && <Badge className="text-xs bg-purple-200 text-purple-800">You</Badge>}
                    </div>
                    <p className="text-xs text-gray-500">{entry.count} referrals</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-green-600">${entry.commission.toFixed(2)}</p>
                    <p className="text-xs text-gray-400">earned</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {leaderboard.length > 0 && (
          <div className="mt-4 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl border border-yellow-200">
            <p className="text-xs text-yellow-800 font-semibold">🏆 Top referrers qualify for monthly contest prizes. Keep referring to climb the leaderboard!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
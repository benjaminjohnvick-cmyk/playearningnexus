import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Clock, Crown, Users, DollarSign, Flame } from 'lucide-react';
import { formatDistanceToNow, isPast } from 'date-fns';

export default function ContestLeaderboardWidget({ user }) {
  const { data: contests = [] } = useQuery({
    queryKey: ['active-contests'],
    queryFn: () => base44.entities.ReferralContest.filter({ status: 'active', is_visible_to_users: true }),
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ['all-referrals-contest-widget'],
    queryFn: () => base44.entities.Referral.list('-created_date', 500),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-contest-widget'],
    queryFn: () => base44.entities.User.list('-created_date', 200),
  });

  const getLeaderboard = (contest) => {
    const start = new Date(contest.start_date);
    const end = new Date(contest.end_date);
    const inRange = referrals.filter(r => {
      const d = new Date(r.created_date);
      return d >= start && d <= end;
    });
    const map = {};
    inRange.forEach(r => {
      if (!r.referrer_user_id) return;
      if (!map[r.referrer_user_id]) map[r.referrer_user_id] = { user_id: r.referrer_user_id, count: 0, commission: 0 };
      map[r.referrer_user_id].count++;
      map[r.referrer_user_id].commission += r.commission_earned || 0;
    });
    return Object.values(map)
      .sort((a, b) => contest.metric === 'commission_earned' ? b.commission - a.commission : b.count - a.count)
      .slice(0, 10);
  };

  const getUserName = (userId) => {
    const u = allUsers.find(u => u.id === userId);
    return u?.full_name || u?.email?.split('@')[0] || `User ${userId?.slice(0, 6)}`;
  };

  const getRankEmoji = (i) => ['🥇', '🥈', '🥉'][i] || `#${i + 1}`;

  if (contests.length === 0) return null;

  return (
    <div className="space-y-4">
      {contests.map(contest => {
        const lb = getLeaderboard(contest);
        const myRank = lb.findIndex(e => e.user_id === user?.id);
        const myEntry = lb[myRank];
        const timeLeft = !isPast(new Date(contest.end_date)) ? formatDistanceToNow(new Date(contest.end_date), { addSuffix: false }) : null;

        return (
          <Card key={contest.id} className="border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-orange-50 shadow-md">
            {contest.banner_url && (
              <img src={contest.banner_url} alt={contest.title} className="w-full h-28 object-cover rounded-t-xl" />
            )}
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base text-gray-900">
                    <Trophy className="w-5 h-5 text-yellow-600" /> {contest.title}
                  </CardTitle>
                  {contest.description && <p className="text-xs text-gray-500 mt-0.5">{contest.description}</p>}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-green-100 text-green-800"><Flame className="w-3 h-3 mr-1" /> Live</Badge>
                  {timeLeft && <Badge variant="outline" className="text-xs"><Clock className="w-3 h-3 mr-1" />{timeLeft} left</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {/* Prize Tiers */}
              {contest.prize_tiers?.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {contest.prize_tiers.map((t, i) => (
                    <div key={i} className="bg-white border border-yellow-200 rounded-lg px-2.5 py-1.5 text-xs shadow-sm">
                      <span className="font-semibold">{t.label}</span>
                      {t.prize_amount > 0 && <span className="text-green-700 font-bold ml-1">${t.prize_amount}</span>}
                      {t.prize && !t.prize_amount && <span className="text-gray-600 ml-1">{t.prize}</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* My Rank */}
              {myEntry && (
                <div className="bg-blue-600 text-white rounded-xl px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4" />
                    <span className="font-bold text-sm">Your Rank: #{myRank + 1}</span>
                  </div>
                  <span className="font-bold">
                    {contest.metric === 'commission_earned' ? `$${myEntry.commission.toFixed(2)}` : `${myEntry.count} referrals`}
                  </span>
                </div>
              )}

              {/* Leaderboard */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> Leaderboard
                </p>
                {lb.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No entries yet — be the first to refer!</p>
                ) : (
                  <div className="space-y-1.5">
                    {lb.slice(0, 5).map((entry, i) => (
                      <div key={entry.user_id} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${entry.user_id === user?.id ? 'bg-blue-50 border border-blue-200 font-semibold' : 'bg-white border border-gray-100'}`}>
                        <span className="flex items-center gap-2 text-gray-800">
                          <span className="text-base">{getRankEmoji(i)}</span>
                          {getUserName(entry.user_id)}
                          {entry.user_id === user?.id && <Badge className="text-xs bg-blue-100 text-blue-800">You</Badge>}
                        </span>
                        <span className="font-bold text-gray-900">
                          {contest.metric === 'commission_earned' ? `$${entry.commission.toFixed(2)}` : `${entry.count}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
import React, { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Crown, Medal, Award, Flame, Gift, Users, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const WEEKLY_PRIZES = [
  { rank: 1, label: '1st', prize: '$150', color: 'from-yellow-400 to-amber-500', icon: Crown, ring: 'ring-yellow-400', bg: 'bg-yellow-50 border-yellow-300' },
  { rank: 2, label: '2nd', prize: '$75',  color: 'from-gray-300 to-slate-400',   icon: Medal, ring: 'ring-gray-300',   bg: 'bg-gray-50 border-gray-300' },
  { rank: 3, label: '3rd', prize: '$30',  color: 'from-amber-600 to-orange-700', icon: Award, ring: 'ring-amber-400',  bg: 'bg-amber-50 border-amber-300' },
];

const TROPHY_BADGES = ['👑 Top Recruiter', '🥈 Elite Referrer', '🥉 Pro Recruiter'];

export default function ReferralConquestLeaderboard({ user }) {
  const qc = useQueryClient();

  const { data: allReferrals = [] } = useQuery({
    queryKey: ['conquest-referrals'],
    queryFn: () => base44.entities.Referral.list('-created_date', 300),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // Build weekly leaderboard — referrals created in last 7 days
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const leaderboard = React.useMemo(() => {
    const map = {};
    allReferrals.forEach(r => {
      if (!r.referrer_user_id) return;
      const isThisWeek = r.created_date >= weekAgo;
      if (!map[r.referrer_user_id]) map[r.referrer_user_id] = {
        user_id: r.referrer_user_id,
        weekly: 0,
        total: 0,
        commission: 0,
        name: r.referrer_name || `User …${r.referrer_user_id.slice(-4)}`,
      };
      if (r.status === 'active') {
        map[r.referrer_user_id].total++;
        if (isThisWeek) map[r.referrer_user_id].weekly++;
      }
      map[r.referrer_user_id].commission += r.commission_earned || 0;
    });
    return Object.values(map).sort((a, b) => b.weekly - a.weekly).slice(0, 10);
  }, [allReferrals]);

  const myEntry = leaderboard.find(e => e.user_id === user?.id);
  const myRank = myEntry ? leaderboard.indexOf(myEntry) + 1 : null;

  const claimTrophy = useMutation({
    mutationFn: async () => {
      if (!myRank || myRank > 3) throw new Error('Only top 3 can claim trophies');
      const prize = myRank === 1 ? 150 : myRank === 2 ? 75 : 30;
      await base44.entities.Payout.create({
        user_id: user.id,
        recipient_email: user.email,
        amount: prize,
        currency: 'USD',
        method: 'paypal',
        payout_type: 'contest_win',
        status: 'pending',
        description: `Referral Conquest Weekly #${myRank} — $${prize} trophy prize`,
      });
      const badge = TROPHY_BADGES[myRank - 1];
      const existing = user.badges || [];
      if (!existing.includes(badge)) {
        await base44.auth.updateMe({ badges: [...existing, badge] });
      }
    },
    onSuccess: () => toast.success('🏆 Trophy claimed! Payout processing to your PayPal.'),
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card className="border-0 shadow-xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-yellow-500 to-orange-600 text-white pb-4">
        <CardTitle className="flex items-center gap-2 text-white">
          <Trophy className="w-5 h-5" /> Referral Conquest — Weekly Leaderboard
          <Badge className="ml-auto bg-white/20 text-white animate-pulse border-0">
            <Flame className="w-3 h-3 mr-1" /> Live
          </Badge>
        </CardTitle>
        <p className="text-yellow-100 text-sm">Top 3 referrers this week earn cash prizes + trophy badges 🏆</p>
      </CardHeader>

      {/* Top 3 podium */}
      <div className="grid grid-cols-3 gap-3 p-4 bg-gradient-to-b from-yellow-50 to-white border-b">
        {WEEKLY_PRIZES.map(({ rank, label, prize, color, icon: RankIcon, ring, bg }) => {
          const entry = leaderboard[rank - 1];
          const isMe = entry?.user_id === user?.id;
          return (
            <motion.div
              key={rank}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: rank === 1 ? -8 : 0 }}
              className={`rounded-xl border-2 p-3 text-center ${bg} ${isMe ? `ring-2 ${ring}` : ''}`}
            >
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${color} flex items-center justify-center mx-auto mb-2 shadow-md`}>
                <RankIcon className="w-5 h-5 text-white" />
              </div>
              {entry ? (
                <>
                  <p className="text-xs font-bold text-gray-800 truncate">{isMe ? 'You' : entry.name}</p>
                  <p className="text-lg font-black text-gray-900">{entry.weekly}</p>
                  <p className="text-xs text-gray-500">this week</p>
                </>
              ) : (
                <p className="text-xs text-gray-400 mt-2">No entries</p>
              )}
              <p className="text-green-600 font-black text-sm mt-1">{prize}</p>
              <p className="text-xs text-gray-400">{label} prize</p>
            </motion.div>
          );
        })}
      </div>

      <CardContent className="p-4 space-y-2">
        {/* My position */}
        {user && myEntry && (
          <div className={`flex items-center justify-between rounded-xl px-4 py-3 border-2 mb-3 ${myRank <= 3 ? 'bg-green-50 border-green-300' : 'bg-blue-50 border-blue-200'}`}>
            <div className="flex items-center gap-3">
              <span className="font-black text-lg text-gray-700">#{myRank}</span>
              <div>
                <p className="font-semibold text-gray-800 text-sm">You this week</p>
                <p className="text-xs text-gray-500">{myEntry.weekly} active referrals · {myEntry.total} all-time</p>
              </div>
            </div>
            {myRank <= 3 && (
              <Button size="sm" onClick={() => claimTrophy.mutate()} disabled={claimTrophy.isPending}
                className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs">
                <Gift className="w-3.5 h-3.5 mr-1" />
                {claimTrophy.isPending ? 'Claiming…' : `Claim ${WEEKLY_PRIZES[myRank - 1].prize}`}
              </Button>
            )}
          </div>
        )}

        {leaderboard.slice(3).map((entry, idx) => {
          const rank = idx + 4;
          const isMe = entry.user_id === user?.id;
          return (
            <div key={entry.user_id}
              className={`flex items-center justify-between rounded-xl px-3 py-2.5 border ${isMe ? 'border-blue-300 bg-blue-50' : 'border-gray-100 bg-white'}`}>
              <div className="flex items-center gap-3">
                <span className="w-6 text-center text-sm font-bold text-gray-400">#{rank}</span>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                  {(entry.name || 'U')[0].toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-700">{isMe ? 'You' : entry.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-700">{entry.weekly}</span>
                <span className="text-xs text-gray-400">refs</span>
              </div>
            </div>
          );
        })}

        {leaderboard.length === 0 && (
          <div className="text-center py-8">
            <Users className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No referrals this week yet — be the first!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
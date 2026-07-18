import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Flame, Gift, Crown } from 'lucide-react';
import { motion } from 'framer-motion';

export default function WishlistSharerLeaderboard() {
  const { data: referrals = [] } = useQuery({
    queryKey: ['allWishlistReferrals'],
    queryFn: () => base44.asServiceRole.entities.WishlistShareReferral.list('-conversions', 100),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Group by user and calculate totals
  const topSharers = referrals.reduce((acc, ref) => {
    const existing = acc.find(r => r.user_id === ref.user_id);
    if (existing) {
      existing.conversions += ref.conversions || 0;
      existing.jackpot_entries += ref.jackpot_entries_earned || 0;
      existing.credit += ref.wishlist_credit_earned || 0;
      existing.link_count += 1;
    } else {
      acc.push({
        user_id: ref.user_id,
        conversions: ref.conversions || 0,
        jackpot_entries: ref.jackpot_entries_earned || 0,
        credit: ref.wishlist_credit_earned || 0,
        link_count: 1,
      });
    }
    return acc;
  }, [])
    .sort((a, b) => (b.conversions + b.jackpot_entries) - (a.conversions + a.jackpot_entries))
    .slice(0, 10);

  const jackpotWinner = topSharers[0];

  return (
    <div className="space-y-6">
      {/* Prize Pool Winner Announcement */}
      {jackpotWinner && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative overflow-hidden rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 p-6 text-white shadow-2xl"
        >
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }} />
          <div className="relative space-y-2 text-center">
            <div className="flex justify-center gap-1 mb-4">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ y: [0, -10, 0] }}
                  transition={{ delay: i * 0.1, repeat: Infinity, duration: 2 }}
                >
                  <Crown className="w-6 h-6" />
                </motion.div>
              ))}
            </div>
            <h3 className="text-2xl font-bold">🎉 Wishlist Sharer Champion!</h3>
            <p className="text-lg opacity-90">
              {jackpotWinner.conversions} conversions • {jackpotWinner.jackpot_entries} Prize Pool Points
            </p>
          </div>
        </motion.div>
      )}

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Top Wishlist Sharers
          </CardTitle>
          <CardDescription>Real-time rankings by conversions & Prize Pool Points</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topSharers.map((sharer, idx) => (
              <motion.div
                key={sharer.user_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  idx === 0 ? 'bg-yellow-50 border-yellow-200' :
                  idx === 1 ? 'bg-gray-50 border-gray-200' :
                  idx === 2 ? 'bg-orange-50 border-orange-200' :
                  'bg-white'
                }`}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold text-lg">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-semibold">User #{sharer.user_id.slice(0, 8)}</div>
                    <div className="text-xs text-gray-500">{sharer.link_count} active link{sharer.link_count !== 1 ? 's' : ''}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-sm font-semibold">
                      <Gift className="w-4 h-4 text-green-500" />
                      {sharer.conversions}
                    </div>
                    <div className="text-xs text-gray-500">conversions</div>
                  </div>

                  <Badge className="bg-purple-100 text-purple-800 flex items-center gap-1">
                    <Flame className="w-3 h-3" />
                    {sharer.jackpot_entries}
                  </Badge>

                  <div className="text-right font-bold text-emerald-600">
                    <div>${sharer.credit.toFixed(2)}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
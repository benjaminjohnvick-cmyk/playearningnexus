import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, Gift, CheckCircle, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

const MILESTONES = [
  { referrals: 1,   reward: '$1 Bonus',      icon: '🎉', desc: 'First referral bonus' },
  { referrals: 5,   reward: '$5 Bonus',       icon: '⭐', desc: 'Getting started reward' },
  { referrals: 10,  reward: '$15 Bonus',      icon: '🔥', desc: 'Double digits milestone' },
  { referrals: 25,  reward: '$40 Bonus',      icon: '💎', desc: 'Quarter century reward' },
  { referrals: 50,  reward: '$100 Bonus',     icon: '🏆', desc: 'Referral master reward' },
  { referrals: 100, reward: '$250 + Crown',   icon: '👑', desc: 'Elite referrer status' },
];

export default function TieredRewardsMilestones({ totalReferrals = 0 }) {
  const nextMilestone = MILESTONES.find(m => m.referrals > totalReferrals);
  const prevMilestone = [...MILESTONES].reverse().find(m => m.referrals <= totalReferrals);

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-600" />
          Referral Milestones
          <Badge className="bg-yellow-100 text-yellow-700 text-xs ml-auto">{totalReferrals} referrals</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress to next milestone */}
        {nextMilestone && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-3 border border-yellow-200">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-medium text-gray-700">Next: {nextMilestone.icon} {nextMilestone.reward}</span>
              <span className="text-gray-500">{totalReferrals}/{nextMilestone.referrals}</span>
            </div>
            <Progress
              value={Math.min(100, (totalReferrals / nextMilestone.referrals) * 100)}
              className="h-2"
            />
            <p className="text-xs text-gray-500 mt-1">{nextMilestone.referrals - totalReferrals} more referrals needed</p>
          </div>
        )}

        {/* Milestones list */}
        <div className="space-y-2">
          {MILESTONES.map((m, i) => {
            const reached = totalReferrals >= m.referrals;
            return (
              <motion.div
                key={m.referrals}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                  reached
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-100 opacity-70'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{m.icon}</span>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{m.referrals} Referrals</p>
                    <p className="text-xs text-gray-500">{m.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-green-700">{m.reward}</span>
                  {reached
                    ? <CheckCircle className="w-4 h-4 text-green-600" />
                    : <Lock className="w-4 h-4 text-gray-400" />
                  }
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
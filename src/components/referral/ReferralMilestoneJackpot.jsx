import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Gift, Ticket, Star, Crown, Users, DollarSign, Zap, CheckCircle, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const MILESTONES = [
  {
    count: 5,
    label: 'Rookie Recruiter',
    icon: '🌱',
    badge_name: 'Rookie Recruiter',
    jackpot_entries: 1,
    reward_color: 'from-green-400 to-emerald-500',
    border: 'border-green-300',
    bg: 'bg-green-50',
    perks: ['1 jackpot entry', 'Rookie Recruiter badge', 'Profile flair'],
  },
  {
    count: 25,
    label: 'Network Builder',
    icon: '⚡',
    badge_name: 'Network Builder',
    jackpot_entries: 5,
    reward_color: 'from-blue-400 to-indigo-500',
    border: 'border-blue-300',
    bg: 'bg-blue-50',
    perks: ['5 jackpot entries', 'Network Builder badge', 'Priority survey access'],
  },
  {
    count: 50,
    label: 'Growth Champion',
    icon: '🔥',
    badge_name: 'Growth Champion',
    jackpot_entries: 15,
    reward_color: 'from-orange-400 to-red-500',
    border: 'border-orange-300',
    bg: 'bg-orange-50',
    perks: ['15 jackpot entries', 'Growth Champion badge', 'Custom profile frame', 'Bonus 5% commission'],
  },
  {
    count: 100,
    label: 'Referral Legend',
    icon: '👑',
    badge_name: 'Referral Legend',
    jackpot_entries: 50,
    reward_color: 'from-yellow-400 to-amber-500',
    border: 'border-yellow-300',
    bg: 'bg-yellow-50',
    perks: ['50 jackpot entries', 'Referral Legend badge', 'Exclusive golden frame', '10% commission boost', 'VIP survey pool access'],
  },
];

function MilestoneCard({ milestone, totalReferrals, achieved, userId, qc }) {
  const progress = Math.min(100, (totalReferrals / milestone.count) * 100);
  const remaining = Math.max(0, milestone.count - totalReferrals);

  const { data: existingMilestone } = useQuery({
    queryKey: ['milestone', userId, milestone.count],
    queryFn: () => base44.entities.ReferralMilestone.filter({ user_id: userId, milestone_count: milestone.count }).then(r => r[0] || null),
    enabled: !!userId,
  });

  const claimMutation = useMutation({
    mutationFn: () => base44.entities.ReferralMilestone.create({
      user_id: userId,
      milestone_count: milestone.count,
      achieved_at: new Date().toISOString(),
      jackpot_entries_awarded: milestone.jackpot_entries,
      badge_name: milestone.badge_name,
      badge_icon: milestone.icon,
      reward_claimed: true,
      notified: true,
    }),
    onSuccess: () => {
      qc.invalidateQueries(['milestone', userId, milestone.count]);
      qc.invalidateQueries(['milestones', userId]);
      toast.success(`🎉 ${milestone.label} milestone claimed! +${milestone.jackpot_entries} jackpot entries!`);
    },
  });

  const isClaimed = !!existingMilestone?.reward_claimed;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className={`relative border-2 rounded-2xl p-5 transition-all
        ${achieved ? `${milestone.border} ${milestone.bg} shadow-md` : 'border-gray-200 bg-gray-50 opacity-70'}`}>

      {/* Milestone badge header */}
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl
          ${achieved ? `bg-gradient-to-br ${milestone.reward_color} shadow-lg` : 'bg-gray-200'}`}>
          {achieved ? milestone.icon : <Lock className="w-5 h-5 text-gray-400" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900">{milestone.count} Referrals</span>
            {isClaimed && <Badge className="bg-green-100 text-green-700 text-xs">✅ Claimed</Badge>}
            {achieved && !isClaimed && <Badge className="bg-amber-100 text-amber-700 text-xs animate-pulse">Claim Now!</Badge>}
          </div>
          <p className={`text-sm font-semibold ${achieved ? 'text-gray-700' : 'text-gray-400'}`}>{milestone.label}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 justify-end">
            <Ticket className="w-4 h-4 text-purple-500" />
            <span className="font-black text-purple-700">+{milestone.jackpot_entries}</span>
          </div>
          <p className="text-xs text-gray-400">jackpot entries</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{Math.min(totalReferrals, milestone.count)}/{milestone.count} referrals</span>
          {!achieved && <span className="text-indigo-600 font-semibold">{remaining} more to go</span>}
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div className={`h-full rounded-full bg-gradient-to-r ${milestone.reward_color}`}
            initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.8 }} />
        </div>
      </div>

      {/* Perks */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {milestone.perks.map((p, i) => (
          <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${achieved ? 'bg-white text-gray-600 border border-gray-200' : 'bg-gray-100 text-gray-400'}`}>
            {p}
          </span>
        ))}
      </div>

      {achieved && !isClaimed && (
        <Button size="sm" className={`w-full bg-gradient-to-r ${milestone.reward_color} text-white font-bold`}
          onClick={() => claimMutation.mutate()} disabled={claimMutation.isPending}>
          {claimMutation.isPending ? '...' : `🎉 Claim ${milestone.jackpot_entries} Jackpot Entries`}
        </Button>
      )}
    </motion.div>
  );
}

function JackpotWidget({ userId, totalReferrals }) {
  const { data: jackpots = [] } = useQuery({
    queryKey: ['jackpots'],
    queryFn: () => base44.entities.ReferralJackpot.filter({ status: 'active' }),
    staleTime: 60000,
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones', userId],
    queryFn: () => base44.entities.ReferralMilestone.filter({ user_id: userId }),
    enabled: !!userId,
  });

  const activeJackpot = jackpots[0] || {
    jackpot_amount: 2840,
    period: '2026-Q1',
    total_entries: 342,
  };

  const myEntries = milestones.reduce((s, m) => s + (m.jackpot_entries_awarded || 0), 0);
  const myChance = activeJackpot.total_entries > 0 ? ((myEntries / (activeJackpot.total_entries + myEntries)) * 100).toFixed(1) : 0;

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 text-white overflow-hidden">
      <CardContent className="p-6 relative">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-white/20 rounded-2xl"><Trophy className="w-7 h-7" /></div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest opacity-75">Active Jackpot</p>
              <h2 className="text-2xl font-black">${(activeJackpot.jackpot_amount || 0).toLocaleString()}</h2>
            </div>
            <Badge className="ml-auto bg-yellow-400 text-yellow-900 font-bold animate-pulse">10% of Profits</Badge>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'My Entries', value: myEntries, icon: Ticket },
              { label: 'Win Chance', value: `${myChance}%`, icon: Star },
              { label: 'Total Entries', value: activeJackpot.total_entries || 0, icon: Users },
            ].map(s => (
              <div key={s.label} className="bg-white/15 rounded-xl p-3 text-center">
                <s.icon className="w-4 h-4 mx-auto mb-1 opacity-75" />
                <p className="text-lg font-black">{s.value}</p>
                <p className="text-xs opacity-70">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white/15 rounded-xl p-3 text-xs">
            <p className="font-bold mb-1">🎰 How the Jackpot Works</p>
            <ul className="space-y-0.5 opacity-85">
              <li>• Hit referral milestones (5, 25, 50, 100) to earn entries</li>
              <li>• The user with the <strong>most entries</strong> wins the jackpot</li>
              <li>• Jackpot = 10% of after-tax platform profits, spent on-site</li>
              <li>• Winners announced quarterly — prizes must be spent on GamerGain</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReferralMilestoneJackpot({ userId, totalReferrals = 0 }) {
  const qc = useQueryClient();

  const achievedMilestones = MILESTONES.filter(m => totalReferrals >= m.count);

  return (
    <div className="space-y-6">
      <JackpotWidget userId={userId} totalReferrals={totalReferrals} />

      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
          <Gift className="w-4 h-4 text-purple-600" /> Milestone Rewards — Earn Permanent Jackpot Entries
          <Badge className="bg-purple-100 text-purple-700 text-xs">{achievedMilestones.length}/{MILESTONES.length} achieved</Badge>
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          {MILESTONES.map(m => (
            <MilestoneCard key={m.count} milestone={m} totalReferrals={totalReferrals}
              achieved={totalReferrals >= m.count} userId={userId} qc={qc} />
          ))}
        </div>
      </div>
    </div>
  );
}
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Gift, Ticket, Lock, CheckCircle, ChevronRight, Star, Zap, Crown } from 'lucide-react';
import { toast } from 'sonner';

const MILESTONES = [
  {
    count: 5,
    label: 'Rookie Recruiter',
    icon: '🌱',
    color: 'from-green-400 to-emerald-500',
    border: 'border-green-300',
    bg: 'bg-green-50',
    textColor: 'text-green-700',
    badgeName: 'Rookie Recruiter',
    jackpotEntries: 1,
    commissionBoost: null,
    exclusiveSurveys: false,
    perks: ['1 Jackpot Entry', 'Rookie Badge', 'Profile Flair'],
  },
  {
    count: 25,
    label: 'Network Builder',
    icon: '⚡',
    color: 'from-blue-400 to-indigo-500',
    border: 'border-blue-300',
    bg: 'bg-blue-50',
    textColor: 'text-blue-700',
    badgeName: 'Network Builder',
    jackpotEntries: 5,
    commissionBoost: null,
    exclusiveSurveys: true,
    perks: ['5 Jackpot Entries', 'Network Builder Badge', 'Priority Survey Access'],
  },
  {
    count: 50,
    label: 'Growth Champion',
    icon: '🔥',
    color: 'from-orange-400 to-red-500',
    border: 'border-orange-300',
    bg: 'bg-orange-50',
    textColor: 'text-orange-700',
    badgeName: 'Growth Champion',
    jackpotEntries: 15,
    commissionBoost: 5,
    exclusiveSurveys: true,
    perks: ['15 Jackpot Entries', 'Growth Champion Badge', 'Custom Frame', '+5% Commission'],
  },
  {
    count: 100,
    label: 'Referral Legend',
    icon: '👑',
    color: 'from-yellow-400 to-amber-500',
    border: 'border-yellow-300',
    bg: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    badgeName: 'Referral Legend',
    jackpotEntries: 50,
    commissionBoost: 10,
    exclusiveSurveys: true,
    perks: ['50 Jackpot Entries', 'Legend Badge', 'Golden Frame', '+10% Commission', 'VIP Survey Pool'],
  },
];

function OverallProgressBar({ totalReferrals }) {
  const nextMilestone = MILESTONES.find(m => totalReferrals < m.count) || MILESTONES[MILESTONES.length - 1];
  const prevCount = MILESTONES.find(m => m.count < nextMilestone.count)?.count || 0;
  const pct = Math.min(100, ((totalReferrals - prevCount) / (nextMilestone.count - prevCount)) * 100);
  const achieved = MILESTONES.filter(m => totalReferrals >= m.count).length;

  return (
    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-5 text-white mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest opacity-75">Referral Journey</p>
          <p className="text-3xl font-black">{totalReferrals} <span className="text-base font-normal opacity-75">referrals</span></p>
        </div>
        <div className="text-right">
          <p className="text-xs opacity-75">Milestones</p>
          <p className="text-2xl font-black">{achieved}<span className="text-sm font-normal opacity-75">/{MILESTONES.length}</span></p>
        </div>
      </div>
      <div className="relative h-4 bg-white/20 rounded-full overflow-hidden mb-2">
        <motion.div
          className="h-full bg-white rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
        {/* Milestone markers */}
        {MILESTONES.map((m, i) => {
          const markerPct = i === 0 ? (5 / nextMilestone.count) * 100 : (m.count / MILESTONES[MILESTONES.length - 1].count) * 100;
          return (
            <div key={m.count} className="absolute top-0 bottom-0 w-0.5 bg-white/40"
              style={{ left: `${(m.count / 100) * 100}%` }} />
          );
        })}
      </div>
      <p className="text-xs opacity-75">
        {totalReferrals >= 100 ? '🎉 All milestones achieved!' : `${nextMilestone.count - totalReferrals} more to reach ${nextMilestone.label}`}
      </p>
    </div>
  );
}

function MilestoneCard({ milestone, totalReferrals, userId, qc }) {
  const achieved = totalReferrals >= milestone.count;
  const progress = Math.min(100, (totalReferrals / milestone.count) * 100);

  const { data: record } = useQuery({
    queryKey: ['rm', userId, milestone.count],
    queryFn: () => base44.entities.ReferralMilestone.filter({ user_id: userId, milestone_count: milestone.count }).then(r => r[0] || null),
    enabled: !!userId,
  });

  const claimMutation = useMutation({
    mutationFn: () => base44.entities.ReferralMilestone.create({
      user_id: userId,
      milestone_count: milestone.count,
      achieved_at: new Date().toISOString(),
      jackpot_entries_awarded: milestone.jackpotEntries,
      badge_name: milestone.badgeName,
      badge_icon: milestone.icon,
      reward_claimed: true,
      notified: true,
    }),
    onSuccess: () => {
      qc.invalidateQueries(['rm', userId, milestone.count]);
      qc.invalidateQueries(['milestones', userId]);
      toast.success(`🎉 ${milestone.label} unlocked! +${milestone.jackpotEntries} jackpot entries awarded!`);
    },
  });

  const isClaimed = !!record?.reward_claimed;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-2xl border-2 p-5 transition-all
        ${achieved ? `${milestone.border} ${milestone.bg} shadow-md` : 'border-gray-200 bg-white'}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm
          ${achieved ? `bg-gradient-to-br ${milestone.color}` : 'bg-gray-100'}`}>
          {achieved ? milestone.icon : <Lock className="w-6 h-6 text-gray-300" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900">{milestone.count} Referrals</span>
            {isClaimed && <Badge className="bg-green-100 text-green-700 text-xs border-green-200">✅ Claimed</Badge>}
            {achieved && !isClaimed && <Badge className="bg-amber-100 text-amber-700 text-xs border-amber-200 animate-pulse">🎁 Claim Now</Badge>}
          </div>
          <p className={`text-sm font-semibold ${achieved ? milestone.textColor : 'text-gray-400'}`}>{milestone.label}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className={`flex items-center gap-1 justify-end ${achieved ? 'text-purple-700' : 'text-gray-300'}`}>
            <Ticket className="w-4 h-4" />
            <span className="font-black">+{milestone.jackpotEntries}</span>
          </div>
          <p className="text-xs text-gray-400">entries</p>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-500">{Math.min(totalReferrals, milestone.count)}/{milestone.count}</span>
          {!achieved && <span className={`font-semibold ${milestone.textColor}`}>{milestone.count - totalReferrals} to go</span>}
        </div>
        <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${milestone.color}`}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, delay: 0.1 }}
          />
        </div>
      </div>

      {/* Perks grid */}
      <div className="grid grid-cols-2 gap-1.5 mb-4">
        {milestone.perks.map((p, i) => (
          <div key={i} className={`text-xs px-2.5 py-1.5 rounded-xl flex items-center gap-1.5
            ${achieved ? 'bg-white border border-gray-200 text-gray-700' : 'bg-gray-50 text-gray-400'}`}>
            <Star className={`w-3 h-3 flex-shrink-0 ${achieved ? milestone.textColor : 'text-gray-300'}`} />
            {p}
          </div>
        ))}
      </div>

      {/* Claim button */}
      {achieved && !isClaimed && (
        <Button
          className={`w-full bg-gradient-to-r ${milestone.color} text-white font-bold border-0 shadow-md`}
          onClick={() => claimMutation.mutate()}
          disabled={claimMutation.isPending}
        >
          {claimMutation.isPending
            ? '...'
            : <><Gift className="w-4 h-4 mr-2" /> Claim {milestone.jackpotEntries} Jackpot Entries</>}
        </Button>
      )}
      {isClaimed && (
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-green-700 bg-green-50 rounded-xl py-2">
          <CheckCircle className="w-4 h-4" /> Reward Claimed
        </div>
      )}
    </motion.div>
  );
}

export default function ReferralProgressTracker({ userId, totalReferrals = 0 }) {
  const qc = useQueryClient();

  return (
    <div className="space-y-4">
      <OverallProgressBar totalReferrals={totalReferrals} />
      <div className="grid md:grid-cols-2 gap-4">
        {MILESTONES.map(m => (
          <MilestoneCard key={m.count} milestone={m} totalReferrals={totalReferrals} userId={userId} qc={qc} />
        ))}
      </div>
    </div>
  );
}
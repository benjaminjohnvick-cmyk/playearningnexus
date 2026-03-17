import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Unlock, Zap, Star, Trophy, Crown, Gift } from 'lucide-react';

const MILESTONES = [
  {
    amount: 10,
    label: '$10',
    icon: '🎯',
    tier: 'Starter',
    color: 'from-gray-400 to-gray-500',
    badgeColor: 'bg-gray-100 border-gray-300 text-gray-600',
    unlockedColor: 'bg-green-100 border-green-400 text-green-700',
    ringColor: 'ring-gray-300',
    unlockedRing: 'ring-green-400',
    perks: ['First withdrawal unlocked', 'Standard payout speed'],
  },
  {
    amount: 25,
    label: '$25',
    icon: '⚡',
    tier: 'Earner',
    color: 'from-blue-400 to-blue-600',
    badgeColor: 'bg-blue-50 border-blue-300 text-blue-600',
    unlockedColor: 'bg-blue-100 border-blue-500 text-blue-800',
    ringColor: 'ring-blue-300',
    unlockedRing: 'ring-blue-500',
    perks: ['Priority payout queue', 'Bonus survey access', '+5% referral commission'],
  },
  {
    amount: 50,
    label: '$50',
    icon: '🏆',
    tier: 'Pro',
    color: 'from-purple-500 to-indigo-600',
    badgeColor: 'bg-purple-50 border-purple-300 text-purple-600',
    unlockedColor: 'bg-purple-100 border-purple-500 text-purple-800',
    ringColor: 'ring-purple-300',
    unlockedRing: 'ring-purple-500',
    perks: ['Instant payout unlocked', 'Exclusive Pro surveys', '+10% referral bonus', 'Dedicated support'],
  },
  {
    amount: 100,
    label: '$100',
    icon: '👑',
    tier: 'Elite',
    color: 'from-amber-400 to-yellow-500',
    badgeColor: 'bg-amber-50 border-amber-300 text-amber-600',
    unlockedColor: 'bg-amber-100 border-amber-500 text-amber-800',
    ringColor: 'ring-amber-300',
    unlockedRing: 'ring-amber-400',
    perks: ['Elite referrer badge', 'Highest-paying surveys', '+15% lifetime commission', 'VIP contest access'],
  },
  {
    amount: 250,
    label: '$250',
    icon: '💎',
    tier: 'Diamond',
    color: 'from-cyan-400 to-blue-500',
    badgeColor: 'bg-cyan-50 border-cyan-300 text-cyan-600',
    unlockedColor: 'bg-cyan-100 border-cyan-500 text-cyan-800',
    ringColor: 'ring-cyan-300',
    unlockedRing: 'ring-cyan-500',
    perks: ['Diamond status', 'Custom referral subdomain', 'Max-tier referral rate', 'Early access features'],
  },
];

function MilestoneBadge({ milestone, totalEarned, isNext }) {
  const unlocked = totalEarned >= milestone.amount;
  const pct = unlocked ? 100 : Math.min((totalEarned / milestone.amount) * 100, 99);

  return (
    <div className={`relative flex flex-col items-center gap-2 ${isNext ? 'scale-105' : ''}`}>
      {/* Badge circle */}
      <div className={`relative w-16 h-16 rounded-full border-4 flex items-center justify-center text-2xl transition-all
        ${unlocked
          ? `${milestone.unlockedColor} ${milestone.unlockedRing} ring-2 shadow-lg`
          : `bg-white ${milestone.badgeColor} ${milestone.ringColor} ${isNext ? 'ring-2 animate-pulse' : ''}`
        }`}
      >
        {milestone.icon}
        {!unlocked && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center border-2 border-white">
            <Lock className="w-2.5 h-2.5 text-gray-500" />
          </div>
        )}
        {unlocked && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
            <Unlock className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </div>

      {/* Label + tier */}
      <div className="text-center">
        <p className={`font-bold text-sm ${unlocked ? 'text-gray-900' : 'text-gray-500'}`}>{milestone.label}</p>
        <p className={`text-xs font-medium ${unlocked ? 'text-green-600' : isNext ? 'text-blue-600' : 'text-gray-400'}`}>
          {milestone.tier}
        </p>
      </div>

      {/* Perks tooltip */}
      {isNext && !unlocked && (
        <div className="absolute -bottom-28 left-1/2 -translate-x-1/2 z-20 w-44 bg-white border-2 border-blue-200 rounded-xl shadow-xl p-2 text-xs">
          <p className="font-bold text-blue-700 mb-1 text-center">🔓 Unlocks at {milestone.label}</p>
          {milestone.perks.map((p, i) => (
            <p key={i} className="text-gray-600 flex items-center gap-1">
              <span className="text-blue-400">•</span> {p}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EarningProgressPath({ totalEarned = 0 }) {
  const nextMilestone = MILESTONES.find(m => totalEarned < m.amount);
  const completedCount = MILESTONES.filter(m => totalEarned >= m.amount).length;
  const toNext = nextMilestone ? nextMilestone.amount - totalEarned : 0;
  const overallPct = nextMilestone
    ? Math.min((totalEarned / nextMilestone.amount) * 100, 100)
    : 100;

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-indigo-50 overflow-visible">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="w-5 h-5 text-amber-500" /> Earning Progress Path
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{completedCount}/{MILESTONES.length} milestones</span>
            <span className="font-bold text-green-600">${totalEarned.toFixed(2)} earned</span>
          </div>
        </div>
        {nextMilestone && (
          <p className="text-xs text-gray-500 mt-1">
            <span className="text-blue-600 font-semibold">${toNext.toFixed(2)} more</span> to unlock <strong>{nextMilestone.tier}</strong> perks
          </p>
        )}
      </CardHeader>

      <CardContent>
        {/* Progress bar */}
        <div className="relative mb-10">
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-green-400 via-blue-500 to-purple-500 transition-all duration-700"
              style={{ width: `${overallPct}%` }}
            />
          </div>

          {/* Milestone markers on bar */}
          {MILESTONES.map((m, i) => {
            const pct = (m.amount / MILESTONES[MILESTONES.length - 1].amount) * 100;
            const done = totalEarned >= m.amount;
            return (
              <div
                key={i}
                className="absolute top-1/2 -translate-y-1/2"
                style={{ left: `${pct}%`, transform: 'translate(-50%, -50%)' }}
              >
                <div className={`w-3 h-3 rounded-full border-2 border-white ${done ? 'bg-green-500' : 'bg-gray-300'}`} />
              </div>
            );
          })}
        </div>

        {/* Badge row */}
        <div className="relative flex items-start justify-between mt-2 pb-28">
          {MILESTONES.map((m, i) => (
            <MilestoneBadge
              key={i}
              milestone={m}
              totalEarned={totalEarned}
              isNext={nextMilestone?.amount === m.amount}
            />
          ))}

          {/* Connector lines between badges */}
          <div className="absolute top-8 left-8 right-8 h-0.5 bg-gray-100 -z-0" />
        </div>

        {/* Perks for unlocked milestones */}
        {completedCount > 0 && (
          <div className="mt-2 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
              <Gift className="w-3.5 h-3.5 text-green-500" /> Your Active Perks
            </p>
            <div className="flex flex-wrap gap-2">
              {MILESTONES.filter(m => totalEarned >= m.amount).flatMap(m => m.perks).map((perk, i) => (
                <span key={i} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                  ✓ {perk}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
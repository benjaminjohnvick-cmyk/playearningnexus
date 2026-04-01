import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Crown, Flame, Star, Zap, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

const RANK_CONFIG = [
  {
    bg: 'bg-gradient-to-r from-yellow-50 to-amber-50',
    border: 'border-yellow-300',
    text: 'text-yellow-700',
    icon: <Crown className="w-4 h-4 text-yellow-500" />,
    badge: { label: '👑 Champion', color: 'bg-yellow-500 text-white' },
    avatarGrad: 'from-yellow-400 to-amber-500',
    ring: 'ring-2 ring-yellow-400',
  },
  {
    bg: 'bg-gradient-to-r from-slate-50 to-gray-50',
    border: 'border-gray-300',
    text: 'text-gray-600',
    icon: <Medal className="w-4 h-4 text-gray-400" />,
    badge: { label: '🥈 Elite', color: 'bg-gray-400 text-white' },
    avatarGrad: 'from-gray-400 to-slate-500',
    ring: 'ring-2 ring-gray-300',
  },
  {
    bg: 'bg-gradient-to-r from-orange-50 to-amber-50',
    border: 'border-orange-300',
    text: 'text-orange-600',
    icon: <Medal className="w-4 h-4 text-orange-400" />,
    badge: { label: '🥉 Pro', color: 'bg-orange-400 text-white' },
    avatarGrad: 'from-orange-400 to-red-400',
    ring: 'ring-2 ring-orange-300',
  },
];

const PERFORMER_BADGES = [
  { minEarnings: 500, icon: <Flame className="w-3 h-3" />, label: 'Hot Streak', color: 'bg-red-100 text-red-600 border-red-200' },
  { minEarnings: 200, icon: <Star className="w-3 h-3" />, label: 'All-Star', color: 'bg-purple-100 text-purple-600 border-purple-200' },
  { minEarnings: 100, icon: <Zap className="w-3 h-3" />, label: 'Rising', color: 'bg-blue-100 text-blue-600 border-blue-200' },
  { minEarnings: 50, icon: <TrendingUp className="w-3 h-3" />, label: 'Climber', color: 'bg-green-100 text-green-600 border-green-200' },
];

function getPerformerBadge(earnings) {
  return PERFORMER_BADGES.find(b => earnings >= b.minEarnings) || null;
}

export default function TopEarnersLeaderboard() {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['top-earners'],
    queryFn: () => base44.entities.User.list('-total_earnings', 10),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const top = users.filter(u => (u.total_earnings || 0) > 0).slice(0, 10);
  const maxEarnings = top[0]?.total_earnings || 1;

  return (
    <Card className="p-6 border-0 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
          <Trophy className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-gray-900 leading-none">Top Earners</h3>
          <p className="text-xs text-gray-400">Live leaderboard · all-time</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : top.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No earners yet — be the first!</p>
      ) : (
        <ol className="space-y-2">
          {top.map((u, i) => {
            const cfg = RANK_CONFIG[i] || {
              bg: 'bg-gray-50', border: 'border-gray-100', text: 'text-gray-500',
              icon: null, badge: null, avatarGrad: 'from-purple-400 to-blue-500', ring: '',
            };
            const perfBadge = getPerformerBadge(u.total_earnings || 0);
            const pct = ((u.total_earnings || 0) / maxEarnings) * 100;

            return (
              <motion.li
                key={u.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`relative border rounded-xl px-3 py-2.5 ${cfg.bg} ${cfg.border} overflow-hidden`}
              >
                {/* Progress bar background */}
                <div
                  className="absolute inset-y-0 left-0 opacity-10 bg-green-500 transition-all"
                  style={{ width: `${pct}%` }}
                />

                <div className="relative flex items-center gap-3">
                  {/* Rank */}
                  <span className={`w-6 text-center font-black text-sm flex-shrink-0 ${cfg.text}`}>
                    {cfg.icon || `#${i + 1}`}
                  </span>

                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${cfg.avatarGrad} ${cfg.ring} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                    {(u.full_name || 'U')[0].toUpperCase()}
                  </div>

                  {/* Name + badges */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {u.full_name || 'Anonymous'}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      {cfg.badge && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cfg.badge.color}`}>
                          {cfg.badge.label}
                        </span>
                      )}
                      {perfBadge && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border flex items-center gap-0.5 ${perfBadge.color}`}>
                          {perfBadge.icon}{perfBadge.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Earnings */}
                  <span className="text-sm font-black text-green-600 flex-shrink-0">
                    ${(u.total_earnings || 0).toFixed(2)}
                  </span>
                </div>
              </motion.li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
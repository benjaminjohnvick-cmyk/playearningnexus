import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Crown, Star, Zap, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';

const TIER_CONFIG = {
  bronze: {
    label: 'Bronze',
    icon: Badge,
    color: 'text-amber-700',
    bg: 'bg-amber-100',
    gradient: 'from-amber-400 to-yellow-600',
    emoji: '🥉',
  },
  silver: {
    label: 'Silver',
    icon: Star,
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    gradient: 'from-slate-400 to-slate-600',
    emoji: '🥈',
  },
  gold: {
    label: 'Gold',
    icon: Trophy,
    color: 'text-yellow-600',
    bg: 'bg-yellow-100',
    gradient: 'from-yellow-400 to-yellow-600',
    emoji: '🥇',
  },
  platinum: {
    label: 'Platinum',
    icon: Crown,
    color: 'text-blue-600',
    bg: 'bg-blue-100',
    gradient: 'from-blue-400 to-indigo-600',
    emoji: '👑',
  },
};

export default function TierBadge({ user }) {
  const { data: membership } = useQuery({
    queryKey: ['tier-membership', user?.id],
    queryFn: async () => {
      const tiers = await base44.entities.TieredMembership.filter({ user_id: user.id });
      return tiers[0] || { tier: 'bronze', withdrawal_speed_hours: 72 };
    },
    enabled: !!user?.id,
  });

  if (!membership) return null;

  const tierConfig = TIER_CONFIG[membership.tier] || TIER_CONFIG.bronze;
  const benefits = {
    bronze: 'Standard surveys · 72h withdrawals',
    silver: '10% bonus · Exclusive surveys · 48h withdrawals',
    gold: '25% bonus · Exclusive surveys · 24h withdrawals',
    platinum: '50% bonus · Exclusive surveys · 4h withdrawals',
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={`border-2 bg-gradient-to-br ${tierConfig.bg} border-opacity-50`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className={`text-2xl`}>{tierConfig.emoji}</div>
            <div className="flex-1">
              <p className="font-black text-lg">{tierConfig.label} Member</p>
              <p className="text-xs text-gray-600">{benefits[membership.tier]}</p>
            </div>
            <Zap className={`w-5 h-5 ${tierConfig.color}`} />
          </div>

          {/* Progress to next tier */}
          {membership.tier !== 'platinum' && (
            <div className="mt-2 text-xs text-gray-600">
              <p className="mb-1">Progress to next tier:</p>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div className="bg-green-500 h-1.5 rounded-full" style={{ width: '45%' }} />
              </div>
              <p className="mt-1">Earn $${membership.tier === 'bronze' ? 100 : membership.tier === 'silver' ? 500 : 2000} more</p>
            </div>
          )}

          {membership.tier === 'platinum' && (
            <p className="mt-2 text-xs text-center font-bold text-blue-700">🌟 Highest tier reached!</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
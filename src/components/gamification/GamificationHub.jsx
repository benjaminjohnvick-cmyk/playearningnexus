import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import { Trophy, Star, Zap, Target, Users, ClipboardList, Award, Medal, Crown, Shield, ShoppingBag, Flame } from 'lucide-react';
import DailyGoalSystem from './DailyGoalSystem';

const BADGES = [
  { id: 'first_survey',    icon: ClipboardList, label: 'First Survey',      desc: 'Complete your first survey',        color: 'text-blue-600',   bg: 'bg-blue-100',   threshold: (s) => (s.totalSurveys || 0) >= 1 },
  { id: 'survey_master',   icon: Trophy,        label: 'Survey Master',     desc: 'Complete 25 surveys',               color: 'text-yellow-600', bg: 'bg-yellow-100', threshold: (s) => (s.totalSurveys || 0) >= 25 },
  { id: 'survey_champ',    icon: Medal,         label: 'Survey Champion',   desc: 'Complete 50 surveys',               color: 'text-amber-600',  bg: 'bg-amber-100',  threshold: (s) => (s.totalSurveys || 0) >= 50 },
  { id: 'first_referral',  icon: Users,         label: 'First Referral',    desc: 'Refer your first user',             color: 'text-green-600',  bg: 'bg-green-100',  threshold: (s) => (s.totalReferrals || 0) >= 1 },
  { id: 'top_referrer',    icon: Crown,         label: 'Top Referrer',      desc: 'Refer 10 active users',             color: 'text-purple-600', bg: 'bg-purple-100', threshold: (s) => (s.activeReferrals || 0) >= 10 },
  { id: 'first_purchase',  icon: ShoppingBag,   label: 'First Purchase',    desc: 'Make your first in-app purchase',   color: 'text-teal-600',   bg: 'bg-teal-100',   threshold: (s) => (s.purchases || 0) >= 1 },
  { id: 'daily_goal',      icon: Target,        label: 'Daily Achiever',    desc: 'Hit $3 daily goal once',            color: 'text-teal-600',   bg: 'bg-teal-100',   threshold: (s) => (s.daysGoalMet || 0) >= 1 },
  { id: 'streak_7',        icon: Flame,         label: '7-Day Streak',      desc: 'Hit daily goal 7 days in a row',    color: 'text-orange-600', bg: 'bg-orange-100', threshold: (s) => (s.streakDays || 0) >= 7 },
  { id: 'earner_10',       icon: Star,          label: 'Power Earner',      desc: 'Earn $10 total',                    color: 'text-pink-600',   bg: 'bg-pink-100',   threshold: (s) => (s.totalEarnings || 0) >= 10 },
  { id: 'top_earner',      icon: Zap,           label: 'Top Earner',        desc: 'Earn $100 total',                   color: 'text-red-600',    bg: 'bg-red-100',    threshold: (s) => (s.totalEarnings || 0) >= 100 },
  { id: 'shield',          icon: Shield,        label: 'Loyal Member',      desc: 'Active for 30+ days',               color: 'text-indigo-600', bg: 'bg-indigo-100', threshold: (s) => (s.memberDays || 0) >= 30 },
];

const TIERS = [
  { name: 'Bronze', minReferrals: 0, minEarnings: 0, multiplier: 1.0, color: 'text-amber-700', bg: 'bg-amber-100', border: 'border-amber-300' },
  { name: 'Silver', minReferrals: 3, minEarnings: 5, multiplier: 1.1, color: 'text-gray-600', bg: 'bg-gray-100', border: 'border-gray-400' },
  { name: 'Gold', minReferrals: 10, minEarnings: 25, multiplier: 1.25, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-400' },
  { name: 'Platinum', minReferrals: 25, minEarnings: 75, multiplier: 1.5, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-400' },
  { name: 'Diamond', minReferrals: 50, minEarnings: 200, multiplier: 2.0, color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-500' },
];

function getUserTier(activeReferrals, commissionEarned) {
  let tier = TIERS[0];
  for (const t of TIERS) {
    if (activeReferrals >= t.minReferrals && commissionEarned >= t.minEarnings) tier = t;
  }
  return tier;
}

function getNextTier(currentTier) {
  const idx = TIERS.findIndex(t => t.name === currentTier.name);
  return idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
}

export default function GamificationHub({ user, stats = {}, todayEarnings = 0, todaySurveys = 0, referrals = [] }) {
  const { totalReferrals = 0, activeReferrals = 0, commissionEarned = 0, totalSurveys = 0, daysGoalMet = 0, streakDays = 0, purchases = 0 } = stats;

  const totalEarnings = user?.total_earnings || 0;
  const memberDays = user?.created_date
    ? Math.floor((Date.now() - new Date(user.created_date)) / (1000 * 60 * 60 * 24))
    : 0;

  const userStats = { totalReferrals, activeReferrals, commissionEarned, totalSurveys, daysGoalMet, streakDays, totalEarnings, memberDays, purchases };
  const currentTier = getUserTier(activeReferrals, commissionEarned);
  const nextTier = getNextTier(currentTier);

  // Points calculation
  const points = Math.floor(
    totalSurveys * 10 +
    totalReferrals * 25 +
    totalEarnings * 5 +
    daysGoalMet * 15 +
    purchases * 50
  );

  const earnedBadges = BADGES.filter(b => b.threshold(userStats));
  const lockedBadges = BADGES.filter(b => !b.threshold(userStats));

  const tierProgressReferrals = nextTier
    ? Math.min(100, (activeReferrals / nextTier.minReferrals) * 100)
    : 100;
  const tierProgressEarnings = nextTier
    ? Math.min(100, (commissionEarned / nextTier.minEarnings) * 100)
    : 100;

  return (
    <div className="space-y-6">
      {/* Daily Goal System */}
      <DailyGoalSystem
        user={user}
        todayEarnings={todayEarnings}
        todaySurveys={todaySurveys}
        referrals={referrals}
      />

      {/* Points & Tier Summary */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className={`border-2 ${currentTier.border}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
              <Trophy className={`w-4 h-4 ${currentTier.color}`} />
              Current Tier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${currentTier.bg} mb-3`}>
              <span className={`text-2xl font-bold ${currentTier.color}`}>{currentTier.name}</span>
            </div>
            <p className="text-xs text-gray-500 mb-1">{currentTier.multiplier}x commission multiplier</p>
            {nextTier && (
              <>
                <p className="text-xs text-gray-500 mb-2">Progress to {nextTier.name}</p>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">Active Referrals</span>
                      <span className="font-medium">{activeReferrals}/{nextTier.minReferrals}</span>
                    </div>
                    <Progress value={tierProgressReferrals} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">Commission Earned</span>
                      <span className="font-medium">${commissionEarned.toFixed(2)}/${nextTier.minEarnings}</span>
                    </div>
                    <Progress value={tierProgressEarnings} className="h-2" />
                  </div>
                </div>
              </>
            )}
            {!nextTier && (
              <p className="text-sm font-medium text-purple-700 mt-2">🏆 Max tier reached!</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-600" />
              Your Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-yellow-700">{points.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1 mb-4">Total XP earned</p>
            <div className="space-y-1 text-xs text-gray-600">
              <div className="flex justify-between"><span>📋 Surveys completed</span><span className="font-medium text-blue-600">+{totalSurveys * 10} pts</span></div>
              <div className="flex justify-between"><span>👥 Referrals made</span><span className="font-medium text-green-600">+{totalReferrals * 25} pts</span></div>
              <div className="flex justify-between"><span>🎯 Daily goals hit</span><span className="font-medium text-teal-600">+{daysGoalMet * 15} pts</span></div>
              <div className="flex justify-between"><span>🛍️ Purchases made</span><span className="font-medium text-purple-600">+{purchases * 50} pts</span></div>
              <div className="flex justify-between"><span>💵 Earnings ($)</span><span className="font-medium text-yellow-600">+{Math.floor(totalEarnings * 5)} pts</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Badges */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="w-5 h-5 text-purple-600" />
            Badges
            <Badge className="bg-purple-600">{earnedBadges.length}/{BADGES.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {BADGES.map((badge, idx) => {
              const earned = badge.threshold(userStats);
              const Icon = badge.icon;
              return (
                <motion.div
                  key={badge.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`flex flex-col items-center p-3 rounded-xl text-center transition-all ${
                    earned ? `${badge.bg} border-2 border-current` : 'bg-gray-100 opacity-40 grayscale'
                  }`}
                  title={badge.desc}
                >
                  <Icon className={`w-7 h-7 mb-1 ${earned ? badge.color : 'text-gray-400'}`} />
                  <p className={`text-xs font-semibold leading-tight ${earned ? badge.color : 'text-gray-400'}`}>
                    {badge.label}
                  </p>
                  {!earned && <p className="text-[10px] text-gray-400 mt-1 leading-tight">{badge.desc}</p>}
                  {earned && <p className="text-[10px] mt-1 text-green-600 font-bold">✓ Earned</p>}
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* All Tier Levels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-600" />
            Referral Tier Levels
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {TIERS.map((tier) => {
              const isCurrentTier = tier.name === currentTier.name;
              return (
                <div key={tier.name} className={`flex items-center justify-between p-3 rounded-lg border-2 ${
                  isCurrentTier ? `${tier.bg} ${tier.border}` : 'bg-gray-50 border-gray-100'
                }`}>
                  <div className="flex items-center gap-3">
                    {isCurrentTier && <span className="text-green-600 font-bold text-xs bg-green-100 px-2 py-0.5 rounded-full">Current</span>}
                    <span className={`font-bold ${isCurrentTier ? tier.color : 'text-gray-400'}`}>{tier.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{tier.minReferrals}+ active referrals</span>
                    <span>${tier.minEarnings}+ commission</span>
                    <Badge className={isCurrentTier ? 'bg-green-600' : 'bg-gray-300'}>{tier.multiplier}x</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
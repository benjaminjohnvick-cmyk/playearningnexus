import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Star, Zap, TrendingUp, Award, CheckCircle2, Clock, Target, Crown } from 'lucide-react';
import { motion } from 'framer-motion';

const LEVELS = [
  { level: 1, name: 'Rookie',       xp_required: 0,    color: 'text-gray-600',    bg: 'bg-gray-100',    perk: 'Standard survey access' },
  { level: 2, name: 'Explorer',     xp_required: 500,   color: 'text-blue-600',    bg: 'bg-blue-100',    perk: '+5% survey earnings bonus' },
  { level: 3, name: 'Contributor',  xp_required: 1500,  color: 'text-green-600',   bg: 'bg-green-100',   perk: 'Priority survey matching' },
  { level: 4, name: 'Specialist',   xp_required: 3500,  color: 'text-purple-600',  bg: 'bg-purple-100',  perk: '+10% bonus + early access surveys' },
  { level: 5, name: 'Expert',       xp_required: 7500,  color: 'text-orange-600',  bg: 'bg-orange-100',  perk: 'Instant cash advance eligible' },
  { level: 6, name: 'Master',       xp_required: 15000, color: 'text-red-600',     bg: 'bg-red-100',     perk: '+15% bonus + VIP survey pool' },
  { level: 7, name: 'Elite',        xp_required: 30000, color: 'text-yellow-600',  bg: 'bg-yellow-100',  perk: '+20% bonus + premium payouts' },
  { level: 8, name: 'Legend',       xp_required: 60000, color: 'text-pink-600',    bg: 'bg-pink-100',    perk: 'Max bonuses + exclusive contests' },
];

const QUALITY_BADGES = [
  { id: 'quality_1',    label: '⭐ Quality Starter',    desc: 'Get first 90%+ quality score',       xp: 100,  threshold: (s) => (s.quality_surveys || 0) >= 1 },
  { id: 'streak_3',     label: '🔥 3-Day Streaker',     desc: '3 consecutive survey days',           xp: 150,  threshold: (s) => (s.streak_days || 0) >= 3 },
  { id: 'streak_7',     label: '🔥🔥 Week Warrior',      desc: '7-day survey streak',                 xp: 400,  threshold: (s) => (s.streak_days || 0) >= 7 },
  { id: 'streak_30',    label: '🏆 Monthly Legend',      desc: '30-day survey streak',                xp: 2000, threshold: (s) => (s.streak_days || 0) >= 30 },
  { id: 'high_quality', label: '💎 Quality Pro',         desc: '10 surveys with 90%+ quality',       xp: 500,  threshold: (s) => (s.quality_surveys || 0) >= 10 },
  { id: 'fast_responder',label: '⚡ Fast Responder',     desc: 'Complete 5 surveys in under 5min',   xp: 200,  threshold: (s) => (s.fast_surveys || 0) >= 5 },
  { id: 'top_earner_d', label: '💰 Daily Top Earner',   desc: 'Earn $5+ in a single day',           xp: 300,  threshold: (s) => (s.best_day_earnings || 0) >= 5 },
  { id: 'referral_star',label: '👥 Referral Star',      desc: 'Refer 5 active users',               xp: 600,  threshold: (s) => (s.active_referrals || 0) >= 5 },
  { id: 'platform_vet', label: '🛡️ Platform Veteran',   desc: 'Active 60+ days',                    xp: 800,  threshold: (s) => (s.member_days || 0) >= 60 },
  { id: 'leaderboard',  label: '🥇 Leaderboard Star',   desc: 'Reach top 100 on leaderboard',       xp: 1000, threshold: (s) => (s.leaderboard_rank || 999) <= 100 },
];

function getUserLevel(totalXP) {
  let currentLevel = LEVELS[0];
  for (const lvl of LEVELS) {
    if (totalXP >= lvl.xp_required) currentLevel = lvl;
  }
  return currentLevel;
}

function getNextLevel(currentLevel) {
  const idx = LEVELS.findIndex(l => l.level === currentLevel.level);
  return idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}

export default function SurveyQualityRewards({ user, stats = {} }) {
  const [showAllBadges, setShowAllBadges] = useState(false);

  const totalXP = Math.floor(
    (stats.total_surveys || 0) * 10 +
    (stats.quality_surveys || 0) * 50 +
    (stats.streak_days || 0) * 20 +
    (stats.active_referrals || 0) * 100 +
    (user?.total_earnings || 0) * 5 +
    (stats.member_days || 0) * 2
  );

  const currentLevel = getUserLevel(totalXP);
  const nextLevel = getNextLevel(currentLevel);
  const xpProgress = nextLevel
    ? Math.min(100, ((totalXP - currentLevel.xp_required) / (nextLevel.xp_required - currentLevel.xp_required)) * 100)
    : 100;

  const earnedBadges = QUALITY_BADGES.filter(b => b.threshold(stats));
  const lockedBadges = QUALITY_BADGES.filter(b => !b.threshold(stats));
  const displayBadges = showAllBadges ? QUALITY_BADGES : QUALITY_BADGES.slice(0, 6);

  const financialPerks = [
    { level: 2, perk: '+5% Survey Bonus',         active: currentLevel.level >= 2 },
    { level: 3, perk: 'Priority Survey Matching',  active: currentLevel.level >= 3 },
    { level: 4, perk: '+10% Survey Bonus',         active: currentLevel.level >= 4 },
    { level: 5, perk: 'Instant Cash Advance',      active: currentLevel.level >= 5 },
    { level: 6, perk: '+15% Survey Bonus',         active: currentLevel.level >= 6 },
    { level: 7, perk: 'VIP Survey Pool Access',    active: currentLevel.level >= 7 },
    { level: 8, perk: '+20% Bonus + Exclusive Contests', active: currentLevel.level >= 8 },
  ];

  return (
    <div className="space-y-4">
      {/* Level Card */}
      <Card className={`border-2 ${currentLevel.bg} border-current`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <Crown className={`w-6 h-6 ${currentLevel.color}`} />
                <span className={`text-2xl font-black ${currentLevel.color}`}>Level {currentLevel.level}</span>
                <Badge className={`${currentLevel.bg} ${currentLevel.color} border border-current`}>{currentLevel.name}</Badge>
              </div>
              <p className="text-xs text-gray-500 mt-1">{currentLevel.perk}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-800">{totalXP.toLocaleString()}</p>
              <p className="text-xs text-gray-500">Total XP</p>
            </div>
          </div>
          {nextLevel && (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">Progress to Level {nextLevel.level} ({nextLevel.name})</span>
                <span className="font-medium">{totalXP.toLocaleString()} / {nextLevel.xp_required.toLocaleString()} XP</span>
              </div>
              <Progress value={xpProgress} className="h-3" />
              <p className="text-xs text-gray-500 mt-1">Next perk: {nextLevel.perk}</p>
            </div>
          )}
          {!nextLevel && (
            <p className="text-sm font-bold text-pink-600 text-center mt-2">🏆 Maximum Level Achieved!</p>
          )}
        </CardContent>
      </Card>

      {/* XP Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" /> XP Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { label: 'Surveys completed', value: (stats.total_surveys || 0) * 10, icon: '📋', count: stats.total_surveys || 0 },
            { label: 'High-quality responses (90%+)', value: (stats.quality_surveys || 0) * 50, icon: '⭐', count: stats.quality_surveys || 0 },
            { label: 'Streak days', value: (stats.streak_days || 0) * 20, icon: '🔥', count: stats.streak_days || 0 },
            { label: 'Active referrals', value: (stats.active_referrals || 0) * 100, icon: '👥', count: stats.active_referrals || 0 },
            { label: 'Total earnings ($)', value: Math.floor((user?.total_earnings || 0) * 5), icon: '💵', count: `$${(user?.total_earnings || 0).toFixed(2)}` },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span>{item.icon}</span>
                <span className="text-gray-600">{item.label}</span>
                <span className="text-gray-400">({item.count})</span>
              </div>
              <span className="font-bold text-yellow-700">+{item.value} XP</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Financial Perks */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-600" /> Financial Perks (Level-Gated)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {financialPerks.map((p) => (
            <div key={p.level} className={`flex items-center justify-between p-2 rounded-lg text-xs ${p.active ? 'bg-green-50 border border-green-200' : 'bg-gray-50 opacity-60'}`}>
              <div className="flex items-center gap-2">
                {p.active ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <Clock className="w-3.5 h-3.5 text-gray-400" />}
                <span className={p.active ? 'text-green-700 font-medium' : 'text-gray-500'}>{p.perk}</span>
              </div>
              <Badge className={p.active ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'}>Lv.{p.level}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Badges */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Award className="w-4 h-4 text-purple-600" />
            Achievement Badges
            <Badge className="bg-purple-600">{earnedBadges.length}/{QUALITY_BADGES.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {displayBadges.map((badge) => {
              const earned = badge.threshold(stats);
              return (
                <motion.div
                  key={badge.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`p-2.5 rounded-xl border text-center text-xs ${earned ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50 border-gray-200 opacity-50 grayscale'}`}
                >
                  <p className="font-bold text-gray-800 mb-0.5">{badge.label}</p>
                  <p className="text-gray-500 text-[10px]">{badge.desc}</p>
                  <p className={`font-bold mt-1 ${earned ? 'text-yellow-600' : 'text-gray-400'}`}>+{badge.xp} XP</p>
                  {earned && <p className="text-green-600 text-[10px] font-bold">✓ Earned</p>}
                </motion.div>
              );
            })}
          </div>
          <Button variant="ghost" size="sm" className="w-full mt-3 text-xs" onClick={() => setShowAllBadges(!showAllBadges)}>
            {showAllBadges ? 'Show Less' : `Show All ${QUALITY_BADGES.length} Badges`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Flame, Star, Shield, Trophy, Zap, Lock, Crown, Award, CheckCircle2 } from 'lucide-react';
import { format, subDays, isSameDay, parseISO } from 'date-fns';

const BADGES = [
  { id: 'first_survey', icon: Star, label: 'First Survey', desc: 'Complete your first survey', req: 1, color: 'from-yellow-400 to-yellow-600', unlockDays: 1 },
  { id: 'streak_3', icon: Flame, label: '3-Day Streak', desc: '3 days in a row', req: 3, color: 'from-orange-400 to-red-500', unlockDays: 3 },
  { id: 'streak_7', icon: Zap, label: 'Week Warrior', desc: '7-day survey streak', req: 7, color: 'from-blue-400 to-blue-600', unlockDays: 7 },
  { id: 'streak_14', icon: Shield, label: 'Dedicated', desc: '14-day streak — +5% bonus', req: 14, color: 'from-purple-400 to-purple-600', unlockDays: 14 },
  { id: 'streak_30', icon: Trophy, label: 'Month Master', desc: '30-day streak — +10% bonus', req: 30, color: 'from-green-400 to-emerald-600', unlockDays: 30 },
  { id: 'streak_90', icon: Crown, label: 'Legend', desc: '90-day streak — +15% bonus', req: 90, color: 'from-yellow-500 to-amber-600', unlockDays: 90 },
  { id: 'streak_365', icon: Award, label: 'Tier Ascendant', desc: '365-day streak — Unlock next tier', req: 365, color: 'from-red-500 to-rose-700', unlockDays: 365 },
];

function BadgeCard({ badge, earned, streak }) {
  const Icon = badge.icon;
  const progress = Math.min((streak / badge.req) * 100, 100);

  return (
    <div className={`relative rounded-2xl p-4 border-2 transition-all text-center
      ${earned
        ? 'border-transparent bg-gradient-to-br ' + badge.color + ' text-white shadow-lg scale-100'
        : 'border-gray-200 bg-gray-50 text-gray-400'}`}
    >
      {earned && (
        <div className="absolute -top-2 -right-2">
          <CheckCircle2 className="w-5 h-5 text-white bg-green-500 rounded-full" />
        </div>
      )}
      <div className={`w-12 h-12 mx-auto mb-2 rounded-xl flex items-center justify-center
        ${earned ? 'bg-white/20' : 'bg-gray-200'}`}>
        {earned
          ? <Icon className="w-6 h-6 text-white" />
          : <Lock className="w-5 h-5 text-gray-400" />}
      </div>
      <p className={`font-bold text-sm ${earned ? 'text-white' : 'text-gray-600'}`}>{badge.label}</p>
      <p className={`text-xs mt-0.5 ${earned ? 'text-white/80' : 'text-gray-400'}`}>{badge.desc}</p>
      {!earned && (
        <div className="mt-2">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{streak} / {badge.req} days</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}
    </div>
  );
}

export default function SurveyStreakTracker({ user, currentTier }) {
  const { data: sessions = [] } = useQuery({
    queryKey: ['ppc-sessions-streak', user?.id],
    queryFn: () => base44.entities.PPCSession.filter({ user_id: user.id }, '-session_date', 400),
    enabled: !!user
  });

  const { data: dailyEarnings = [] } = useQuery({
    queryKey: ['daily-earnings-streak', user?.id],
    queryFn: () => base44.entities.DailyEarnings.filter({ user_id: user.id }, '-created_date', 400),
    enabled: !!user
  });

  // Build a set of dates with activity
  const activeDates = useMemo(() => {
    const dates = new Set();
    sessions.forEach(s => s.session_date && dates.add(s.session_date));
    dailyEarnings.forEach(d => {
      if (d.created_date) dates.add(format(new Date(d.created_date), 'yyyy-MM-dd'));
    });
    return dates;
  }, [sessions, dailyEarnings]);

  // Calculate current streak
  const { currentStreak, longestStreak } = useMemo(() => {
    let current = 0;
    let longest = 0;
    let streak = 0;
    const today = new Date();

    for (let i = 0; i < 400; i++) {
      const date = format(subDays(today, i), 'yyyy-MM-dd');
      if (activeDates.has(date)) {
        streak++;
        if (i === 0 || i === 1) current = streak; // allow today or yesterday as start
      } else {
        if (i > 1) { if (streak > longest) longest = streak; streak = 0; }
      }
    }
    return { currentStreak: current, longestStreak: Math.max(longest, streak) };
  }, [activeDates]);

  // Build last 30-day calendar
  const last30Days = useMemo(() => {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      days.push({ date, dateStr, active: activeDates.has(dateStr) });
    }
    return days;
  }, [activeDates]);

  const earnedBadges = BADGES.filter(b => currentStreak >= b.unlockDays || longestStreak >= b.unlockDays);
  const nextBadge = BADGES.find(b => currentStreak < b.unlockDays);
  const bonusPercent = currentStreak >= 90 ? 15 : currentStreak >= 30 ? 10 : currentStreak >= 14 ? 5 : 0;

  return (
    <div className="space-y-6">

      {/* Streak Hero */}
      <Card className={`border-2 ${currentStreak >= 7 ? 'border-orange-300 bg-gradient-to-r from-orange-50 to-red-50' : 'border-gray-200'}`}>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <div className="flex items-center gap-3 justify-center md:justify-start mb-2">
                <Flame className={`w-10 h-10 ${currentStreak > 0 ? 'text-orange-500' : 'text-gray-300'}`} />
                <div>
                  <p className="text-5xl font-black text-gray-900">{currentStreak}</p>
                  <p className="text-sm text-gray-500 font-medium">Day Streak</p>
                </div>
              </div>
              {bonusPercent > 0 && (
                <Badge className="bg-green-100 text-green-700 text-sm px-3 py-1">
                  <Zap className="w-3 h-3 mr-1" />+{bonusPercent}% Earnings Bonus Active!
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-white rounded-xl p-3 shadow-sm border">
                <p className="text-2xl font-bold text-purple-600">{longestStreak}</p>
                <p className="text-xs text-gray-500">Longest Streak</p>
              </div>
              <div className="bg-white rounded-xl p-3 shadow-sm border">
                <p className="text-2xl font-bold text-blue-600">{activeDates.size}</p>
                <p className="text-xs text-gray-500">Total Active Days</p>
              </div>
              <div className="bg-white rounded-xl p-3 shadow-sm border">
                <p className="text-2xl font-bold text-green-600">{earnedBadges.length}</p>
                <p className="text-xs text-gray-500">Badges Earned</p>
              </div>
              <div className="bg-white rounded-xl p-3 shadow-sm border">
                <p className="text-2xl font-bold text-orange-600">{bonusPercent}%</p>
                <p className="text-xs text-gray-500">Streak Bonus</p>
              </div>
            </div>
          </div>

          {/* Next badge progress */}
          {nextBadge && (
            <div className="mt-5 pt-4 border-t">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600 font-medium">Next badge: <strong>{nextBadge.label}</strong></span>
                <span className="text-gray-500">{currentStreak} / {nextBadge.req} days</span>
              </div>
              <Progress value={Math.min((currentStreak / nextBadge.req) * 100, 100)} className="h-3" />
              <p className="text-xs text-gray-400 mt-1">{nextBadge.req - currentStreak} more day{nextBadge.req - currentStreak !== 1 ? 's' : ''} to unlock "{nextBadge.label}"</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 30-Day Calendar */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <CheckCircle2 className="w-5 h-5 text-green-500" /> 30-Day Activity Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-10 gap-1.5">
            {last30Days.map(({ date, dateStr, active }) => (
              <div
                key={dateStr}
                title={format(date, 'MMM d') + (active ? ' ✓ Active' : ' — No activity')}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center cursor-default transition-all
                  ${active
                    ? 'bg-gradient-to-br from-green-400 to-emerald-500 shadow-sm'
                    : isSameDay(date, new Date())
                      ? 'bg-blue-100 border-2 border-blue-400'
                      : 'bg-gray-100'}`}
              >
                <span className={`text-[9px] font-bold leading-none ${active ? 'text-white' : 'text-gray-400'}`}>
                  {format(date, 'd')}
                </span>
                {active && <div className="w-1 h-1 bg-white rounded-full mt-0.5 opacity-80" />}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-gradient-to-br from-green-400 to-emerald-500" />
              Active day
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-blue-100 border border-blue-400" />
              Today
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-gray-100" />
              Inactive
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Badges Grid */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" /> Achievement Badges
            <Badge className="ml-auto bg-yellow-100 text-yellow-700">{earnedBadges.length} / {BADGES.length} earned</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {BADGES.map(badge => (
              <BadgeCard
                key={badge.id}
                badge={badge}
                earned={currentStreak >= badge.unlockDays || longestStreak >= badge.unlockDays}
                streak={currentStreak}
              />
            ))}
          </div>
          <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200">
            <p className="text-xs text-amber-800 font-medium mb-1">🏆 Streak Bonus Rewards</p>
            <div className="grid grid-cols-3 gap-2 text-xs text-amber-700">
              <span>14 days → +5% earnings</span>
              <span>30 days → +10% earnings</span>
              <span>90 days → +15% earnings</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
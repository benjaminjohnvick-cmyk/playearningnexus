import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Zap, CheckCircle2, Lock, Shield, ShoppingBag, Calendar, TrendingUp, Star } from 'lucide-react';
import { format, subDays, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from 'date-fns';
import { toast } from 'sonner';
import { useEffect } from 'react';

const MULTIPLIERS = [
  { days: 1,  mult: 1.00, label: '1.0×', color: 'bg-gray-200 text-gray-600' },
  { days: 3,  mult: 1.05, label: '1.05×', color: 'bg-orange-200 text-orange-700' },
  { days: 7,  mult: 1.10, label: '1.10×', color: 'bg-amber-200 text-amber-700' },
  { days: 14, mult: 1.20, label: '1.20×', color: 'bg-yellow-200 text-yellow-700' },
  { days: 21, mult: 1.30, label: '1.30×', color: 'bg-green-200 text-green-700' },
  { days: 30, mult: 1.50, label: '1.50×', color: 'bg-emerald-300 text-emerald-800' },
  { days: 60, mult: 2.00, label: '2.0×',  color: 'bg-purple-300 text-purple-800' },
  { days: 90, mult: 2.50, label: '2.5×',  color: 'bg-violet-300 text-violet-800' },
];

const FREEZE_COST = 500; // points

function getMultiplier(streak) {
  return [...MULTIPLIERS].reverse().find(m => streak >= m.days) || MULTIPLIERS[0];
}
function getNextMultiplier(streak) {
  return MULTIPLIERS.find(m => m.days > streak);
}

function CalendarGrid({ earningDates }) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today);
  const days = eachDayOfInterval({ start: startOfMonth(viewMonth), end: endOfMonth(viewMonth) });
  const firstDow = startOfMonth(viewMonth).getDay();

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setViewMonth(d => subDays(startOfMonth(d), 1))} className="text-gray-400 hover:text-gray-700 p-1 rounded">‹</button>
        <span className="font-bold text-gray-800 text-sm">{format(viewMonth, 'MMMM yyyy')}</span>
        <button onClick={() => setViewMonth(d => addDays(endOfMonth(d), 1))} className="text-gray-400 hover:text-gray-700 p-1 rounded">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="text-xs text-gray-400 font-medium">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd');
          const isToday = key === format(today, 'yyyy-MM-dd');
          const earned = earningDates.has(key);
          const isFuture = day > today;
          return (
            <div key={key} className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium transition-all
              ${earned ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-sm' :
                isToday ? 'border-2 border-orange-400 text-orange-600' :
                isFuture ? 'text-gray-200' : 'bg-gray-50 text-gray-400'}`}>
              <span>{format(day, 'd')}</span>
              {earned && <Flame className="w-2 h-2 mt-0.5 text-white/80" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DailyEarningStreak() {
  const [user, setUser] = useState(null);
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: dailyEarnings = [] } = useQuery({
    queryKey: ['streak-page-earnings', user?.id],
    queryFn: () => base44.entities.DailyEarnings.filter({ user_id: user.id }, '-date', 120),
    enabled: !!user,
  });

  const { data: streakRecords = [] } = useQuery({
    queryKey: ['streak-page-record', user?.id],
    queryFn: () => base44.entities.Streak.filter({ user_id: user.id }),
    enabled: !!user,
  });

  const streakRecord = streakRecords[0];
  const freezesOwned = user?.streak_freezes || 0;

  const earningDates = useMemo(() => new Set(
    dailyEarnings.filter(e => e.total_surveys_completed > 0).map(e => e.date)
  ), [dailyEarnings]);

  const { currentStreak, longestStreak, completedToday } = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    let streak = 0;
    const completed = earningDates.has(today);
    for (let i = completed ? 0 : 1; i < 120; i++) {
      const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
      if (earningDates.has(d)) streak++;
      else break;
    }
    return { currentStreak: streak, longestStreak: Math.max(streakRecord?.longest_streak || 0, streak), completedToday: completed };
  }, [earningDates, streakRecord]);

  const currentMult = getMultiplier(currentStreak);
  const nextMult = getNextMultiplier(currentStreak);
  const progressPct = nextMult ? (currentStreak / nextMult.days) * 100 : 100;
  const points = user?.points || 0;

  const buyFreeze = useMutation({
    mutationFn: async () => {
      if (points < FREEZE_COST) throw new Error('Not enough points');
      await base44.auth.updateMe({
        points: points - FREEZE_COST,
        streak_freezes: freezesOwned + 1,
      });
    },
    onSuccess: () => {
      setUser(prev => ({ ...prev, points: points - FREEZE_COST, streak_freezes: freezesOwned + 1 }));
      toast.success('❄️ Streak Freeze purchased! Your streak is protected for 1 missed day.');
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Hero */}
        <div className="text-center py-4">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl flex items-center justify-center mx-auto mb-3 shadow-xl"
          >
            <Flame className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-3xl font-black text-gray-900">Daily Earning Streak</h1>
          <p className="text-gray-500 mt-1">Complete a survey every day. The longer your streak, the bigger your bonus multiplier.</p>
        </div>

        {/* Current streak + multiplier */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="border-0 shadow-xl overflow-hidden md:col-span-1">
            <div className="bg-gradient-to-br from-orange-500 to-red-600 p-6 text-white text-center">
              <motion.p key={currentStreak} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="text-7xl font-black">{currentStreak}</motion.p>
              <p className="text-orange-100 font-medium">Day Streak 🔥</p>
              <p className="text-orange-200 text-xs mt-1">Best: {longestStreak} days</p>
            </div>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Current Multiplier</span>
                <span className={`font-black text-lg px-2.5 py-0.5 rounded-full ${currentMult.color}`}>{currentMult.label}</span>
              </div>
              {nextMult && (
                <>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Next: {nextMult.label} at day {nextMult.days}</span>
                    <span className="font-medium">{currentStreak}/{nextMult.days}</span>
                  </div>
                  <Progress value={progressPct} className="h-2 [&>div]:bg-orange-500" />
                  <p className="text-xs text-gray-400">{nextMult.days - currentStreak} more days to unlock</p>
                </>
              )}
              {completedToday
                ? <Badge className="w-full justify-center bg-green-100 text-green-700 gap-1"><CheckCircle2 className="w-3 h-3" /> Completed today!</Badge>
                : <Badge className="w-full justify-center bg-amber-100 text-amber-700 animate-pulse">⚡ Survey needed today!</Badge>
              }
            </CardContent>
          </Card>

          {/* Calendar */}
          <Card className="border-0 shadow-xl md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-orange-500" /> Earning Calendar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CalendarGrid earningDates={earningDates} />
              <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-gradient-to-br from-orange-400 to-red-500" /> Earned</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded border-2 border-orange-400" /> Today</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-gray-100" /> Missed</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Multiplier ladder */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-orange-500" /> Multiplier Ladder</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
              {MULTIPLIERS.map(m => {
                const reached = currentStreak >= m.days;
                const current = currentMult.days === m.days;
                return (
                  <div key={m.days} className={`rounded-xl p-2 text-center border-2 transition-all ${
                    current ? 'border-orange-400 shadow-md scale-105' :
                    reached ? 'border-green-300 bg-green-50' : 'border-gray-100 bg-gray-50 opacity-50'
                  }`}>
                    <p className="text-xs text-gray-500 mb-0.5">Day {m.days}</p>
                    <p className={`text-sm font-black ${reached ? 'text-orange-600' : 'text-gray-400'}`}>{m.label}</p>
                    {reached ? <CheckCircle2 className="w-3 h-3 text-green-500 mx-auto mt-0.5" /> : <Lock className="w-3 h-3 text-gray-300 mx-auto mt-0.5" />}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Streak Freeze shop */}
        <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-lg">
          <CardContent className="p-5">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl">❄️</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-gray-900">Streak Freeze</h3>
                  <Badge className="bg-blue-100 text-blue-700">Shop Item</Badge>
                  {freezesOwned > 0 && <Badge className="bg-green-100 text-green-700">Owned: {freezesOwned}</Badge>}
                </div>
                <p className="text-sm text-gray-600">Protect your streak for one missed day. The freeze is consumed automatically if you miss a day.</p>
                <p className="text-xs text-gray-400 mt-1">You have <strong>{points} points</strong></p>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <div className="flex items-center gap-1 text-sm font-bold text-amber-600">
                  <Star className="w-4 h-4" /> {FREEZE_COST} pts
                </div>
                <Button
                  onClick={() => buyFreeze.mutate()}
                  disabled={points < FREEZE_COST || buyFreeze.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-sm h-8"
                >
                  <ShoppingBag className="w-3.5 h-3.5 mr-1" /> Buy Freeze
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Current Streak', value: `${currentStreak} days`, icon: Flame, color: 'text-orange-500' },
            { label: 'Best Streak', value: `${longestStreak} days`, icon: Star, color: 'text-yellow-500' },
            { label: 'Streak Freezes', value: freezesOwned, icon: Shield, color: 'text-blue-500' },
          ].map(s => (
            <Card key={s.label} className="border-0 shadow-md">
              <CardContent className="pt-4 pb-3 text-center">
                <s.icon className={`w-6 h-6 ${s.color} mx-auto mb-1`} />
                <p className="text-xl font-black text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Miss warning */}
        {!completedToday && currentStreak > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 text-center"
          >
            <p className="text-red-700 font-bold">⚠️ Your {currentStreak}-day streak is at risk!</p>
            <p className="text-red-500 text-sm mt-1">
              {freezesOwned > 0 ? `You have ${freezesOwned} freeze(s) — it'll be used automatically if you miss today.` : 'Complete a survey today to keep your streak!'}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Star, Zap, Gift, CheckCircle2, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';

const STREAK_KEY = 'gg_login_streak';
const LAST_LOGIN_KEY = 'gg_last_login_date';

const MILESTONES = [
  { days: 3,  bonus: 10,  badge: '🔥 Starter',     mult: null },
  { days: 7,  bonus: 25,  badge: '⚡ Week Warrior', mult: '1.05×' },
  { days: 14, bonus: 50,  badge: '🌟 2-Week Star',  mult: '1.1×' },
  { days: 30, bonus: 100, badge: '💎 Monthly Elite', mult: '1.25×' },
  { days: 60, bonus: 250, badge: '🏆 Diamond Loyal', mult: '1.5×' },
  { days: 90, bonus: 500, badge: '👑 Legend',        mult: '2.0×' },
];

function getMilestone(streak) {
  return [...MILESTONES].reverse().find(m => streak >= m.days) || null;
}
function getNextMilestone(streak) {
  return MILESTONES.find(m => m.days > streak);
}

export default function DailyLoginStreak({ user, compact = false }) {
  const [streakData, setStreakData] = useState({ streak: 0, claimedToday: false });
  const [showReward, setShowReward] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;

    const today = format(new Date(), 'yyyy-MM-dd');
    const lastLogin = localStorage.getItem(LAST_LOGIN_KEY);
    const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
    let streak = parseInt(localStorage.getItem(STREAK_KEY) || '0', 10);

    if (lastLogin === today) {
      // Already claimed today
      setStreakData({ streak, claimedToday: true });
      return;
    }

    if (lastLogin === yesterday) {
      // Consecutive day — increment
      streak = streak + 1;
    } else if (lastLogin && lastLogin < yesterday) {
      // Missed a day — check if user has streak freeze
      const freezes = user.streak_freezes || 0;
      if (freezes > 0) {
        // Use a freeze silently
        base44.auth.updateMe({ streak_freezes: freezes - 1 }).catch(() => {});
        streak = streak; // keep streak
      } else {
        streak = 1; // reset
      }
    } else {
      streak = 1; // first ever login
    }

    localStorage.setItem(STREAK_KEY, streak.toString());
    localStorage.setItem(LAST_LOGIN_KEY, today);

    // Daily bonus: 1pt per day + milestone bonuses
    const dailyBonus = Math.max(1, Math.floor(streak / 5)); // increases every 5 days
    const milestone = MILESTONES.find(m => m.days === streak);
    const totalBonus = dailyBonus + (milestone?.bonus || 0);

    base44.auth.updateMe({ points: (user.points || 0) + totalBonus })
      .then(() => {
        if (milestone) {
          // Award badge if not already owned
          const existing = user.badges || [];
          if (!existing.includes(milestone.badge)) {
            base44.auth.updateMe({ badges: [...existing, milestone.badge] }).catch(() => {});
          }
          setRewardAmount(totalBonus);
          setShowReward(true);
          setTimeout(() => setShowReward(false), 5000);
        } else if (streak > 1) {
          toast(`🔥 Day ${streak} streak! +${totalBonus} bonus points`, { duration: 4000 });
        }
      })
      .catch(() => {});

    setStreakData({ streak, claimedToday: true });
  }, [user?.id]);

  const { streak, claimedToday } = streakData;
  const currentMilestone = getMilestone(streak);
  const nextMilestone = getNextMilestone(streak);
  const progressPct = nextMilestone ? Math.min(100, (streak / nextMilestone.days) * 100) : 100;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-orange-100 text-orange-700 rounded-full px-2.5 py-1 text-xs font-bold">
          <Flame className="w-3.5 h-3.5" />
          {streak} day{streak !== 1 ? 's' : ''}
        </div>
        {currentMilestone && (
          <span className="text-xs font-bold text-purple-600">{currentMilestone.mult}</span>
        )}
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {showReward && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
          >
            <div className="bg-gradient-to-br from-yellow-400 to-orange-500 text-white rounded-3xl p-8 shadow-2xl text-center pointer-events-auto max-w-sm mx-4">
              <div className="text-6xl mb-3">🎉</div>
              <h2 className="text-2xl font-black">Milestone Reached!</h2>
              <p className="text-yellow-100 mt-1">{streak}-day login streak</p>
              <p className="text-3xl font-black mt-2">+{rewardAmount} pts</p>
              {currentMilestone && <p className="text-yellow-200 text-sm mt-1">Badge unlocked: {currentMilestone.badge}</p>}
              <Button onClick={() => setShowReward(false)} className="mt-4 bg-white text-orange-600 hover:bg-yellow-50 font-bold">
                Awesome! 🔥
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="border-0 shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-red-600 p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                <Flame className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-orange-100 text-xs font-medium">Daily Login Streak</p>
                <p className="text-3xl font-black">{streak} <span className="text-orange-200 text-base font-medium">days</span></p>
              </div>
            </div>
            {claimedToday && (
              <Badge className="bg-white/20 text-white border-0 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Logged in today
              </Badge>
            )}
          </div>
        </div>

        <CardContent className="p-4 space-y-4">
          {/* Current milestone badge */}
          {currentMilestone && (
            <div className="flex items-center gap-2 bg-purple-50 rounded-xl px-3 py-2">
              <Star className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-bold text-purple-700">Active badge: {currentMilestone.badge}</span>
              {currentMilestone.mult && <Badge className="ml-auto bg-purple-100 text-purple-700 border-0 text-xs">{currentMilestone.mult} multiplier</Badge>}
            </div>
          )}

          {/* Progress to next */}
          {nextMilestone && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Next: {nextMilestone.badge} at day {nextMilestone.days}</span>
                <span className="font-medium">{streak}/{nextMilestone.days}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.8 }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">{nextMilestone.days - streak} more days · +{nextMilestone.bonus} bonus pts + {nextMilestone.badge}</p>
            </div>
          )}

          {/* Milestones grid */}
          <div className="grid grid-cols-3 gap-2">
            {MILESTONES.map(m => {
              const reached = streak >= m.days;
              const current = getMilestone(streak)?.days === m.days;
              return (
                <div key={m.days} className={`rounded-xl p-2 text-center border transition-all ${
                  current ? 'border-orange-400 bg-orange-50 shadow' :
                  reached ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50 opacity-50'
                }`}>
                  <p className="text-lg">{reached ? m.badge.split(' ')[0] : '🔒'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Day {m.days}</p>
                  {m.mult && <p className="text-xs font-bold text-purple-600">{m.mult}</p>}
                  <p className="text-xs text-green-600 font-bold">+{m.bonus}pts</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
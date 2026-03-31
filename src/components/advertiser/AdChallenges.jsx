import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Swords, Clock, Zap, Star, CheckCircle, Lock, TrendingUp, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { differenceInDays, startOfWeek, endOfWeek, format } from 'date-fns';

const WEEKLY_CHALLENGES = [
  {
    id: 'survey_sprint',
    title: 'Survey Sprint',
    description: 'Complete 50 surveys this week across all your active ads.',
    metric: 'surveys_completed',
    target: 50,
    reward: '2× grid visibility boost for 48h',
    rewardType: 'visibility',
    icon: Zap,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/30',
  },
  {
    id: 'ctr_champion',
    title: 'CTR Champion',
    description: 'Achieve an average CTR above 5% across all ads.',
    metric: 'ctr',
    target: 5,
    reward: 'Premium Zone placement for 24h',
    rewardType: 'premium_zone',
    icon: TrendingUp,
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/30',
  },
  {
    id: 'big_spender',
    title: 'Big Spender',
    description: 'Spend $20 or more on surveys this week.',
    metric: 'total_spent',
    target: 20,
    reward: 'Featured advertiser badge + 3× exposure',
    rewardType: 'featured',
    icon: Star,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/30',
  },
  {
    id: 'click_blitz',
    title: 'Click Blitz',
    description: 'Get 200 clicks on your ads this week.',
    metric: 'total_clicks',
    target: 200,
    reward: 'Top of Economy zone for 72h',
    rewardType: 'zone_boost',
    icon: Trophy,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/30',
  },
];

function computeProgress(ads, metric) {
  if (metric === 'ctr') {
    const totalClicks = ads.reduce((s, a) => s + (a.total_clicks || 0), 0);
    const totalCompleted = ads.reduce((s, a) => s + (a.surveys_completed || 0), 0);
    return totalClicks > 0 ? (totalCompleted / totalClicks) * 100 : 0;
  }
  return ads.reduce((s, a) => s + (a[metric] || 0), 0);
}

export default function AdChallenges({ ads }) {
  const [joined, setJoined] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ad_joined_challenges') || '[]'); } catch { return []; }
  });
  const [claimed, setClaimed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ad_claimed_challenges') || '[]'); } catch { return []; }
  });

  const now = new Date();
  const weekEnd = endOfWeek(now);
  const daysLeft = differenceInDays(weekEnd, now);
  const weekLabel = `${format(startOfWeek(now), 'MMM d')} – ${format(weekEnd, 'MMM d')}`;

  const joinChallenge = (id) => {
    const next = [...joined, id];
    setJoined(next);
    localStorage.setItem('ad_joined_challenges', JSON.stringify(next));
    toast.success('Challenge joined! Good luck this week 🏆');
  };

  const claimReward = (challenge) => {
    const next = [...claimed, challenge.id];
    setClaimed(next);
    localStorage.setItem('ad_claimed_challenges', JSON.stringify(next));
    toast.success(`Reward claimed: ${challenge.reward}!`);
  };

  return (
    <div className="space-y-4">
      {/* Week header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-bold text-white">Weekly Challenges</span>
          <Badge className="bg-gray-800 text-gray-400 text-xs">{weekLabel}</Badge>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          {daysLeft}d left
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {WEEKLY_CHALLENGES.map(ch => {
          const Icon = ch.icon;
          const isJoined = joined.includes(ch.id);
          const isClaimed = claimed.includes(ch.id);
          const progress = computeProgress(ads, ch.metric);
          const pct = Math.min(100, (progress / ch.target) * 100);
          const completed = pct >= 100;

          return (
            <div key={ch.id} className={`border rounded-2xl p-4 ${ch.bg} ${isClaimed ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${ch.color}`} />
                  <span className="text-white font-bold text-sm">{ch.title}</span>
                </div>
                {isClaimed && <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />}
                {!isJoined && !isClaimed && (
                  <Badge className="bg-gray-700 text-gray-400 text-[10px]">Not joined</Badge>
                )}
              </div>

              <p className="text-gray-400 text-xs mb-3">{ch.description}</p>

              {/* Progress bar */}
              {isJoined && !isClaimed && (
                <div className="mb-3">
                  <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                    <span>{ch.metric === 'ctr' ? `${progress.toFixed(1)}%` : Math.floor(progress)} / {ch.metric === 'ctr' ? `${ch.target}%` : ch.target}</span>
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${completed ? 'bg-green-500' : 'bg-yellow-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Reward */}
              <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-3">
                <Star className="w-3 h-3 text-yellow-400" />
                <span>{ch.reward}</span>
              </div>

              {/* Action */}
              {isClaimed ? (
                <span className="text-xs text-green-400 font-bold flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Reward Claimed
                </span>
              ) : completed && isJoined ? (
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-500 text-white font-black text-xs h-7 w-full gap-1"
                  onClick={() => claimReward(ch)}
                >
                  <Star className="w-3 h-3" /> Claim Reward
                </Button>
              ) : isJoined ? (
                <span className="text-xs text-gray-500 italic">Keep going — {daysLeft}d left</span>
              ) : (
                <Button
                  size="sm"
                  className="bg-gray-700 hover:bg-gray-600 text-white font-bold text-xs h-7 w-full gap-1"
                  onClick={() => joinChallenge(ch.id)}
                >
                  <Swords className="w-3 h-3" /> Join Challenge
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
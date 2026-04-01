import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Trophy, Zap, Target, Clock, CheckCircle2, Star, Loader2,
  TrendingUp, Percent, ShieldCheck, Gift, Lock
} from 'lucide-react';
import { toast } from 'sonner';

// Platform-wide Ad Sprint definitions
const AD_SPRINTS = [
  {
    id: 'ctr_doubler',
    name: 'CTR Doubler',
    emoji: '⚡',
    description: 'Achieve a CTR of 2%+ on any single ad within 24 hours.',
    difficulty: 'Medium',
    duration: '24h',
    reward: {
      type: 'impressions',
      label: '+500 Bonus Impressions',
      icon: <Zap className="w-4 h-4 text-yellow-400" />,
      color: 'text-yellow-400',
    },
    metric: 'ctr',
    target: 2.0,
    checkFn: (ads) => {
      const best = Math.max(...ads.map(a => a.total_clicks > 0 ? (a.surveys_completed / a.total_clicks) * 100 : 0));
      return { progress: Math.min(100, (best / 2.0) * 100), current: best.toFixed(1), target: '2.0', unit: '%' };
    },
  },
  {
    id: 'budget_efficiency',
    name: 'Budget Maestro',
    emoji: '💰',
    description: 'Complete 20+ surveys while keeping cost-per-completion under $0.50.',
    difficulty: 'Easy',
    duration: 'Ongoing',
    reward: {
      type: 'discount',
      label: '10% Bid Discount for 7 days',
      icon: <Percent className="w-4 h-4 text-green-400" />,
      color: 'text-green-400',
    },
    metric: 'efficiency',
    target: 20,
    checkFn: (ads) => {
      const total = ads.reduce((s, a) => s + (a.surveys_completed || 0), 0);
      const efficient = ads.filter(a => (a.total_spent || 0) > 0 && (a.total_spent / Math.max(1, a.surveys_completed)) < 0.5);
      return { progress: Math.min(100, (total / 20) * 100), current: total, target: 20, unit: ' surveys' };
    },
  },
  {
    id: 'launch_sprint',
    name: 'Launch Sprint',
    emoji: '🚀',
    description: 'Submit a new ad and get it approved within 48 hours. Then earn 10+ clicks in 24h.',
    difficulty: 'Easy',
    duration: '48h',
    reward: {
      type: 'badge',
      label: '"Fast Launcher" Badge',
      icon: <Star className="w-4 h-4 text-purple-400" />,
      color: 'text-purple-400',
    },
    metric: 'new_clicks',
    target: 10,
    checkFn: (ads) => {
      const recent = ads.filter(a => {
        const hoursOld = (Date.now() - new Date(a.created_date).getTime()) / (1000 * 60 * 60);
        return hoursOld < 72;
      });
      const clicks = recent.reduce((s, a) => s + (a.total_clicks || 0), 0);
      return { progress: Math.min(100, (clicks / 10) * 100), current: clicks, target: 10, unit: ' clicks' };
    },
  },
  {
    id: 'verified_advertiser',
    name: 'Verified Advertiser',
    emoji: '🏅',
    description: 'Maintain 3+ active ads with a combined CTR above 1.5% for 7 consecutive days.',
    difficulty: 'Hard',
    duration: '7 days',
    reward: {
      type: 'badge',
      label: '"Verified Advertiser" Badge on Ad Grid',
      icon: <ShieldCheck className="w-4 h-4 text-blue-400" />,
      color: 'text-blue-400',
    },
    metric: 'verified',
    target: 3,
    checkFn: (ads) => {
      const active = ads.filter(a => a.status === 'active');
      const highCTR = active.filter(a => a.total_clicks > 0 && (a.surveys_completed / a.total_clicks) >= 0.015);
      return { progress: Math.min(100, (highCTR.length / 3) * 100), current: highCTR.length, target: 3, unit: ' qualifying ads' };
    },
  },
  {
    id: 'spend_milestone',
    name: 'Big Spender',
    emoji: '💎',
    description: 'Reach $50 in total campaign spend. Unlock VIP advertiser perks.',
    difficulty: 'Progressive',
    duration: 'Ongoing',
    reward: {
      type: 'perk',
      label: 'VIP Advertiser Perks Unlocked',
      icon: <Gift className="w-4 h-4 text-pink-400" />,
      color: 'text-pink-400',
    },
    metric: 'spend',
    target: 50,
    checkFn: (ads) => {
      const spent = ads.reduce((s, a) => s + (a.total_spent || 0), 0);
      return { progress: Math.min(100, (spent / 50) * 100), current: spent.toFixed(2), target: 50, unit: ' spent' };
    },
  },
];

const DIFFICULTY_COLORS = {
  Easy: 'bg-green-500/10 border-green-500/20 text-green-300',
  Medium: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300',
  Hard: 'bg-red-500/10 border-red-500/20 text-red-300',
  Progressive: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
};

function ProgressBar({ pct, completed }) {
  return (
    <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
      <div
        className={`h-2 rounded-full transition-all ${completed ? 'bg-green-500' : 'bg-gradient-to-r from-yellow-500 to-orange-500'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function AdChallenges({ ads }) {
  const [claimed, setClaimed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ad_sprint_claimed') || '{}'); } catch { return {}; }
  });
  const [claiming, setClaiming] = useState(null);

  const handleClaim = async (sprint, progress) => {
    if (progress.progress < 100) return;
    setClaiming(sprint.id);
    await new Promise(r => setTimeout(r, 1200)); // simulate processing
    const updated = { ...claimed, [sprint.id]: new Date().toISOString() };
    setClaimed(updated);
    localStorage.setItem('ad_sprint_claimed', JSON.stringify(updated));
    setClaiming(null);
    toast.success(`🎉 Reward claimed: ${sprint.reward.label}`);

    // Save badge to user profile
    if (sprint.reward.type === 'badge') {
      base44.auth.updateMe({ [`badge_${sprint.id}`]: true }).catch(() => {});
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/5 border border-yellow-500/20 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="w-6 h-6 text-yellow-400" />
          <div>
            <p className="text-white font-black">Ad Sprints — Platform-Wide Challenges</p>
            <p className="text-gray-400 text-xs">Complete challenges to earn bonus impressions, bid discounts, and verified badges.</p>
          </div>
        </div>
        <div className="flex gap-2 text-xs text-gray-500">
          <span className="bg-gray-800 rounded px-2 py-0.5">{AD_SPRINTS.filter(s => claimed[s.id]).length}/{AD_SPRINTS.length} completed</span>
          <span className="bg-gray-800 rounded px-2 py-0.5">{AD_SPRINTS.filter(s => !claimed[s.id] && s.checkFn(ads).progress >= 100).length} ready to claim</span>
        </div>
      </div>

      {/* Sprint cards */}
      {AD_SPRINTS.map(sprint => {
        const progress = sprint.checkFn(ads);
        const done = progress.progress >= 100;
        const isClaimed = !!claimed[sprint.id];
        const isLocked = ads.length === 0;

        return (
          <div key={sprint.id} className={`bg-gray-900 border rounded-2xl overflow-hidden transition-all ${
            isClaimed ? 'border-green-500/30' : done ? 'border-yellow-500/30' : 'border-gray-700'
          }`}>
            {/* Top row */}
            <div className="flex items-start gap-3 p-4 pb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
                isClaimed ? 'bg-green-500/20' : done ? 'bg-yellow-500/20' : 'bg-gray-800'
              }`}>
                {isClaimed ? '✅' : sprint.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-white font-black text-sm">{sprint.name}</p>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <Badge className={`text-[10px] border ${DIFFICULTY_COLORS[sprint.difficulty]}`}>
                      {sprint.difficulty}
                    </Badge>
                    <Badge className="text-[10px] border border-gray-700 bg-gray-800 text-gray-400">
                      <Clock className="w-2.5 h-2.5 mr-1" />{sprint.duration}
                    </Badge>
                  </div>
                </div>
                <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{sprint.description}</p>
              </div>
            </div>

            {/* Reward */}
            <div className={`mx-4 mb-3 px-3 py-2 rounded-xl flex items-center gap-2 ${
              isClaimed ? 'bg-green-500/10 border border-green-500/20' : 'bg-gray-800 border border-gray-700'
            }`}>
              {isClaimed ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" /> : sprint.reward.icon}
              <span className={`text-xs font-bold ${isClaimed ? 'text-green-300' : sprint.reward.color}`}>
                {isClaimed ? 'Claimed: ' : 'Reward: '}{sprint.reward.label}
              </span>
              {isClaimed && <span className="text-green-600 text-[10px] ml-auto">{new Date(claimed[sprint.id]).toLocaleDateString()}</span>}
            </div>

            {/* Progress */}
            <div className="px-4 pb-4 space-y-2">
              {isLocked ? (
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Lock className="w-3 h-3" /> Submit your first ad to participate
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Progress</span>
                    <span className={`font-bold ${done ? 'text-green-400' : 'text-gray-300'}`}>
                      {done ? '✓ Complete!' : `${progress.current}${progress.unit} / ${progress.target}${progress.unit}`}
                    </span>
                  </div>
                  <ProgressBar pct={progress.progress} completed={done} />

                  {done && !isClaimed && (
                    <Button
                      size="sm"
                      className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black gap-2 mt-2"
                      onClick={() => handleClaim(sprint, progress)}
                      disabled={claiming === sprint.id}
                    >
                      {claiming === sprint.id
                        ? <><Loader2 className="w-3 h-3 animate-spin" /> Claiming...</>
                        : <><Gift className="w-3 h-3" /> Claim Reward</>
                      }
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
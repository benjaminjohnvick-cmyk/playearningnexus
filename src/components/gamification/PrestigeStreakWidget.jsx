import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Flame, Trophy, Zap, Star, Diamond, Award, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const BADGE_STYLES = {
  bronze: { bg: 'from-amber-600 to-amber-800', text: 'text-amber-100', icon: '🥉' },
  silver: { bg: 'from-gray-400 to-gray-600', text: 'text-gray-100', icon: '🥈' },
  gold: { bg: 'from-yellow-400 to-yellow-600', text: 'text-yellow-900', icon: '🥇' },
  platinum: { bg: 'from-cyan-400 to-cyan-600', text: 'text-cyan-900', icon: '💎' },
  diamond: { bg: 'from-blue-400 to-purple-600', text: 'text-white', icon: '💠' },
  legendary: { bg: 'from-purple-500 via-pink-500 to-red-500', text: 'text-white', icon: '👑' },
};

export default function PrestigeStreakWidget({ compact = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const check = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('prestigeStreakEngine', { action: 'check' });
      setData(res.data);
      if (res.data?.badge_just_awarded) {
        toast.success(`🎉 New badge earned: ${res.data.badge_just_awarded.badge}! +${res.data.badge_just_awarded.revenue_share_bonus}% revenue share`);
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { check(); }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-xl">
        <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
        <span className="text-sm text-gray-500">Loading streak…</span>
      </div>
    );
  }

  if (!data) return null;

  const badgeStyle = data.earned_badge ? BADGE_STYLES[data.earned_badge.color] : null;
  const progressToNext = data.next_badge ? ((data.current_streak / data.next_badge.days) * 100) : 100;

  if (compact) {
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 ${data.is_at_risk ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
        <div className="text-2xl">{badgeStyle?.icon || '🔥'}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-black text-gray-900">{data.current_streak} day streak</span>
            {data.is_at_risk && <Badge className="bg-red-100 text-red-700 text-xs animate-pulse">⚠️ At Risk!</Badge>}
          </div>
          {data.earned_badge && <p className="text-xs text-orange-700">{data.earned_badge.badge} — +{data.earned_badge.revenue_share_bonus}% revenue</p>}
        </div>
        <Flame className={`w-5 h-5 ${data.is_at_risk ? 'text-red-500' : 'text-orange-500'}`} />
      </div>
    );
  }

  return (
    <Card className="border-2 border-orange-100">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <span className="font-black text-gray-900">Activity Streak & Prestige</span>
          </div>
          <button onClick={check} className="text-gray-400 hover:text-gray-600">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Streak counter */}
        <div className={`rounded-2xl p-5 text-center ${data.is_at_risk ? 'bg-red-50 border-2 border-red-200' : 'bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200'}`}>
          {data.is_at_risk && <p className="text-xs font-bold text-red-600 mb-2 animate-pulse">⚠️ LOG IN TODAY TO SAVE YOUR STREAK!</p>}
          <div className="text-6xl font-black text-orange-600">{data.current_streak}</div>
          <p className="text-sm text-gray-600 font-bold">day streak</p>
          {data.revenue_share_bonus > 0 && (
            <div className="mt-2 inline-flex items-center gap-1 bg-green-100 text-green-700 rounded-full px-3 py-1 text-xs font-bold">
              <Zap className="w-3 h-3" /> +{data.revenue_share_bonus}% Revenue Share Active
            </div>
          )}
        </div>

        {/* Current badge */}
        {badgeStyle && (
          <div className={`bg-gradient-to-r ${badgeStyle.bg} rounded-xl p-4 flex items-center gap-3`}>
            <span className="text-3xl">{badgeStyle.icon}</span>
            <div>
              <p className={`font-black ${badgeStyle.text}`}>{data.earned_badge.badge}</p>
              <p className={`text-xs ${badgeStyle.text} opacity-80`}>+{data.earned_badge.revenue_share_bonus}% revenue share bonus unlocked</p>
            </div>
          </div>
        )}

        {/* Progress to next badge */}
        {data.next_badge && (
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Progress to {data.next_badge.badge}</span>
              <span>{data.current_streak}/{data.next_badge.days} days</span>
            </div>
            <Progress value={progressToNext} className="h-2.5" />
            <p className="text-xs text-gray-500 mt-1">{data.days_to_next_badge} more days → +{data.next_badge.revenue_share_bonus}% revenue share</p>
          </div>
        )}

        {/* All prestige tiers */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">All Prestige Tiers</p>
          <div className="grid grid-cols-3 gap-2">
            {(data.prestige_tiers || []).map((tier, i) => {
              const style = BADGE_STYLES[tier.color];
              const earned = data.current_streak >= tier.days;
              return (
                <div key={i} className={`rounded-xl p-2.5 text-center border-2 transition-all ${earned ? `bg-gradient-to-br ${style.bg} border-transparent` : 'bg-gray-50 border-gray-200 opacity-50'}`}>
                  <div className="text-xl mb-0.5">{style.icon}</div>
                  <p className={`text-xs font-black ${earned ? style.text : 'text-gray-500'}`}>{tier.days}d</p>
                  <p className={`text-xs ${earned ? style.text : 'text-gray-400'} opacity-80`}>+{tier.revenue_share_bonus}%</p>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
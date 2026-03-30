import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Shield, Star, Zap, Crown, Lock, ChevronRight, TrendingUp } from 'lucide-react';

const TIERS = [
  {
    key: 'low',
    label: 'Bronze',
    icon: Shield,
    color: 'text-orange-600',
    bg: 'bg-orange-50 border-orange-200',
    badge: 'bg-orange-100 text-orange-700',
    minScore: 0,
    maxScore: 39,
    perks: ['Standard survey pool', 'Base payout rates'],
    locked: [],
  },
  {
    key: 'medium',
    label: 'Silver',
    icon: Star,
    color: 'text-slate-500',
    bg: 'bg-slate-50 border-slate-200',
    badge: 'bg-slate-100 text-slate-700',
    minScore: 40,
    maxScore: 64,
    perks: ['Expanded survey pool', '+10% payout bonus', 'Priority survey matching'],
    locked: ['Exclusive brand surveys'],
  },
  {
    key: 'high',
    label: 'Gold',
    icon: Zap,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50 border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-700',
    minScore: 65,
    maxScore: 84,
    perks: ['High-paying survey pool', '+25% payout bonus', 'Fast-track reviews', 'Exclusive brand surveys'],
    locked: ['Premium $5+ surveys'],
  },
  {
    key: 'premium',
    label: 'Platinum',
    icon: Crown,
    color: 'text-purple-600',
    bg: 'bg-purple-50 border-purple-200',
    badge: 'bg-purple-100 text-purple-700',
    minScore: 85,
    maxScore: 100,
    perks: ['All surveys unlocked', '+40% payout bonus', 'Instant payouts', 'Premium $5+ surveys', 'VIP support'],
    locked: [],
  },
];

export default function EngagementTierModule({ user }) {
  const { data: trustScore, isLoading } = useQuery({
    queryKey: ['trust-score', user?.id],
    queryFn: async () => {
      const arr = await base44.entities.RespondentTrustScore.filter({ user_id: user.id });
      return arr[0] || null;
    },
    enabled: !!user?.id,
  });

  const { data: recentResponses = [] } = useQuery({
    queryKey: ['recent-responses', user?.id],
    queryFn: () => base44.entities.PPCSurveyResponse.filter({ user_id: user.id }, '-created_date', 20),
    enabled: !!user?.id,
  });

  if (isLoading) return (
    <Card className="border-0 shadow-sm">
      <CardContent className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
      </CardContent>
    </Card>
  );

  const score = trustScore?.overall_trust_score ?? 0;
  const tierKey = trustScore?.trust_tier ?? 'low';
  const currentTierIdx = TIERS.findIndex(t => t.key === tierKey);
  const currentTier = TIERS[currentTierIdx] || TIERS[0];
  const nextTier = TIERS[currentTierIdx + 1] || null;

  const progressToNext = nextTier
    ? Math.min(100, Math.round(((score - currentTier.minScore) / (nextTier.minScore - currentTier.minScore)) * 100))
    : 100;

  const pointsToNext = nextTier ? Math.max(0, nextTier.minScore - score) : 0;

  const avgQuality = trustScore?.response_quality_score ?? 0;
  const totalResponses = trustScore?.total_responses_count ?? 0;
  const flaggedCount = trustScore?.flagged_responses_count ?? 0;
  const flagRate = totalResponses > 0 ? Math.round((flaggedCount / totalResponses) * 100) : 0;

  const TierIcon = currentTier.icon;

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-500" /> Your Engagement Tier
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Current Tier Banner */}
        <div className={`rounded-xl border-2 p-4 ${currentTier.bg} flex items-center gap-4`}>
          <div className={`w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm`}>
            <TierIcon className={`w-6 h-6 ${currentTier.color}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-bold text-gray-900 text-lg">{currentTier.label} Tier</p>
              <Badge className={currentTier.badge}>{score}/100</Badge>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Trust Score · {totalResponses} surveys completed</p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Avg Quality', value: `${avgQuality}%`, color: avgQuality >= 70 ? 'text-green-600' : 'text-yellow-600' },
            { label: 'Total Surveys', value: totalResponses, color: 'text-indigo-600' },
            { label: 'Flag Rate', value: `${flagRate}%`, color: flagRate > 10 ? 'text-red-500' : 'text-green-600' },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 rounded-lg p-3 text-center">
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Progress to next tier */}
        {nextTier && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{currentTier.label}</span>
              <span className="font-semibold text-indigo-600">{pointsToNext} pts to {nextTier.label}</span>
              <span>{nextTier.label}</span>
            </div>
            <Progress value={progressToNext} className="h-2" />
          </div>
        )}

        {/* Current perks */}
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Your Current Benefits</p>
          <div className="space-y-1">
            {currentTier.perks.map(perk => (
              <div key={perk} className="flex items-center gap-2 text-xs text-gray-700">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                {perk}
              </div>
            ))}
          </div>
        </div>

        {/* Locked next tier perks */}
        {nextTier && nextTier.perks.filter(p => !currentTier.perks.includes(p)).length > 0 && (
          <div className="bg-gray-50 rounded-xl p-3 border border-dashed border-gray-200">
            <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Unlock at {nextTier.label}
            </p>
            {nextTier.perks.filter(p => !currentTier.perks.includes(p)).map(perk => (
              <div key={perk} className="flex items-center gap-2 text-xs text-gray-400">
                <ChevronRight className="w-3 h-3 text-indigo-400" />
                {perk}
              </div>
            ))}
          </div>
        )}

        {/* How to level up */}
        {nextTier && (
          <div className="bg-indigo-50 rounded-xl p-3">
            <p className="text-xs font-semibold text-indigo-700 mb-1">How to reach {nextTier.label}</p>
            <ul className="space-y-1 text-xs text-indigo-600">
              <li>• Complete surveys carefully — avoid rushing</li>
              <li>• Vary your answers — avoid selecting the same option repeatedly</li>
              <li>• Reduce flagged responses (current: {flagRate}% — target: &lt;5%)</li>
              <li>• Stay consistent across similar questions in a survey</li>
            </ul>
          </div>
        )}

        {/* All tiers overview */}
        <div className="flex justify-between pt-1">
          {TIERS.map((tier, idx) => {
            const TIcon = tier.icon;
            const isActive = tier.key === tierKey;
            const isPast = idx < currentTierIdx;
            return (
              <div key={tier.key} className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isActive ? 'bg-white shadow-md ring-2 ring-indigo-400' : isPast ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <TIcon className={`w-4 h-4 ${isActive ? tier.color : isPast ? 'text-green-500' : 'text-gray-300'}`} />
                </div>
                <p className={`text-xs ${isActive ? 'font-bold text-gray-800' : 'text-gray-400'}`}>{tier.label}</p>
              </div>
            );
          })}
        </div>

      </CardContent>
    </Card>
  );
}
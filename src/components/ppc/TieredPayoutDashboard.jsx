import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Crown, Star, Shield, Zap, Clock, TrendingUp, Lock, CheckCircle2,
  ChevronRight, Loader2, DollarSign, Award
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const TIERS = [
  {
    key: 'low',
    label: 'Standard',
    color: 'text-gray-600',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    gradient: 'from-gray-400 to-gray-500',
    icon: Shield,
    minScore: 0,
    maxScore: 39,
    processingTime: '5–7 business days',
    bonusRate: 0,
    premiumAccess: false,
    perks: ['Standard survey access', 'Basic payout processing', 'Email support'],
  },
  {
    key: 'medium',
    label: 'Verified',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    gradient: 'from-blue-400 to-blue-600',
    icon: Star,
    minScore: 40,
    maxScore: 64,
    processingTime: '3–5 business days',
    bonusRate: 0.02,
    premiumAccess: false,
    perks: ['Faster payout processing', '+2% earning bonus', 'Priority email support', 'Dispute fast-track'],
  },
  {
    key: 'high',
    label: 'Trusted',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    gradient: 'from-purple-500 to-purple-700',
    icon: Zap,
    minScore: 65,
    maxScore: 84,
    processingTime: '1–2 business days',
    bonusRate: 0.05,
    premiumAccess: true,
    perks: ['1–2 day payout processing', '+5% earning bonus', 'Premium survey access', 'Priority dispute resolution', 'Dedicated support'],
  },
  {
    key: 'premium',
    label: 'Elite',
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    gradient: 'from-yellow-400 to-orange-500',
    icon: Crown,
    minScore: 85,
    maxScore: 100,
    processingTime: 'Same day',
    bonusRate: 0.10,
    premiumAccess: true,
    perks: ['Same-day payout processing', '+10% earning bonus', 'Exclusive premium surveys', 'Highest-paying opportunities', 'Dedicated account manager', 'Auto-approval on disputes'],
  },
];

function TierCard({ tier, isCurrentTier, trustScore }) {
  const Icon = tier.icon;
  const progress = isCurrentTier && trustScore
    ? Math.min(100, ((trustScore.overall_trust_score - tier.minScore) / (tier.maxScore - tier.minScore)) * 100)
    : 0;

  return (
    <div className={`border-2 rounded-2xl p-4 transition-all ${
      isCurrentTier ? `${tier.border} shadow-lg` : 'border-gray-100 opacity-70'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${tier.gradient} text-white`}>
          <Icon className="w-4 h-4" />
          <span className="text-sm font-bold">{tier.label}</span>
        </div>
        {isCurrentTier && (
          <Badge className="bg-green-100 text-green-700 text-xs">Your Tier</Badge>
        )}
      </div>

      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Score range</span>
          <span className="font-semibold text-gray-700">{tier.minScore}–{tier.maxScore}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Clock className="w-3 h-3 text-gray-400" />
          <span className="text-gray-600 font-medium">{tier.processingTime}</span>
        </div>
        {tier.bonusRate > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <DollarSign className="w-3 h-3 text-green-500" />
            <span className="text-green-600 font-semibold">+{(tier.bonusRate * 100).toFixed(0)}% earning bonus</span>
          </div>
        )}
        {tier.premiumAccess && (
          <div className="flex items-center gap-2 text-xs">
            <Award className="w-3 h-3 text-yellow-500" />
            <span className="text-yellow-600 font-medium">Premium surveys unlocked</span>
          </div>
        )}
      </div>

      {isCurrentTier && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progress in tier</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      <ul className="space-y-1">
        {tier.perks.map(perk => (
          <li key={perk} className="flex items-start gap-1.5 text-xs text-gray-600">
            <CheckCircle2 className={`w-3 h-3 mt-0.5 flex-shrink-0 ${isCurrentTier ? 'text-green-500' : 'text-gray-300'}`} />
            {perk}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function TieredPayoutDashboard({ user }) {
  const { data: trustScoreArr = [], isLoading } = useQuery({
    queryKey: ['trust-score', user?.id],
    queryFn: () => base44.entities.RespondentTrustScore.filter({ user_id: user.id }),
    enabled: !!user,
  });

  const { data: premiumSurveys = [] } = useQuery({
    queryKey: ['premium-surveys'],
    queryFn: () => base44.entities.PPCSurvey.filter({ status: 'active', tier: 3 }, '-cost_per_response', 10),
    enabled: !!user,
  });

  const trustScore = trustScoreArr[0] || null;
  const overallScore = trustScore?.overall_trust_score ?? 0;
  const currentTierKey = trustScore?.trust_tier || 'low';
  const currentTier = TIERS.find(t => t.key === currentTierKey) || TIERS[0];
  const nextTier = TIERS[TIERS.findIndex(t => t.key === currentTierKey) + 1] || null;
  const pointsToNext = nextTier ? nextTier.minScore - overallScore : 0;
  const hasPremiumAccess = currentTier.premiumAccess;

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-7 h-7 animate-spin text-purple-500" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Current status hero */}
      <Card className={`border-2 ${currentTier.border} shadow-lg overflow-hidden`}>
        <div className={`bg-gradient-to-r ${currentTier.gradient} p-5 text-white`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm opacity-80 mb-1">Your Reputation Tier</p>
              <div className="flex items-center gap-2">
                <currentTier.icon className="w-7 h-7" />
                <h2 className="text-3xl font-black">{currentTier.label}</h2>
              </div>
              <p className="text-sm opacity-90 mt-1">Trust Score: <strong>{overallScore}/100</strong></p>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-80">Payout Processing</p>
              <p className="text-xl font-bold">{currentTier.processingTime}</p>
              {currentTier.bonusRate > 0 && (
                <p className="text-sm mt-1 bg-white/20 rounded-full px-2 py-0.5">
                  +{(currentTier.bonusRate * 100).toFixed(0)}% bonus on all surveys
                </p>
              )}
            </div>
          </div>
        </div>
        {nextTier && (
          <CardContent className="p-4 bg-white">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-500">Progress to <strong className={nextTier.color}>{nextTier.label}</strong></span>
              <span className="font-semibold text-gray-700">{pointsToNext} points needed</span>
            </div>
            <Progress value={Math.min(100, (overallScore / nextTier.minScore) * 100)} className="h-2" />
            <p className="text-xs text-gray-400 mt-1.5">Complete more surveys with high quality scores to advance your tier</p>
          </CardContent>
        )}
      </Card>

      {/* Premium surveys — only shown if unlocked */}
      {hasPremiumAccess && premiumSurveys.length > 0 && (
        <Card className="border-0 shadow-md border-l-4 border-l-yellow-400">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Crown className="w-4 h-4 text-yellow-500" />
              Exclusive Premium Surveys (Your Tier Unlocked These)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {premiumSurveys.slice(0, 3).map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-xl border border-yellow-100">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{s.title}</p>
                  <p className="text-xs text-gray-500">{s.questions?.length || 5} questions</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-green-600">${s.cost_per_response?.toFixed(2)}</p>
                  <Link to={createPageUrl('PPCMarketplace')}>
                    <Button size="sm" className="h-6 text-xs mt-1 bg-yellow-500 hover:bg-yellow-600">
                      Start <ChevronRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!hasPremiumAccess && (
        <Card className="border-2 border-dashed border-gray-200">
          <CardContent className="p-5 text-center">
            <Lock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-600">Premium Surveys Locked</p>
            <p className="text-xs text-gray-400 mt-1">
              Reach <strong>Trusted</strong> tier (score 65+) to unlock exclusive high-paying surveys
            </p>
            <p className="text-xs text-purple-600 font-medium mt-2">
              {pointsToNext > 0 ? `${pointsToNext} more points needed` : 'Keep completing quality surveys!'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tier ladder */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-purple-500" /> All Reputation Tiers
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {TIERS.map(tier => (
            <TierCard
              key={tier.key}
              tier={tier}
              isCurrentTier={tier.key === currentTierKey}
              trustScore={trustScore}
            />
          ))}
        </div>
      </div>

      {/* How to improve */}
      <Card className="border-0 bg-indigo-50 shadow-sm">
        <CardContent className="p-4">
          <p className="text-sm font-bold text-indigo-800 mb-2">📈 How to Improve Your Tier</p>
          <ul className="space-y-1 text-xs text-indigo-700">
            <li>✓ Complete surveys fully — don't leave questions blank</li>
            <li>✓ Take your time — rushing lowers your quality score</li>
            <li>✓ Vary your answers — avoid selecting the same option repeatedly</li>
            <li>✓ Avoid flagged responses — each flag lowers your trust score</li>
            <li>✓ Build a long track record — consistent quality boosts your tier</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
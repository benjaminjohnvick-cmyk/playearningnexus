import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Award, Star, Zap, CheckCircle, Mail, ArrowUp, ArrowDown, Target } from 'lucide-react';

const TIER_CONFIG = {
  starter:  { label: 'Starter',  color: 'bg-gray-100 text-gray-700',    border: 'border-gray-300',  gradient: 'from-gray-400 to-gray-600',   emoji: '🌱', commission: 10 },
  growth:   { label: 'Growth',   color: 'bg-blue-100 text-blue-700',    border: 'border-blue-300',  gradient: 'from-blue-400 to-blue-600',   emoji: '📈', commission: 12 },
  pro:      { label: 'Pro',      color: 'bg-purple-100 text-purple-700',border: 'border-purple-300',gradient: 'from-purple-400 to-purple-600',emoji: '💼', commission: 15 },
  gold:     { label: 'Gold',     color: 'bg-yellow-100 text-yellow-700',border: 'border-yellow-400',gradient: 'from-yellow-400 to-amber-500', emoji: '🥇', commission: 20 },
  platinum: { label: 'Platinum', color: 'bg-slate-100 text-slate-800',  border: 'border-slate-400', gradient: 'from-slate-400 to-slate-700', emoji: '💎', commission: 25 },
};

const TIER_THRESHOLDS = [
  { tier: 'starter',  min90d: 0,   minEarnings: 0 },
  { tier: 'growth',   min90d: 10,  minEarnings: 50 },
  { tier: 'pro',      min90d: 50,  minEarnings: 250 },
  { tier: 'gold',     min90d: 150, minEarnings: 750 },
  { tier: 'platinum', min90d: 500, minEarnings: 2500 },
];

const TIER_BENEFITS = {
  starter:  ['Access to all basic marketing assets', 'Standard 10% commission', 'Weekly payout eligibility', 'Community access'],
  growth:   ['Everything in Starter', '12% commission rate', 'Priority asset access', 'Monthly performance report', 'Dedicated onboarding guide'],
  pro:      ['Everything in Growth', '15% commission rate', 'Custom referral landing pages', 'AI content scheduling', 'Early campaign access', 'Monthly 1:1 strategy call'],
  gold:     ['Everything in Pro', '20% commission rate 🔥', 'Gold affiliate badge', 'Exclusive Gold campaigns', 'Bonus payouts on milestones', 'Featured in affiliate spotlight', 'Dedicated account manager'],
  platinum: ['Everything in Gold', '25% commission rate 👑', 'Platinum elite badge', 'Custom commission negotiations', 'Revenue share on referred affiliates', 'VIP event invitations', 'Co-marketing opportunities', 'Direct executive access'],
};

export default function AffiliateTierDashboard() {
  const [user, setUser] = useState(null);
  const [upgrading, setUpgrading] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const { data: referrals = [] } = useQuery({
    queryKey: ['tierReferrals', user?.id],
    queryFn: () => {
      const since90 = new Date();
      since90.setDate(since90.getDate() - 90);
      return base44.entities.Referral.filter({ referrer_user_id: user?.id }, '-created_date', 500);
    },
    enabled: !!user?.id
  });

  const { data: onboarding } = useQuery({
    queryKey: ['affiliateOnboarding', user?.id],
    queryFn: () => base44.entities.AffiliateOnboarding.filter({ affiliate_user_id: user?.id }, '-created_date', 1).then(r => r[0]),
    enabled: !!user?.id
  });

  // Compute 90-day conversions
  const now = new Date();
  const since90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const conversions90d = referrals.filter(r => r.status === 'converted' && new Date(r.created_date) >= since90).length;
  const totalEarnings = referrals.reduce((s, r) => s + (r.commission_earned || 0), 0);

  const currentTierName = onboarding?.assigned_tier || user?.affiliate_tier || 'starter';
  const currentTier = TIER_CONFIG[currentTierName] || TIER_CONFIG.starter;

  // Determine eligible tier
  const eligibleTier = TIER_THRESHOLDS.slice().reverse().find(t => conversions90d >= t.min90d && totalEarnings >= t.minEarnings);
  const eligibleTierName = eligibleTier?.tier || 'starter';
  const canUpgrade = eligibleTierName !== currentTierName && Object.keys(TIER_CONFIG).indexOf(eligibleTierName) > Object.keys(TIER_CONFIG).indexOf(currentTierName);

  const checkAndUpgrade = async () => {
    setUpgrading(true);
    // Send promotion notification
    await base44.integrations.Core.SendEmail({
      to: user.email,
      subject: `🎉 You've been promoted to ${TIER_CONFIG[eligibleTierName]?.label} Affiliate!`,
      body: `Congratulations ${user.full_name}!\n\nYour performance over the last 90 days has earned you a promotion to ${TIER_CONFIG[eligibleTierName]?.label} tier!\n\nYour new commission rate is ${TIER_CONFIG[eligibleTierName]?.commission}%.\n\nBenefits:\n${TIER_BENEFITS[eligibleTierName].join('\n')}\n\nKeep up the amazing work!\n\nGamerGain Team`
    });
    // Update onboarding record
    if (onboarding?.id) {
      await base44.entities.AffiliateOnboarding.update(onboarding.id, { assigned_tier: eligibleTierName });
    }
    queryClient.invalidateQueries({ queryKey: ['affiliateOnboarding'] });
    setUpgrading(false);
  };

  const tierOrder = Object.keys(TIER_CONFIG);
  const currentTierIndex = tierOrder.indexOf(currentTierName);
  const nextTierIndex = currentTierIndex + 1;
  const prevTierIndex = currentTierIndex - 1;
  const nextTierName = tierOrder[nextTierIndex];
  const prevTierName = tierOrder[prevTierIndex];
  const nextThreshold = TIER_THRESHOLDS.find(t => t.tier === nextTierName);
  const prevThreshold = TIER_THRESHOLDS.find(t => t.tier === currentTierName);

  // Auto-downgrade check: if below current threshold for 90d, warn
  const belowThreshold = prevThreshold && (conversions90d < prevThreshold.min90d || totalEarnings < prevThreshold.minEarnings);

  // Exact numbers needed for next tier
  const conversionsNeeded = nextThreshold ? Math.max(0, nextThreshold.min90d - conversions90d) : 0;
  const earningsNeeded = nextThreshold ? Math.max(0, nextThreshold.minEarnings - totalEarnings) : 0;
  const conversionProgress = nextThreshold ? Math.min(100, (conversions90d / nextThreshold.min90d) * 100) : 100;
  const earningsProgress = nextThreshold ? Math.min(100, (totalEarnings / nextThreshold.minEarnings) * 100) : 100;

  if (!user) return <div className="p-6 text-center text-slate-500">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Affiliate Tier Status</h1>
        <p className="text-slate-500 text-sm mb-6">Track your 90-day performance and unlock higher commission rates</p>

        {/* Current Tier Hero */}
        <Card className={`border-2 ${currentTier.border} mb-6 overflow-hidden`}>
          <div className={`h-2 bg-gradient-to-r ${currentTier.gradient}`} />
          <CardContent className="pt-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="text-5xl">{currentTier.emoji}</div>
                <div>
                  <Badge className={`${currentTier.color} text-sm mb-1`}>{currentTier.label} Tier</Badge>
                  <h2 className="text-2xl font-bold">{user.full_name}</h2>
                  <p className="text-slate-500">Current commission: <span className="font-bold text-green-600">{currentTier.commission}%</span></p>
                </div>
              </div>
              {canUpgrade && (
                <Button className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white font-bold" onClick={checkAndUpgrade} disabled={upgrading}>
                  <Award className="w-4 h-4 mr-2" />
                  {upgrading ? 'Upgrading...' : `Upgrade to ${TIER_CONFIG[eligibleTierName]?.label}!`}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: '90-Day Conversions', value: conversions90d, icon: TrendingUp, color: 'text-blue-600' },
            { label: 'Total Earnings', value: `$${totalEarnings.toFixed(2)}`, icon: Star, color: 'text-green-600' },
            { label: 'Commission Rate', value: `${currentTier.commission}%`, icon: Zap, color: 'text-purple-600' },
            { label: 'Total Referrals', value: referrals.length, icon: Award, color: 'text-yellow-600' },
          ].map(s => {
            const Icon = s.icon;
            return (
              <Card key={s.label}>
                <CardContent className="pt-4 text-center">
                  <Icon className={`w-6 h-6 ${s.color} mx-auto mb-1`} />
                  <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-slate-500">{s.label}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Auto-downgrade warning */}
        {belowThreshold && (
          <Card className="mb-6 border-2 border-red-200 bg-red-50">
            <CardContent className="pt-4 flex gap-3 items-center">
              <ArrowDown className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-800">⚠️ Tier at Risk</p>
                <p className="text-xs text-red-700">Your 90-day activity has dropped below the <strong>{currentTier.label}</strong> threshold. Reach {prevThreshold?.min90d} conversions and ${prevThreshold?.minEarnings} earnings to keep your current tier. You have until end of this 90-day window.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress to Next Tier — enhanced */}
        {nextTierName && nextThreshold && (
          <Card className="mb-6 border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-500" />
                {conversionsNeeded === 0 && earningsNeeded === 0
                  ? `🎉 You qualify for ${TIER_CONFIG[nextTierName]?.label}! Click Upgrade above.`
                  : `Next Level: ${TIER_CONFIG[nextTierName]?.emoji} ${TIER_CONFIG[nextTierName]?.label} (${TIER_CONFIG[nextTierName]?.commission}% commission)`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Conversions progress */}
              <div>
                <div className="flex justify-between text-sm mb-1 font-medium">
                  <span className="text-gray-700">90-Day Conversions</span>
                  <span className="text-blue-700 font-bold">{conversions90d} / {nextThreshold.min90d}</span>
                </div>
                <Progress value={conversionProgress} className="h-4 mb-1" />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{conversionProgress.toFixed(0)}% complete</span>
                  {conversionsNeeded > 0
                    ? <span className="font-semibold text-blue-700">Need <strong>{conversionsNeeded} more conversions</strong> to unlock {TIER_CONFIG[nextTierName]?.commission}% commission</span>
                    : <span className="text-green-600 font-bold">✅ Conversions met!</span>}
                </div>
              </div>

              {/* Earnings progress */}
              <div>
                <div className="flex justify-between text-sm mb-1 font-medium">
                  <span className="text-gray-700">Earnings (90d)</span>
                  <span className="text-green-700 font-bold">${totalEarnings.toFixed(0)} / ${nextThreshold.minEarnings}</span>
                </div>
                <Progress value={earningsProgress} className="h-4 mb-1" />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{earningsProgress.toFixed(0)}% complete</span>
                  {earningsNeeded > 0
                    ? <span className="font-semibold text-green-700">Need <strong>${earningsNeeded.toFixed(0)} more</strong> in earnings</span>
                    : <span className="text-green-600 font-bold">✅ Earnings met!</span>}
                </div>
              </div>

              {/* Commission rate jump callout */}
              <div className="bg-white rounded-xl border-2 border-blue-200 p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Current rate</p>
                  <p className="text-2xl font-black text-gray-700">{currentTier.commission}%</p>
                </div>
                <ArrowUp className="w-6 h-6 text-blue-500" />
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Next rate</p>
                  <p className="text-2xl font-black text-blue-700">{TIER_CONFIG[nextTierName]?.commission}%</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Rate increase</p>
                  <p className="text-2xl font-black text-green-600">+{TIER_CONFIG[nextTierName]?.commission - currentTier.commission}%</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Still need</p>
                  <p className="text-lg font-black text-blue-600">{conversionsNeeded > 0 ? `${conversionsNeeded} conv.` : earningsNeeded > 0 ? `$${earningsNeeded.toFixed(0)}` : '✅ Qualified!'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Tiers */}
        <h2 className="text-lg font-bold mb-4">All Affiliate Tiers</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {Object.entries(TIER_CONFIG).map(([name, config]) => {
            const isActive = name === currentTierName;
            const thresh = TIER_THRESHOLDS.find(t => t.tier === name);
            return (
              <Card key={name} className={`border-2 transition-all ${isActive ? `${config.border} shadow-xl` : 'border-slate-200'}`}>
                <div className={`h-1.5 bg-gradient-to-r ${config.gradient}`} />
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{config.emoji}</span>
                      <Badge className={config.color}>{config.label}</Badge>
                    </div>
                    {isActive && <Badge className="bg-green-600 text-white text-xs">✓ Current</Badge>}
                  </div>
                  <p className="text-xl font-black text-slate-900 mb-1">{config.commission}% commission</p>
                  {thresh && <p className="text-xs text-slate-500 mb-3">{thresh.min90d}+ conversions / ${thresh.minEarnings}+ earnings (90d)</p>}
                  <ul className="space-y-1">
                    {TIER_BENEFITS[name].slice(0, 4).map((b, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-700">
                        <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />{b}
                      </li>
                    ))}
                    {TIER_BENEFITS[name].length > 4 && <li className="text-xs text-slate-400">+{TIER_BENEFITS[name].length - 4} more benefits</li>}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Email notification info */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4 flex gap-3 items-center">
            <Mail className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-900">When you reach a new tier's milestone, click "Upgrade" above to receive your promotion email and activate your new commission rate automatically.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
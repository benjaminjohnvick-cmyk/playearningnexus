import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, Award, Star, Zap, CheckCircle, Mail } from 'lucide-react';

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

  const nextTierIndex = Object.keys(TIER_CONFIG).indexOf(currentTierName) + 1;
  const nextTierName = Object.keys(TIER_CONFIG)[nextTierIndex];
  const nextThreshold = TIER_THRESHOLDS.find(t => t.tier === nextTierName);

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

        {/* Progress to Next Tier */}
        {nextTierName && nextThreshold && (
          <Card className="mb-6 border-2 border-dashed border-slate-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                Progress to {TIER_CONFIG[nextTierName]?.emoji} {TIER_CONFIG[nextTierName]?.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>90-Day Conversions</span>
                    <span className="font-semibold">{conversions90d} / {nextThreshold.min90d}</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (conversions90d / nextThreshold.min90d) * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Earnings</span>
                    <span className="font-semibold">${totalEarnings.toFixed(0)} / ${nextThreshold.minEarnings}</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (totalEarnings / nextThreshold.minEarnings) * 100)}%` }} />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Unlock {TIER_CONFIG[nextTierName]?.commission}% commission rate at {nextThreshold.min90d} conversions + ${nextThreshold.minEarnings} earnings over 90 days
                </p>
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
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Megaphone, Users, Star, TrendingUp, Zap, Wallet, FileText, Bell,
  Briefcase, ShieldCheck, Activity, DollarSign, Copy, Check, ArrowRight,
  Trophy, Target, BarChart2, ShoppingBag
} from 'lucide-react';

const TIER_INFO = [
  { name: 'starter', display: 'Starter', color: 'gray', min_followers: 0, commission: 10 },
  { name: 'growth', display: 'Growth', color: 'blue', min_followers: 500, commission: 15 },
  { name: 'pro', display: 'Pro', color: 'purple', min_followers: 5000, commission: 20 },
  { name: 'gold', display: 'Gold', color: 'yellow', min_followers: 25000, commission: 25 },
  { name: 'platinum', display: 'Platinum', color: 'indigo', min_followers: 100000, commission: 30 },
];

const QUICK_LINKS = [
  { name: 'Affiliate Portal', desc: 'Full affiliate dashboard', icon: Megaphone, path: 'AffiliatePortal', color: 'from-purple-500 to-pink-500' },
  { name: 'Marketing Page', desc: 'Promote & share', icon: TrendingUp, path: 'AffiliateMarketingPage', color: 'from-pink-500 to-rose-500' },
  { name: 'MLM Network', desc: 'Multi-level earnings', icon: Users, path: 'AffiliateMLMDashboard', color: 'from-indigo-500 to-purple-500' },
  { name: 'Tier Dashboard', desc: 'View tier progress', icon: Star, path: 'AffiliateTierDashboard', color: 'from-yellow-500 to-orange-500' },
  { name: 'Analytics', desc: 'Performance insights', icon: BarChart2, path: 'AffiliateAnalyticsDashboard', color: 'from-blue-500 to-cyan-500' },
  { name: 'Onboarding', desc: 'Get started', icon: Zap, path: 'AffiliateOnboarding', color: 'from-emerald-500 to-teal-500' },
  { name: 'Payouts', desc: 'Manage earnings', icon: Wallet, path: 'AffiliatePayoutManager', color: 'from-green-500 to-emerald-500' },
  { name: 'Growth Campaigns', desc: 'AI coaching', icon: TrendingUp, path: 'AffiliateGrowthCampaignDashboard', color: 'from-violet-500 to-purple-500' },
  { name: 'Content Library', desc: 'Templates & assets', icon: FileText, path: 'ContentLibraryBrowser', color: 'from-orange-500 to-amber-500' },
  { name: 'Content Scheduler', desc: '30-day calendar', icon: Bell, path: 'AffiliateContentSchedulerCalendar', color: 'from-cyan-500 to-blue-500' },
  { name: 'Marketing Assets', desc: 'Banners & media', icon: Briefcase, path: 'MarketingAssetRepository', color: 'from-rose-500 to-red-500' },
  { name: 'Dispute Center', desc: 'Resolve issues', icon: ShieldCheck, path: 'AffiliateDisputeCenter', color: 'from-red-500 to-orange-500' },
  { name: 'Churn Monitor', desc: 'Risk predictions', icon: Activity, path: 'AffiliateChurnMonitor', color: 'from-amber-500 to-yellow-500' },
  { name: 'Affiliate Store', desc: 'Shop with earnings', icon: ShoppingBag, path: 'AffiliateMarketplace', color: 'from-teal-500 to-green-500' },
];

export default function AffiliatesHub() {
  const [user, setUser] = useState(null);
  const [onboarding, setOnboarding] = useState(null);
  const [mlmNode, setMlmNode] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [sales, setSales] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const u = await base44.auth.me();
      setUser(u);

      const [onboardingRes, mlmRes, refRes, salesRes, payoutRes] = await Promise.all([
        base44.entities.AffiliateOnboarding.filter({ affiliate_user_id: u.id }).catch(() => []),
        base44.entities.MLMNode.filter({ user_id: u.id }).catch(() => []),
        base44.entities.Referral.filter({ referrer_user_id: u.id }).catch(() => []),
        base44.entities.AffiliateSale.filter({ affiliate_user_id: u.id }).catch(() => []),
        base44.entities.Payout.filter({ recipient_user_id: u.id, payout_type: 'affiliate_referral' }).catch(() => []),
      ]);

      setOnboarding(onboardingRes[0] || null);
      setMlmNode(mlmRes[0] || null);
      setReferrals(refRes || []);
      setSales(salesRes || []);
      setPayouts(payoutRes || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const referralCode = user?.referral_code || user?.id?.slice(0, 8) || 'GAMERGAIN';
  const referralLink = `https://gamergain.app/ref/${referralCode}`;

  const currentTier = onboarding?.assigned_tier || mlmNode?.current_tier || 'starter';
  const tierIdx = TIER_INFO.findIndex(t => t.name === currentTier);
  const nextTier = TIER_INFO[tierIdx + 1];

  const totalEarnings = sales.reduce((s, sale) => s + (sale.commission_amount || 0), 0);
  const totalConversions = sales.length;
  const pendingPayouts = payouts.filter(p => p.status === 'pending_approval' || p.status === 'approved' || p.status === 'scheduled').length;
  const completedPayouts = payouts.filter(p => p.status === 'completed').length;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 p-6 md:p-8 text-white shadow-xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Megaphone className="w-6 h-6" />
                <h1 className="text-2xl md:text-3xl font-black">Affiliates Hub</h1>
                <Badge className="bg-white/20 text-white border-0 capitalize">{currentTier}</Badge>
              </div>
              <p className="text-white/80 text-sm">You're automatically enrolled as an affiliate. Share your link, earn commissions, and advance tiers with AI-powered progression.</p>
            </div>
            <div className="text-center bg-white/10 rounded-xl px-5 py-3 backdrop-blur">
              <p className="text-3xl font-black">${totalEarnings.toFixed(2)}</p>
              <p className="text-xs text-white/70">Total Affiliate Earnings</p>
            </div>
          </div>
        </div>

        {/* Referral Link */}
        <Card className="border-2 border-purple-200 shadow-lg">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-gray-900">Your Referral Link</h3>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                readOnly
                value={referralLink}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm font-mono text-gray-700"
              />
              <Button onClick={copyLink} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                {copied ? <><Check className="w-4 h-4 mr-1" />Copied!</> : <><Copy className="w-4 h-4 mr-1" />Copy Link</>}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">Earn commissions on every referral — up to 3 levels deep in the MLM network.</p>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-purple-100">
            <CardContent className="p-4 text-center">
              <Users className="w-5 h-5 text-purple-500 mx-auto mb-1" />
              <p className="text-2xl font-black text-gray-900">{referrals.length}</p>
              <p className="text-xs text-gray-500">Referrals</p>
            </CardContent>
          </Card>
          <Card className="border-green-100">
            <CardContent className="p-4 text-center">
              <Trophy className="w-5 h-5 text-green-500 mx-auto mb-1" />
              <p className="text-2xl font-black text-gray-900">{totalConversions}</p>
              <p className="text-xs text-gray-500">Conversions</p>
            </CardContent>
          </Card>
          <Card className="border-blue-100">
            <CardContent className="p-4 text-center">
              <Wallet className="w-5 h-5 text-blue-500 mx-auto mb-1" />
              <p className="text-2xl font-black text-gray-900">{pendingPayouts}</p>
              <p className="text-xs text-gray-500">Pending Payouts</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-100">
            <CardContent className="p-4 text-center">
              <Check className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
              <p className="text-2xl font-black text-gray-900">{completedPayouts}</p>
              <p className="text-xs text-gray-500">Paid Out</p>
            </CardContent>
          </Card>
        </div>

        {/* Tier Progress */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Star className="w-5 h-5 text-yellow-500" />
              Affiliate Tier Progression
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
              {TIER_INFO.map((tier, idx) => {
                const isCurrent = tier.name === currentTier;
                const isPassed = idx <= tierIdx;
                return (
                  <div key={tier.name} className="flex items-center flex-shrink-0">
                    <div className={`text-center px-3 py-2 rounded-xl border-2 transition-all ${isCurrent ? 'border-purple-500 bg-purple-50 shadow-md' : isPassed ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                      <p className={`text-sm font-bold ${isCurrent ? 'text-purple-700' : isPassed ? 'text-green-700' : 'text-gray-400'}`}>{tier.display}</p>
                      <p className="text-[10px] text-gray-500">{tier.commission}% comm</p>
                    </div>
                    {idx < TIER_INFO.length - 1 && (
                      <ArrowRight className={`w-4 h-4 mx-1 ${isPassed ? 'text-green-400' : 'text-gray-300'}`} />
                    )}
                  </div>
                );
              })}
            </div>
            {nextTier && (
              <div className="mt-4 p-3 rounded-xl bg-purple-50 border border-purple-200">
                <p className="text-sm text-purple-700">
                  <Zap className="w-4 h-4 inline mr-1" />
                  Next: <strong>{nextTier.display}</strong> — Need {nextTier.min_followers.toLocaleString()}+ followers & {nextTier.commission}% commission rate. AI evaluates your social media daily for auto-upgrades.
                </p>
              </div>
            )}
            {!nextTier && (
              <div className="mt-4 p-3 rounded-xl bg-yellow-50 border border-yellow-200">
                <p className="text-sm text-yellow-700">
                  <Trophy className="w-4 h-4 inline mr-1" />
                  You've reached the highest tier! Platinum status unlocked with maximum {TIER_INFO[tierIdx].commission}% commission.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-purple-600" />
            Affiliate Tools & Resources
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link key={link.path} to={`/${link.path}`}>
                  <Card className="hover:shadow-lg transition-all cursor-pointer group h-full">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${link.color} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-gray-900">{link.name}</p>
                        <p className="text-xs text-gray-500 truncate">{link.desc}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-purple-500 group-hover:translate-x-1 transition-all ml-auto" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        {/* TOS Notice */}
        <Card className="border-purple-100 bg-purple-50/50">
          <CardContent className="p-4">
            <p className="text-xs text-gray-600">
              <ShieldCheck className="w-4 h-4 inline mr-1 text-purple-500" />
              All GamerGain users are automatically enrolled as affiliates upon account creation per our Terms of Service (Section 11). AI evaluates your social media performance daily and advances your tier automatically when requirements are met.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
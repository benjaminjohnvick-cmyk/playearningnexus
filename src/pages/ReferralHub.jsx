import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users, DollarSign, Copy, TrendingUp, Link as LinkIcon,
  CheckCircle2, Clock, Twitter, Facebook, MessageCircle,
  Loader2, Shield, Star, Crown, Trophy
} from 'lucide-react';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import PPCBadgeSystem from '@/components/referral/PPCBadgeSystem';
import ReferralAnalyticsTab from '@/components/referral/ReferralAnalyticsTab';
import CustomSubdomainRequest from '@/components/referral/CustomSubdomainRequest';
import ReferralLeaderboardPanel from '@/components/referral/ReferralLeaderboardPanel';
import ReferralFunnel from '@/components/referral/ReferralFunnel';

export default function ReferralHub() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals-hub', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id }),
    enabled: !!user
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ['payouts-hub', user?.id],
    queryFn: () => base44.entities.Payout.filter({ user_id: user.id }, '-created_date', 20),
    enabled: !!user
  });

  const { data: dailyEarnings = [] } = useQuery({
    queryKey: ['daily-earnings-hub', user?.id],
    queryFn: () => base44.entities.DailyEarnings.filter({ user_id: user.id }, '-date', 60),
    enabled: !!user
  });

  const { data: referralLinks = [] } = useQuery({
    queryKey: ['referral-links-hub', user?.id],
    queryFn: () => base44.entities.CustomReferralLink.filter({ user_id: user.id }),
    enabled: !!user
  });

  // Leaderboard: top referrers by commission
  const { data: topReferrers = [] } = useQuery({
    queryKey: ['referral-leaderboard'],
    queryFn: async () => {
      const allReferrals = await base44.entities.Referral.list('-commission_earned', 50);
      // Aggregate by referrer
      const map = {};
      allReferrals.forEach(r => {
        const uid = r.referrer_user_id;
        if (!uid) return;
        if (!map[uid]) map[uid] = { user_id: uid, name: r.referrer_name || 'User', total_commission: 0, active_referrals: 0 };
        map[uid].total_commission += r.commission_earned || 0;
        if (r.status === 'active') map[uid].active_referrals++;
      });
      return Object.values(map).sort((a, b) => b.total_commission - a.total_commission).slice(0, 20);
    },
    enabled: !!user,
    refetchInterval: 60000
  });

  const totalCommission = referrals.reduce((sum, r) => sum + (r.commission_earned || 0), 0);
  const activeReferrals = referrals.filter(r => r.status === 'active').length;
  const pendingCommission = payouts.filter(p => p.status === 'pending').reduce((s, p) => s + (p.amount || 0), 0);

  const referralCode = user ? `REF-${user.id.slice(0, 8).toUpperCase()}` : '';
  const referralLink = user ? `${window.location.origin}/?ref=${referralCode}` : '';

  const currentTier = activeReferrals >= 50 ? 3 : activeReferrals >= 10 ? 2 : 1;

  const copyLink = () => { navigator.clipboard.writeText(referralLink); toast.success('Referral link copied!'); };
  const shareOnTwitter = () => window.open(`https://twitter.com/intent/tweet?text=Join%20GamerGain%20and%20earn%20real%20money!%20${encodeURIComponent(referralLink)}`, '_blank');
  const shareOnFacebook = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`, '_blank');
  const shareViaWhatsApp = () => window.open(`https://wa.me/?text=Join%20GamerGain%20and%20earn%20real%20money!%20${encodeURIComponent(referralLink)}`, '_blank');

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
    </div>
  );

  const tierColors = { 1: 'from-blue-500 to-blue-600', 2: 'from-purple-500 to-purple-600', 3: 'from-yellow-500 to-orange-500' };
  const tierNames = { 1: 'BitLabs Tier', 2: 'PPC Network Tier', 3: 'Advertising Partner Tier' };
  const tierIcons = { 1: Shield, 2: Star, 3: Crown };
  const TierIcon = tierIcons[currentTier];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
              <Users className="w-9 h-9 text-indigo-600" /> Referral Hub
            </h1>
            <p className="text-gray-500 mt-1">Track referrals, progress, commissions & share your link</p>
          </div>
          <div className={`bg-gradient-to-r ${tierColors[currentTier]} text-white rounded-2xl px-5 py-3 flex items-center gap-3`}>
            <TierIcon className="w-6 h-6" />
            <div>
              <p className="text-xs opacity-80">Current Tier</p>
              <p className="font-bold">{tierNames[currentTier]}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Referrals', value: referrals.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Active Referrals', value: activeReferrals, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Total Commission', value: `$${totalCommission.toFixed(2)}`, icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Pending Payout', value: `$${pendingCommission.toFixed(2)}`, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          ].map((stat) => (
            <Card key={stat.label} className="border-0 shadow-md">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 ${stat.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="link">
          <TabsList className="grid grid-cols-7 w-full">
            <TabsTrigger value="link">Share Link</TabsTrigger>
            <TabsTrigger value="progress">Tier Progress</TabsTrigger>
            <TabsTrigger value="badges">Badges</TabsTrigger>
            <TabsTrigger value="referrals">My Referrals</TabsTrigger>
            <TabsTrigger value="leaderboard">🏆 Leaderboard</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="domain">🌐 Domain</TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-4 mt-4">
            <Card className="border-2 border-indigo-100">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><LinkIcon className="w-5 h-5 text-indigo-600" /> Your Referral Link</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-mono text-sm text-gray-700 overflow-hidden text-ellipsis whitespace-nowrap">
                    {referralLink}
                  </div>
                  <Button onClick={copyLink} className="bg-indigo-600 hover:bg-indigo-700 flex-shrink-0">
                    <Copy className="w-4 h-4 mr-2" /> Copy
                  </Button>
                </div>
                <div className="bg-indigo-50 rounded-xl p-4">
                  <p className="text-sm text-indigo-800 font-medium mb-1">Your Referral Code: <span className="font-bold font-mono">{referralCode}</span></p>
                  <p className="text-sm text-indigo-600">Earn <strong>25% commission</strong> on all earnings from your referrals after they earn $4.</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-3">Share via:</p>
                  <div className="flex gap-3 flex-wrap">
                    <Button variant="outline" onClick={shareOnTwitter} className="border-sky-300 text-sky-600 hover:bg-sky-50">
                      <Twitter className="w-4 h-4 mr-2" /> Twitter/X
                    </Button>
                    <Button variant="outline" onClick={shareOnFacebook} className="border-blue-300 text-blue-700 hover:bg-blue-50">
                      <Facebook className="w-4 h-4 mr-2" /> Facebook
                    </Button>
                    <Button variant="outline" onClick={shareViaWhatsApp} className="border-green-300 text-green-700 hover:bg-green-50">
                      <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-2">How Commissions Work</h3>
                <div className="space-y-2 text-sm text-purple-100">
                  <p>✅ Referral joins via your link → status: <strong className="text-white">Pending</strong></p>
                  <p>✅ They earn their first $4 → you get a <strong className="text-white">$1 bonus</strong></p>
                  <p>✅ After that → earn <strong className="text-white">25% of everything they earn</strong></p>
                  <p>✅ 10+ active referrals → unlock <strong className="text-white">PPC Tier 2</strong></p>
                  <p>✅ 50+ active referrals → unlock <strong className="text-white">Tier 3 ($58,400+/yr)</strong></p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="progress" className="space-y-4 mt-4">
            {[
              { tier: 1, name: 'BitLabs Tier', min: 0, max: 10, color: 'bg-blue-500', desc: 'Standard survey revenue. Earn 50% of every survey. Referral commission: 25%.', perks: ['BitLabs Survey Access', '25% Referral Commission', '$1 Bonus per new referral'], earning: 'Up to ~$1,095/yr' },
              { tier: 2, name: 'PPC Network Tier', min: 10, max: 50, color: 'bg-purple-500', desc: '10 active referrals required. Answer 10 questions/day in our proprietary PPC network.', perks: ['PPC Question Network', 'Higher CPM rates', 'Priority Survey Queue'], earning: 'Up to ~$14,600/yr' },
              { tier: 3, name: 'Advertising Partner', min: 50, max: 50, color: 'bg-yellow-500', desc: '50+ active referrals. High-volume advertising partnerships and maximum commissions.', perks: ['Ad Partnership Access', 'Max Commission Rates', 'Dedicated Account Manager'], earning: '$58,400+/yr' },
            ].map((t) => {
              const isUnlocked = t.tier === 1 || activeReferrals >= t.min;
              const isCurrent = currentTier === t.tier;
              const progress = t.tier < 3 ? Math.min(((activeReferrals - t.min) / (t.max - t.min)) * 100, 100) : 100;
              return (
                <Card key={t.tier} className={`border-2 ${isCurrent ? 'border-indigo-400 shadow-lg' : isUnlocked ? 'border-green-300' : 'border-gray-200 opacity-70'}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 ${isUnlocked ? t.color : 'bg-gray-300'} rounded-xl flex items-center justify-center`}>
                          <span className="text-white font-bold">{t.tier}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900">{t.name}</h3>
                            {isCurrent && <Badge className="bg-indigo-100 text-indigo-700 text-xs">Current</Badge>}
                            {isUnlocked && !isCurrent && <Badge className="bg-green-100 text-green-700 text-xs">Unlocked</Badge>}
                            {!isUnlocked && <Badge variant="secondary" className="text-xs">Locked</Badge>}
                          </div>
                          <p className="text-sm text-gray-500 mt-0.5">{t.earning}</p>
                        </div>
                      </div>
                      {isUnlocked && <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" />}
                    </div>
                    <p className="text-sm text-gray-600 mt-3">{t.desc}</p>
                    {t.tier < 3 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Progress to Tier {t.tier + 1}</span>
                          <span>{Math.min(activeReferrals, t.max)}/{t.max} referrals</span>
                        </div>
                        <Progress value={isUnlocked ? progress : 0} className="h-2" />
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {t.perks.map(p => (
                        <span key={p} className={`text-xs px-2 py-1 rounded-full ${isUnlocked ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{p}</span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="badges" className="mt-4">
            <PPCBadgeSystem user={user} referrals={referrals} currentTier={currentTier} dailyEarnings={dailyEarnings} />
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" /> Top Referral Earners
                </h3>
                <Badge className="bg-indigo-100 text-indigo-700">Live · updates every minute</Badge>
              </div>
              <ReferralLeaderboardPanel leaderboard={topReferrers} currentUserId={user?.id} />
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="mt-4">
            <div className="space-y-4">
              <Card className="border-0 shadow-md">
                <CardContent className="p-5">
                  <ReferralFunnel referrals={referrals} />
                </CardContent>
              </Card>
              <ReferralAnalyticsTab referrals={referrals} referralLinks={referralLinks} />
            </div>
          </TabsContent>

          <TabsContent value="domain" className="mt-4">
            <CustomSubdomainRequest user={user} activeReferrals={activeReferrals} />
          </TabsContent>

          <TabsContent value="referrals" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Your Referrals ({referrals.length})</CardTitle></CardHeader>
              <CardContent>
                {referrals.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-2">No referrals yet</p>
                    <p className="text-sm text-gray-400">Copy your link above and start sharing!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {referrals.map((referral) => (
                      <div key={referral.id} className="flex items-center justify-between border rounded-xl p-4 bg-gray-50 hover:bg-white transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center">
                            <Users className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 text-sm">Referred User</p>
                            <p className="text-xs text-gray-500">Earned: ${(referral.total_earnings || 0).toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={referral.status === 'active' ? 'default' : 'secondary'} className="text-xs mb-1">{referral.status}</Badge>
                          <p className="text-sm text-green-600 font-bold">+${(referral.commission_earned || 0).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="border-2 border-green-200 bg-green-50">
          <CardContent className="p-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-bold text-green-800">Ready to cash out?</p>
              <p className="text-sm text-green-600">Your balance: <strong>${(user.current_balance || 0).toFixed(2)}</strong> — withdraw via PayPal</p>
            </div>
            <Link to={createPageUrl('Withdrawal')}>
              <Button className="bg-green-600 hover:bg-green-700 flex-shrink-0">
                <DollarSign className="w-4 h-4 mr-2" /> Withdraw
              </Button>
            </Link>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
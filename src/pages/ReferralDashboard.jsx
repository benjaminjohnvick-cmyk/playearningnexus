import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, DollarSign, TrendingUp, Trophy, Link as LinkIcon, Loader2, Megaphone, Ticket, Share2, Activity } from 'lucide-react';
import InvitationLinkGenerator from '@/components/referral/InvitationLinkGenerator';
import ReferralMilestoneJackpot from '@/components/referral/ReferralMilestoneJackpot';
import TierMilestoneProgress from '@/components/referral/TierMilestoneProgress';
import ReferralProgressTracker from '@/components/referral/ReferralProgressTracker';
import SocialShareHub from '@/components/referral/SocialShareHub';
import LiveReferralsFeed from '@/components/referral/LiveReferralsFeed';
import ReferralLeaderboardPanel from '@/components/referral/ReferralLeaderboardPanel';
import ReferralMarketingHub from '@/components/referral/ReferralMarketingHub';
import ContentLibraryBrowser from '@/components/referral/ContentLibraryBrowser';
import ContestLeaderboardWidget from '@/components/referral/ContestLeaderboardWidget';
import EliteReferrerDashboard from '@/components/referral/EliteReferrerDashboard';
import ReferralManagementPanel from '@/components/referral/ReferralManagementPanel';
import ReferralChannelAnalytics from '@/components/referral/ReferralChannelAnalytics';
import ChannelROIPanel from '@/components/referral/ChannelROIPanel';
import { BadgeDisplay } from '@/components/achievements/BadgeSystem';

export default function ReferralDashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id }),
    enabled: !!user
  });

  const { data: tierRecord } = useQuery({
    queryKey: ['ppc-user-tier-ref', user?.id],
    queryFn: () => base44.entities.PPCUserTier.filter({ user_id: user.id }).then(r => r[0] || null),
    enabled: !!user
  });

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-red-600" />
    </div>
  );

  const totalCommission = referrals.reduce((s, r) => s + (r.commission_earned || 0), 0);
  const activeReferrals = referrals.filter(r => r.status === 'active').length;
  const currentTier = tierRecord?.current_tier || 1;
  const tier2Days = tierRecord?.tier2_days_active || 0;

  const KPI_CARDS = [
    { label: 'Total Referrals', value: referrals.length, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: Users },
    { label: 'Active Referrals', value: activeReferrals, color: 'text-green-600', bg: 'bg-green-50 border-green-200', icon: TrendingUp },
    { label: 'Total Commission', value: `$${totalCommission.toFixed(2)}`, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200', icon: DollarSign },
    { label: 'Current Tier', value: `Tier ${currentTier}`, color: currentTier === 3 ? 'text-yellow-600' : currentTier === 2 ? 'text-purple-600' : 'text-blue-600', bg: 'bg-gray-50 border-gray-200', icon: Trophy },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
            Referral Dashboard
          </h1>
          <p className="text-gray-600 mt-1">Grow your network, unlock higher tiers, and earn lifetime commissions</p>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {KPI_CARDS.map((kpi, i) => {
            const Icon = kpi.icon;
            return (
              <Card key={i} className={`border-2 ${kpi.bg}`}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">{kpi.label}</p>
                    <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                  </div>
                  <Icon className={`w-6 h-6 ${kpi.color} opacity-60`} />
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tabs */}
        {/* Active Contests Widget */}
        <ContestLeaderboardWidget user={user} />

        {/* Badges strip */}
        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">🏅 Your Badges</p>
          <BadgeDisplay userId={user?.id} compact maxShow={8} />
        </div>

        <Tabs defaultValue="progress">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-gray-100 p-1 rounded-lg">
            <TabsTrigger value="progress" className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" /> Milestones
            </TabsTrigger>
            <TabsTrigger value="share" className="flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5" /> Share Hub
            </TabsTrigger>
            <TabsTrigger value="live" className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Live Feed
            </TabsTrigger>
            <TabsTrigger value="invite" className="flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5" /> Invite
            </TabsTrigger>
            <TabsTrigger value="marketing" className="flex items-center gap-1.5">
              <Megaphone className="w-3.5 h-3.5" /> Marketing Hub
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" /> Leaderboard
            </TabsTrigger>
            <TabsTrigger value="milestones" className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Tier Progress
            </TabsTrigger>
            <TabsTrigger value="jackpot" className="flex items-center gap-1.5 text-purple-700 font-bold">
              <Ticket className="w-3.5 h-3.5" /> 🏆 Prize Pool
            </TabsTrigger>
            <TabsTrigger value="referrals" className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> My Referrals
            </TabsTrigger>
            <TabsTrigger value="manage" className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Manage & Share
            </TabsTrigger>
            <TabsTrigger value="elite" className="flex items-center gap-1.5">
              👑 Elite Dashboard
            </TabsTrigger>
            <TabsTrigger value="content_library" className="flex items-center gap-1.5">
              📚 Content Library
            </TabsTrigger>
            <TabsTrigger value="channel_analytics" className="flex items-center gap-1.5">
              📊 Channels
            </TabsTrigger>
            <TabsTrigger value="channel_roi" className="flex items-center gap-1.5">
              💰 Channel ROI
            </TabsTrigger>
          </TabsList>

          <TabsContent value="progress" className="mt-5">
            <ReferralProgressTracker userId={user.id} totalReferrals={referrals.length} />
          </TabsContent>

          <TabsContent value="share" className="mt-5">
            <SocialShareHub user={user} referralLink={`https://gamergain.app/ref/${user.id?.slice(0,8)}`} />
          </TabsContent>

          <TabsContent value="live" className="mt-5">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-5">
                <LiveReferralsFeed userId={user.id} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invite" className="mt-5">
            <InvitationLinkGenerator user={user} />
          </TabsContent>

          <TabsContent value="marketing" className="mt-5">
            <ReferralMarketingHub user={user} />
          </TabsContent>

          <TabsContent value="content_library" className="mt-5">
            <ContentLibraryBrowser user={user} />
          </TabsContent>

          <TabsContent value="channel_analytics" className="mt-5">
            <ReferralChannelAnalytics user={user} />
          </TabsContent>

          <TabsContent value="channel_roi" className="mt-5">
            <ChannelROIPanel user={user} />
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-5">
            <ReferralLeaderboardPanel currentUserId={user.id} />
          </TabsContent>

          <TabsContent value="milestones" className="mt-5">
            <TierMilestoneProgress
              activeReferrals={activeReferrals}
              totalCommission={totalCommission}
              tier2Days={tier2Days}
              currentTier={currentTier}
            />
          </TabsContent>

          <TabsContent value="jackpot" className="mt-5">
            <ReferralMilestoneJackpot userId={user.id} totalReferrals={referrals.length} />
          </TabsContent>

          <TabsContent value="elite" className="mt-5">
            <EliteReferrerDashboard user={user} referrals={referrals} />
          </TabsContent>

          <TabsContent value="manage" className="mt-5">
            <ReferralManagementPanel user={user} referrals={referrals} />
          </TabsContent>

          <TabsContent value="referrals" className="mt-5">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Your Referrals ({referrals.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {referrals.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-2">No referrals yet</p>
                    <p className="text-sm text-gray-400">Share your invitation link to start earning!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {referrals.map(referral => (
                      <div key={referral.id} className="flex items-center justify-between border-2 border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                        <div>
                          <p className="font-medium text-gray-800">User {referral.referred_user_id?.slice(0, 8).toUpperCase() || 'Anonymous'}</p>
                          <p className="text-xs text-gray-400">Total earned: ${(referral.total_earnings || 0).toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant={referral.status === 'active' ? 'default' : 'secondary'} className={referral.status === 'active' ? 'bg-green-100 text-green-700' : ''}>
                            {referral.status}
                          </Badge>
                          <p className="text-sm text-green-600 font-bold mt-1">+${(referral.commission_earned || 0).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
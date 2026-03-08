import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, Users, DollarSign, Globe, Target, Activity,
  BarChart3, Award, Sparkles, Loader2
} from "lucide-react";
import MultiTierReferralSystem from '../components/referral/MultiTierReferralSystem';
import ReferralLeaderboard from '../components/referral/ReferralLeaderboard';
import AchievementsBadges from '../components/referral/AchievementsBadges';
import AICampaignGenerator from '../components/referral/AICampaignGenerator';
import ReferralGrowthChart from '../components/referral/ReferralGrowthChart';
import TrafficSourceAnalysis from '../components/referral/TrafficSourceAnalysis';
import ConversionFunnel from '../components/referral/ConversionFunnel';
import ReferralFollowUpSystem from '../components/automation/ReferralFollowUpSystem';

export default function ReferralAnalytics() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: userReferrals = [] } = useQuery({
    queryKey: ['user-referrals-analytics', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id }),
    enabled: !!user
  });

  const { data: customLinks = [] } = useQuery({
    queryKey: ['custom-links-analytics', user?.id],
    queryFn: () => base44.entities.CustomReferralLink.filter({ user_id: user.id }),
    enabled: !!user
  });

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
    </div>
  );

  const activeReferrals = userReferrals.filter(r => r.status === 'active').length;
  const totalCommission = userReferrals.reduce((s, r) => s + (r.commission_earned || 0), 0);
  const totalClicks = customLinks.reduce((s, l) => s + (l.clicks || 0), 0);
  const conversionRate = totalClicks > 0 ? ((userReferrals.length / totalClicks) * 100).toFixed(1) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-1">Referral Analytics</h1>
          <p className="text-gray-500">Track growth, conversions, and traffic sources</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Referrals', value: userReferrals.length, sub: `${activeReferrals} active`, icon: Users, color: 'from-blue-500 to-blue-600' },
            { label: 'Total Commission', value: `$${totalCommission.toFixed(2)}`, sub: 'lifetime earnings', icon: DollarSign, color: 'from-green-500 to-green-600' },
            { label: 'Conversion Rate', value: `${conversionRate}%`, sub: `${totalClicks} total clicks`, icon: Target, color: 'from-amber-500 to-amber-600' },
            { label: 'Link Count', value: customLinks.length, sub: 'active tracking links', icon: TrendingUp, color: 'from-purple-500 to-purple-600' },
          ].map(s => (
            <Card key={s.label} className={`border-0 shadow-lg bg-gradient-to-br ${s.color} text-white`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2 opacity-80">
                  <s.icon className="w-4 h-4" />
                  <span className="text-xs font-medium">{s.label}</span>
                </div>
                <p className="text-3xl font-black">{s.value}</p>
                <p className="text-xs opacity-70 mt-0.5">{s.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tier System */}
        <MultiTierReferralSystem user={user} />

        {/* Main Analytics Tabs */}
        <Tabs defaultValue="growth">
          <TabsList className="bg-white shadow-md flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="growth"><Activity className="w-4 h-4 mr-1" /> Growth</TabsTrigger>
            <TabsTrigger value="funnel"><Target className="w-4 h-4 mr-1" /> Funnel</TabsTrigger>
            <TabsTrigger value="sources"><Globe className="w-4 h-4 mr-1" /> Traffic Sources</TabsTrigger>
            <TabsTrigger value="followups"><BarChart3 className="w-4 h-4 mr-1" /> Follow-Ups</TabsTrigger>
            <TabsTrigger value="leaderboard"><Award className="w-4 h-4 mr-1" /> Leaderboard</TabsTrigger>
            <TabsTrigger value="achievements"><Sparkles className="w-4 h-4 mr-1" /> Achievements</TabsTrigger>
            <TabsTrigger value="ai"><Sparkles className="w-4 h-4 mr-1" /> AI Campaigns</TabsTrigger>
          </TabsList>

          <TabsContent value="growth" className="mt-4">
            <ReferralGrowthChart referrals={userReferrals} />
          </TabsContent>

          <TabsContent value="funnel" className="mt-4">
            <ConversionFunnel referrals={userReferrals} links={customLinks} />
          </TabsContent>

          <TabsContent value="sources" className="mt-4">
            <TrafficSourceAnalysis links={customLinks} referrals={userReferrals} />
          </TabsContent>

          <TabsContent value="followups" className="mt-4">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Automated Follow-Up Emails</CardTitle>
              </CardHeader>
              <CardContent>
                <ReferralFollowUpSystem user={user} isAdmin={false} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-4">
            <ReferralLeaderboard currentUser={user} />
          </TabsContent>

          <TabsContent value="achievements" className="mt-4">
            <AchievementsBadges user={user} />
          </TabsContent>

          <TabsContent value="ai" className="mt-4">
            <AICampaignGenerator user={user} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
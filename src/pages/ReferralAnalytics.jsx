import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Globe,
  Target,
  Activity,
  ArrowUpRight,
  UserPlus,
  Briefcase,
  Award,
  Sparkles,
  BarChart3
} from "lucide-react";
import MultiTierReferralSystem from '../components/referral/MultiTierReferralSystem';
import ReferralLeaderboard from '../components/referral/ReferralLeaderboard';
import AchievementsBadges from '../components/referral/AchievementsBadges';
import AICampaignGenerator from '../components/referral/AICampaignGenerator';
import SourcePerformance from '../components/referral/SourcePerformance';
import CohortAnalysis from '../components/referral/CohortAnalysis';
import ABTestingDashboard from '../components/analytics/ABTestingDashboard';
import PredictiveAnalytics from '../components/analytics/PredictiveAnalytics';
import CustomReportGenerator from '../components/analytics/CustomReportGenerator';
import ReferralOnboarding from '../components/onboarding/ReferralOnboarding';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import moment from 'moment';

export default function ReferralAnalytics() {
  const [user, setUser] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        // Check if user needs onboarding
        const progs = await base44.entities.OnboardingProgress.filter({ user_id: currentUser.id });
        if (progs.length === 0 || !progs[0].is_completed) {
          setShowOnboarding(true);
        }
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  // Fetch all referrals by this user
  const { data: userReferrals = [] } = useQuery({
    queryKey: ['user-referrals', user?.id],
    queryFn: async () => {
      return await base44.entities.Referral.filter({
        referrer_user_id: user.id
      });
    },
    enabled: !!user
  });

  // Fetch contest participations
  const { data: contestParticipations = [] } = useQuery({
    queryKey: ['contest-participations', user?.id],
    queryFn: async () => {
      return await base44.entities.ContestParticipation.filter({
        user_id: user.id
      });
    },
    enabled: !!user
  });

  // Fetch CRM leads referred by user
  const { data: crmLeads = [] } = useQuery({
    queryKey: ['crm-leads', user?.id],
    queryFn: async () => {
      return await base44.entities.CRMLead.filter({
        referred_by_user_id: user.id
      });
    },
    enabled: !!user
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Calculate metrics
  const totalUserReferrals = userReferrals.filter(r => r.referral_type === 'user').length;
  const totalBusinessReferrals = crmLeads.filter(l => l.lead_type === 'business_client').length;
  const totalEarnings = contestParticipations.reduce((sum, p) => sum + (p.earnings || 0), 0);
  const activeReferrals = userReferrals.filter(r => r.status === 'active').length;
  
  // Conversion rate
  const convertedReferrals = userReferrals.filter(r => r.status === 'converted').length;
  const conversionRate = totalUserReferrals > 0 
    ? ((convertedReferrals / totalUserReferrals) * 100).toFixed(1) 
    : 0;

  // Earnings per referral
  const earningsPerReferral = totalUserReferrals > 0 
    ? (totalEarnings / totalUserReferrals).toFixed(2) 
    : 0;

  // Timeline data (last 30 days)
  const timelineData = [];
  for (let i = 29; i >= 0; i--) {
    const date = moment().subtract(i, 'days').format('YYYY-MM-DD');
    const dayReferrals = userReferrals.filter(r => 
      moment(r.created_date).format('YYYY-MM-DD') === date
    ).length;
    timelineData.push({
      date: moment(date).format('MMM DD'),
      referrals: dayReferrals
    });
  }

  // Status breakdown
  const statusData = [
    { name: 'Active', value: activeReferrals, color: '#10b981' },
    { name: 'Converted', value: convertedReferrals, color: '#3b82f6' },
    { name: 'Pending', value: userReferrals.filter(r => r.status === 'pending').length, color: '#f59e0b' }
  ];

  // Lead status breakdown
  const leadStatusData = [
    { name: 'New', value: crmLeads.filter(l => l.status === 'new').length },
    { name: 'Contacted', value: crmLeads.filter(l => l.status === 'contacted').length },
    { name: 'Qualified', value: crmLeads.filter(l => l.status === 'qualified').length },
    { name: 'Converted', value: crmLeads.filter(l => l.status === 'converted').length }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Referral Analytics</h1>
          <p className="text-gray-600">Track your referral performance and earnings</p>
        </div>

        {/* Multi-Tier System */}
        <div className="mb-8">
          <MultiTierReferralSystem user={user} />
        </div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4" />
                Total User Referrals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalUserReferrals}</div>
              <p className="text-blue-100 text-sm mt-1">
                {activeReferrals} active
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Business Referrals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalBusinessReferrals}</div>
              <p className="text-purple-100 text-sm mt-1">
                {crmLeads.filter(l => l.status === 'converted').length} converted
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Total Earnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${totalEarnings.toFixed(2)}</div>
              <p className="text-green-100 text-sm mt-1">
                ${earningsPerReferral} per referral
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="w-4 h-4" />
                Conversion Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{conversionRate}%</div>
              <p className="text-amber-100 text-sm mt-1">
                {convertedReferrals} converted
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Analytics Tabs */}
        <Tabs defaultValue="timeline" className="space-y-6">
          <TabsList className="bg-white shadow-md">
            <TabsTrigger value="timeline">
              <Activity className="w-4 h-4 mr-2" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="sources">
              <Globe className="w-4 h-4 mr-2" />
              Source Performance
            </TabsTrigger>
            <TabsTrigger value="cohort">
              <BarChart3 className="w-4 h-4 mr-2" />
              Cohort Analysis
            </TabsTrigger>
            <TabsTrigger value="leaderboard">
              <Award className="w-4 h-4 mr-2" />
              Leaderboard
            </TabsTrigger>
            <TabsTrigger value="achievements">
              <Sparkles className="w-4 h-4 mr-2" />
              Achievements
            </TabsTrigger>
            <TabsTrigger value="ai-campaigns">
              <Sparkles className="w-4 h-4 mr-2" />
              AI Campaigns
            </TabsTrigger>
            <TabsTrigger value="status">
              <TrendingUp className="w-4 h-4 mr-2" />
              Status
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Referral Activity (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="referrals" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      name="Daily Referrals"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="status">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Referral Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Recent Referrals</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {userReferrals.slice(0, 5).map((referral) => (
                      <div key={referral.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">
                            {referral.referral_type === 'user' ? 'User Referral' : 'Business Referral'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {moment(referral.created_date).fromNow()}
                          </p>
                        </div>
                        <Badge className={
                          referral.status === 'converted' ? 'bg-blue-100 text-blue-700' :
                          referral.status === 'active' ? 'bg-green-100 text-green-700' :
                          'bg-amber-100 text-amber-700'
                        }>
                          {referral.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sources">
            <SourcePerformance user={user} />
          </TabsContent>

          <TabsContent value="cohort">
            <CohortAnalysis user={user} />
          </TabsContent>

          <TabsContent value="leaderboard">
            <ReferralLeaderboard currentUser={user} />
          </TabsContent>

          <TabsContent value="achievements">
            <AchievementsBadges user={user} />
          </TabsContent>

          <TabsContent value="ai-campaigns">
            <AICampaignGenerator user={user} />
          </TabsContent>
        </Tabs>

        {/* Additional Analytics Tools */}
        <div className="grid lg:grid-cols-2 gap-6 mt-6">
          <ABTestingDashboard user={user} />
          <CustomReportGenerator user={user} />
        </div>

        <PredictiveAnalytics user={user} />

        {/* Onboarding Modal */}
        {showOnboarding && (
          <ReferralOnboarding 
            user={user} 
            isOpen={showOnboarding} 
            onComplete={() => setShowOnboarding(false)} 
          />
        )}
      </div>
    </div>
  );
}

        {/* Detailed Leads Table */}
        <Card className="border-0 shadow-lg mt-6">
          <CardHeader>
            <CardTitle>All Business Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {crmLeads.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No business leads yet</p>
              ) : (
                crmLeads.map((lead) => (
                  <div key={lead.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{lead.name || 'Anonymous'}</p>
                        <p className="text-sm text-gray-600">{lead.email}</p>
                        {lead.company && (
                          <p className="text-sm text-gray-500 mt-1">
                            <Briefcase className="w-3 h-3 inline mr-1" />
                            {lead.company}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <Badge className={
                          lead.status === 'converted' ? 'bg-green-100 text-green-700' :
                          lead.status === 'qualified' ? 'bg-blue-100 text-blue-700' :
                          lead.status === 'contacted' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-700'
                        }>
                          {lead.status}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-2">
                          {moment(lead.created_date).format('MMM DD, YYYY')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
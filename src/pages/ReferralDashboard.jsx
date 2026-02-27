import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  DollarSign, 
  Link as LinkIcon, 
  TrendingUp,
  Copy,
  Share2,
  Award,
  Target,
  Clock,
  CheckCircle,
  Trophy
} from "lucide-react";
import DailyGoalProgress from '../components/gamification/DailyGoalProgress';
import { toast } from "sonner";
import TieredRewardsDisplay from '../components/referral/TieredRewardsDisplay';
import BadgesDisplay from '../components/referral/BadgesDisplay';
import GamificationHub from '../components/gamification/GamificationHub';

export default function ReferralDashboard() {
  const [user, setUser] = useState(null);
  const [newLinkName, setNewLinkName] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  // Fetch user's referral links
  const { data: referralLinks = [] } = useQuery({
    queryKey: ['referralLinks', user?.id],
    queryFn: async () => {
      return await base44.entities.CustomReferralLink.filter({
        user_id: user.id
      });
    },
    enabled: !!user
  });

  // Fetch referrals made by this user
  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals', user?.id],
    queryFn: async () => {
      return await base44.entities.Referral.filter({
        referrer_user_id: user.id
      });
    },
    enabled: !!user
  });

  // Fetch achievements
  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements', user?.id],
    queryFn: async () => {
      return await base44.entities.ReferralAchievement.filter({
        user_id: user.id
      });
    },
    enabled: !!user
  });

  // Create new referral link
  const createLinkMutation = useMutation({
    mutationFn: async () => {
      const linkCode = `${user.full_name.replace(/\s+/g, '')}-${Date.now()}`;
      await base44.entities.CustomReferralLink.create({
        user_id: user.id,
        link_code: linkCode,
        link_type: 'general',
        campaign_name: newLinkName || 'General Referral'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['referralLinks']);
      setNewLinkName('');
      toast.success('Referral link created!');
    }
  });

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Link copied to clipboard!');
  };

  // Calculate stats
  const totalReferrals = referrals.length;
  const totalEarnings = referrals.reduce((sum, r) => sum + (r.total_earnings || 0), 0);
  const commissionEarned = referrals.reduce((sum, r) => sum + (r.commission_earned || 0), 0);
  const activeReferrals = referrals.filter(r => r.status === 'active').length;

  const totalClicks = referralLinks.reduce((sum, link) => sum + (link.clicks || 0), 0);
  const totalConversions = referralLinks.reduce((sum, link) => sum + (link.conversions || 0), 0);
  const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks * 100) : 0;

  const stats = {
    totalReferrals,
    totalEarnings,
    commissionEarned,
    activeReferrals,
    totalClicks,
    totalConversions,
    conversionRate
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Users className="w-10 h-10 text-blue-600" />
            Referral Dashboard
          </h1>
          <p className="text-gray-600">Earn <strong>$0.25 every time a referred user earns $3 in a day</strong> — paid automatically!</p>
        </div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Total Referrals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">{totalReferrals}</p>
              <p className="text-xs text-gray-500 mt-1">{activeReferrals} active</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Your Earnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">${commissionEarned.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">Total commission</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Total Clicks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-600">{totalClicks}</p>
              <p className="text-xs text-gray-500 mt-1">{totalConversions} conversions</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Conversion Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-orange-600">{conversionRate.toFixed(1)}%</p>
              <p className="text-xs text-gray-500 mt-1">Click to signup</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tiers">
              <Trophy className="w-4 h-4 mr-2" />
              Tiers & Badges
            </TabsTrigger>
            <TabsTrigger value="gamification">
              <Award className="w-4 h-4 mr-2" />
              Points & Badges
            </TabsTrigger>
            <TabsTrigger value="links">My Links</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {/* Create New Link */}
            <Card className="mb-8 border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="w-5 h-5" />
                  Create New Referral Link
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Input
                    placeholder="Campaign name (optional)"
                    value={newLinkName}
                    onChange={(e) => setNewLinkName(e.target.value)}
                  />
                  <Button onClick={() => createLinkMutation.mutate()}>
                    Create Link
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Referral Links */}
        <Card className="mb-8 border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Your Referral Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {referralLinks.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No referral links yet. Create one above!</p>
              ) : (
                referralLinks.map((link) => {
                  const linkUrl = `${window.location.origin}/Home?ref=${link.link_code}`;
                  const linkConversionRate = link.clicks > 0 ? (link.conversions / link.clicks * 100) : 0;
                  
                  return (
                    <div key={link.id} className="p-4 border rounded-lg bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900">{link.campaign_name || 'Referral Link'}</p>
                          <p className="text-xs text-gray-500">Code: {link.link_code}</p>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-center">
                            <p className="font-bold text-blue-600">{link.clicks || 0}</p>
                            <p className="text-xs text-gray-500">Clicks</p>
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-green-600">{link.conversions || 0}</p>
                            <p className="text-xs text-gray-500">Conversions</p>
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-purple-600">${(link.total_earned || 0).toFixed(2)}</p>
                            <p className="text-xs text-gray-500">Earned</p>
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-orange-600">{linkConversionRate.toFixed(1)}%</p>
                            <p className="text-xs text-gray-500">Rate</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input value={linkUrl} readOnly className="text-sm" />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(linkUrl)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (navigator.share) {
                              navigator.share({ url: linkUrl, title: 'Join GamerGain!' });
                            } else {
                              copyToClipboard(linkUrl);
                            }
                          }}
                        >
                          <Share2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Referred Users */}
        <Card className="mb-8 border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Your Referrals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {referrals.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No referrals yet. Share your links to get started!</p>
              ) : (
                referrals.map((referral) => (
                  <div key={referral.id} className="p-4 border rounded-lg bg-gray-50 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">User #{referral.referred_user_id.slice(0, 8)}</p>
                      <p className="text-xs text-gray-500">
                        Joined {new Date(referral.created_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-600">Their Earnings</p>
                        <p className="text-xl font-bold text-blue-600">
                          ${(referral.total_earnings || 0).toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                       <p className="text-sm font-medium text-gray-600">Your Commission</p>
                       <p className="text-xl font-bold text-green-600">
                         ${(referral.commission_earned || 0).toFixed(2)}
                       </p>
                      </div>
                      <Badge variant={referral.status === 'active' ? 'default' : 'secondary'}>
                        {referral.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

          </TabsContent>

          <TabsContent value="tiers">
            <div className="space-y-6">
              <TieredRewardsDisplay user={user} referralStats={stats} />
              <BadgesDisplay user={user} referralStats={stats} />
            </div>
          </TabsContent>

          <TabsContent value="gamification">
            <GamificationHub user={user} stats={stats} />
          </TabsContent>

          <TabsContent value="links">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Manage Referral Links</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {referralLinks.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No referral links yet. Create one in the Overview tab!</p>
                  ) : (
                    referralLinks.map((link) => {
                      const linkUrl = `${window.location.origin}/Home?ref=${link.link_code}`;
                      const linkConversionRate = link.clicks > 0 ? (link.conversions / link.clicks * 100) : 0;
                      
                      return (
                        <div key={link.id} className="p-4 border rounded-lg bg-gray-50">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-medium text-gray-900">{link.campaign_name || 'Referral Link'}</p>
                              <p className="text-xs text-gray-500">Code: {link.link_code}</p>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="text-center">
                                <p className="font-bold text-blue-600">{link.clicks || 0}</p>
                                <p className="text-xs text-gray-500">Clicks</p>
                              </div>
                              <div className="text-center">
                                <p className="font-bold text-green-600">{link.conversions || 0}</p>
                                <p className="text-xs text-gray-500">Conversions</p>
                              </div>
                              <div className="text-center">
                                <p className="font-bold text-purple-600">${(link.total_earned || 0).toFixed(2)}</p>
                                <p className="text-xs text-gray-500">Earned</p>
                              </div>
                              <div className="text-center">
                                <p className="font-bold text-orange-600">{linkConversionRate.toFixed(1)}%</p>
                                <p className="text-xs text-gray-500">Rate</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input value={linkUrl} readOnly className="text-sm" />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyToClipboard(linkUrl)}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (navigator.share) {
                                  navigator.share({ url: linkUrl, title: 'Join GamerGain!' });
                                } else {
                                  copyToClipboard(linkUrl);
                                }
                              }}
                            >
                              <Share2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
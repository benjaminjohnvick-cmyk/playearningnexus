import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  ExternalLink, 
  Copy,
  BarChart3,
  Calendar,
  Target
} from 'lucide-react';
import { toast } from 'sonner';

export default function ReferralTracking() {
  const [user, setUser] = useState(null);

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
    queryFn: () => base44.entities.CustomReferralLink.filter({ user_id: user.id }, '-created_date'),
    enabled: !!user
  });

  // Calculate total stats
  const totalClicks = referralLinks.reduce((sum, link) => sum + (link.clicks || 0), 0);
  const totalConversions = referralLinks.reduce((sum, link) => sum + (link.conversions || 0), 0);
  const totalEarned = referralLinks.reduce((sum, link) => sum + (link.total_earned || 0), 0);
  const conversionRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(2) : 0;

  const copyLink = (link) => {
    const fullLink = `${window.location.origin}/?ref=${link.link_code}`;
    navigator.clipboard.writeText(fullLink);
    toast.success('Referral link copied!');
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-700 to-purple-700 bg-clip-text text-transparent mb-2">
            Referral Link Analytics
          </h1>
          <p className="text-gray-600">Track your referral performance and earnings</p>
        </div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Clicks</p>
                  <p className="text-3xl font-bold text-blue-600">{totalClicks}</p>
                </div>
                <ExternalLink className="w-8 h-8 text-blue-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Conversions</p>
                  <p className="text-3xl font-bold text-green-600">{totalConversions}</p>
                </div>
                <Users className="w-8 h-8 text-green-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Earned</p>
                  <p className="text-3xl font-bold text-purple-600">${totalEarned.toFixed(2)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-purple-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Conversion Rate</p>
                  <p className="text-3xl font-bold text-orange-600">{conversionRate}%</p>
                </div>
                <Target className="w-8 h-8 text-orange-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Referral Links Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Your Referral Links ({referralLinks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {referralLinks.length === 0 ? (
              <div className="text-center py-12">
                <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">No referral links yet</p>
                <p className="text-sm text-gray-400">Generate AI images to create referral links automatically!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {referralLinks.map((link) => (
                  <div 
                    key={link.id}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{link.campaign_name}</h3>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            {link.link_type}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            value={`${window.location.origin}/?ref=${link.link_code}`}
                            readOnly
                            className="text-xs bg-gray-50"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyLink(link)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div className="bg-blue-50 p-3 rounded">
                        <ExternalLink className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                        <p className="text-lg font-bold text-blue-600">{link.clicks || 0}</p>
                        <p className="text-xs text-gray-600">Clicks</p>
                      </div>
                      <div className="bg-green-50 p-3 rounded">
                        <Users className="w-4 h-4 text-green-600 mx-auto mb-1" />
                        <p className="text-lg font-bold text-green-600">{link.conversions || 0}</p>
                        <p className="text-xs text-gray-600">Conversions</p>
                      </div>
                      <div className="bg-purple-50 p-3 rounded">
                        <DollarSign className="w-4 h-4 text-purple-600 mx-auto mb-1" />
                        <p className="text-lg font-bold text-purple-600">${(link.total_earned || 0).toFixed(2)}</p>
                        <p className="text-xs text-gray-600">Earned</p>
                      </div>
                      <div className="bg-orange-50 p-3 rounded">
                        <Target className="w-4 h-4 text-orange-600 mx-auto mb-1" />
                        <p className="text-lg font-bold text-orange-600">
                          {link.clicks > 0 ? ((link.conversions / link.clicks) * 100).toFixed(1) : 0}%
                        </p>
                        <p className="text-xs text-gray-600">Rate</p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                      <Calendar className="w-3 h-3" />
                      Created {new Date(link.created_date).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tips Card */}
        <Card className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50">
          <CardHeader>
            <CardTitle className="text-lg">💡 Maximize Your Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>• Generate AI images to automatically create tracked referral links</li>
              <li>• Share your links on social media for maximum visibility</li>
              <li>• Each conversion earns you 10% revenue share</li>
              <li>• Track performance to optimize your referral strategy</li>
              <li>• Contest referrals count towards daily prizes!</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
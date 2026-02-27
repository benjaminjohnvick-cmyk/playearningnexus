import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  DollarSign, 
  Copy, 
  TrendingUp, 
  Gift,
  Link as LinkIcon,
  Star
} from 'lucide-react';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

export default function ReferralDashboard() {
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

  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id }),
    enabled: !!user
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ['payouts', user?.id],
    queryFn: () => base44.entities.Payout.filter({ user_id: user.id }, '-created_date', 10),
    enabled: !!user
  });

  const totalCommission = referrals.reduce((sum, r) => sum + (r.commission_earned || 0), 0);
  const activeReferrals = referrals.filter(r => r.status === 'active').length;
  const referralCode = user ? `REF-${user.id.slice(0, 8).toUpperCase()}` : '';
  const referralLink = user ? `${window.location.origin}/?ref=${referralCode}` : '';

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success('Referral link copied!');
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent mb-2">
            Referral Dashboard
          </h1>
          <p className="text-gray-600">Earn commissions by referring friends to GamerGain</p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Referrals</p>
                  <p className="text-3xl font-bold text-blue-600">{referrals.length}</p>
                </div>
                <Users className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Referrals</p>
                  <p className="text-3xl font-bold text-green-600">{activeReferrals}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Commission</p>
                  <p className="text-3xl font-bold text-purple-600">${totalCommission.toFixed(2)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Referral Link */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5" />
              Your Referral Link
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-50 border rounded-lg px-4 py-3 font-mono text-sm text-gray-700 overflow-hidden text-ellipsis whitespace-nowrap">
                {referralLink}
              </div>
              <Button onClick={copyLink} className="bg-red-600 hover:bg-red-700 flex-shrink-0">
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
            </div>
            <p className="text-sm text-gray-500 mt-3">
              Share this link to earn <strong>25% commission</strong> on all earnings from users you refer (after they earn $4).
            </p>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Link to={createPageUrl('ReferralContest')}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-yellow-200 bg-yellow-50">
              <CardContent className="pt-6 text-center">
                <Star className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                <p className="font-semibold text-yellow-800">Referral Contest</p>
                <p className="text-xs text-yellow-600 mt-1">Win daily prizes</p>
              </CardContent>
            </Card>
          </Link>
          <Link to={createPageUrl('ReferralAnalytics')}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-blue-200 bg-blue-50">
              <CardContent className="pt-6 text-center">
                <TrendingUp className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="font-semibold text-blue-800">Analytics</p>
                <p className="text-xs text-blue-600 mt-1">Detailed insights</p>
              </CardContent>
            </Card>
          </Link>
          <Link to={createPageUrl('PayoutHistory')}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-green-200 bg-green-50">
              <CardContent className="pt-6 text-center">
                <Gift className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="font-semibold text-green-800">Payout History</p>
                <p className="text-xs text-green-600 mt-1">View earnings</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Referral List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Referrals ({referrals.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {referrals.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">No referrals yet</p>
                <p className="text-sm text-gray-400">Share your referral link to start earning!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {referrals.map((referral) => (
                  <div key={referral.id} className="flex items-center justify-between border rounded-lg p-4 bg-white">
                    <div>
                      <p className="font-medium text-gray-800">Referred User</p>
                      <p className="text-sm text-gray-500">
                        Total earned: ${(referral.total_earnings || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={referral.status === 'active' ? 'default' : 'secondary'}>
                        {referral.status}
                      </Badge>
                      <p className="text-sm text-green-600 font-medium mt-1">
                        +${(referral.commission_earned || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Copy, Gift, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export default function ReferralProgram({ user }) {
  const [referralCode, setReferralCode] = useState('');

  useEffect(() => {
    if (user && !user.referral_code) {
      const code = `GR${user.id.slice(0, 8).toUpperCase()}`;
      setReferralCode(code);
      base44.auth.updateMe({ referral_code: code });
    } else if (user) {
      setReferralCode(user.referral_code);
    }
  }, [user]);

  const { data: myReferrals = [] } = useQuery({
    queryKey: ['my-referrals', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id }),
    enabled: !!user
  });

  const referralUrl = `${window.location.origin}?ref=${referralCode}`;
  const totalBonus = myReferrals.reduce((sum, r) => sum + (r.bonus_earned || 0), 0);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralUrl);
    toast.success('Referral link copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-r from-red-50 to-white border-2 border-red-200">
        <div className="flex items-center gap-3 mb-4">
          <Gift className="w-8 h-8 text-red-600" />
          <h3 className="text-2xl font-bold text-gray-900">Refer Friends & Earn</h3>
        </div>
        <p className="text-gray-600 mb-6">
          Share your unique referral link and earn bonuses when your friends sign up!
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Your Referral Code</label>
            <div className="flex gap-2">
              <Input value={referralCode} readOnly className="font-mono" />
              <Button onClick={copyToClipboard} className="bg-red-600 hover:bg-red-700">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Your Referral Link</label>
            <div className="flex gap-2">
              <Input value={referralUrl} readOnly className="text-sm" />
              <Button onClick={copyToClipboard} className="bg-red-600 hover:bg-red-700">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="p-6 bg-white/80 backdrop-blur-sm border-2 border-red-200">
          <Users className="w-8 h-8 text-red-600 mb-3" />
          <p className="text-sm text-gray-600 mb-1">Total Referrals</p>
          <p className="text-3xl font-bold text-gray-900">{myReferrals.length}</p>
        </Card>

        <Card className="p-6 bg-white/80 backdrop-blur-sm border-2 border-green-200">
          <TrendingUp className="w-8 h-8 text-green-600 mb-3" />
          <p className="text-sm text-gray-600 mb-1">Bonus Earned</p>
          <p className="text-3xl font-bold text-green-600">${totalBonus.toFixed(2)}</p>
        </Card>

        <Card className="p-6 bg-white/80 backdrop-blur-sm border-2 border-blue-200">
          <Gift className="w-8 h-8 text-blue-600 mb-3" />
          <p className="text-sm text-gray-600 mb-1">Active Referrals</p>
          <p className="text-3xl font-bold text-blue-600">
            {myReferrals.filter(r => r.status === 'active').length}
          </p>
        </Card>
      </div>

      {myReferrals.length > 0 && (
        <Card className="p-6 bg-white/80 backdrop-blur-sm border-2 border-red-200">
          <h4 className="font-bold text-lg mb-4">Your Referrals</h4>
          <div className="space-y-2">
            {myReferrals.map(referral => (
              <div key={referral.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">Referral ID: {referral.referred_user_id?.slice(0, 8)}</p>
                  <p className="text-sm text-gray-600">
                    {new Date(referral.referred_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <Badge className={referral.status === 'active' ? 'bg-green-600' : 'bg-gray-600'}>
                    {referral.status}
                  </Badge>
                  <p className="text-sm font-medium text-green-600 mt-1">
                    +${(referral.bonus_earned || 0).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
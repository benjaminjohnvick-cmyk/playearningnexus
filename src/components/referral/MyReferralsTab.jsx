import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Users, DollarSign, Copy, Check, Share2, Twitter, Link2,
  TrendingUp, UserCheck, Clock, ExternalLink, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const SOCIAL_PLATFORMS = [
  {
    name: 'Twitter / X',
    icon: Twitter,
    color: 'bg-black text-white hover:bg-gray-800',
    getUrl: (link, text) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`
  },
  {
    name: 'Facebook',
    icon: Share2,
    color: 'bg-blue-600 text-white hover:bg-blue-700',
    getUrl: (link) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`
  },
  {
    name: 'WhatsApp',
    icon: Share2,
    color: 'bg-green-500 text-white hover:bg-green-600',
    getUrl: (link, text) => `https://wa.me/?text=${encodeURIComponent(text + ' ' + link)}`
  },
];

const SHARE_TEXT = "I'm earning real money completing surveys on GamerGain! Join me and start earning too 🎮💰";

export default function MyReferralsTab({ user }) {
  const [copied, setCopied] = useState(false);

  const { data: myReferrals = [], isLoading } = useQuery({
    queryKey: ['my-referrals-tab', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id }, '-created_date', 100),
    enabled: !!user,
  });

  const { data: customLinks = [] } = useQuery({
    queryKey: ['my-custom-links', user?.id],
    queryFn: () => base44.entities.CustomReferralLink.filter({ user_id: user.id }),
    enabled: !!user,
  });

  const referralLink = customLinks[0]?.full_url
    || `${window.location.origin}?ref=${user?.id?.slice(0, 8)}`;

  const activeReferrals = myReferrals.filter(r => r.status === 'active');
  const totalCommission = myReferrals.reduce((s, r) => s + (r.commission_earned || 0), 0);
  const pendingCommission = myReferrals.filter(r => r.status === 'pending').reduce((s, r) => s + (r.commission_earned || 0), 0);
  const conversionRate = myReferrals.length > 0
    ? ((activeReferrals.length / myReferrals.length) * 100).toFixed(1)
    : 0;

  const copyLink = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const statusColor = {
    active: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    inactive: 'bg-gray-100 text-gray-600',
    converted: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="space-y-6">

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Active Referrals', value: activeReferrals.length, color: 'text-green-600', icon: UserCheck },
          { label: 'Total Referrals', value: myReferrals.length, color: 'text-blue-600', icon: Users },
          { label: 'Commission Earned', value: `$${totalCommission.toFixed(2)}`, color: 'text-purple-600', icon: DollarSign },
          { label: 'Conversion Rate', value: `${conversionRate}%`, color: 'text-orange-600', icon: TrendingUp },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Referral Link Generator */}
      <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-800">
            <Link2 className="w-5 h-5" /> Your Unique Referral Link
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={referralLink} readOnly className="bg-white font-mono text-sm" />
            <Button onClick={copyLink} className="flex-shrink-0 bg-purple-600 hover:bg-purple-700">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Share on social media:</p>
            <div className="flex flex-wrap gap-2">
              {SOCIAL_PLATFORMS.map(platform => {
                const Icon = platform.icon;
                return (
                  <a
                    key={platform.name}
                    href={platform.getUrl(referralLink, SHARE_TEXT)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" className={platform.color}>
                      <Icon className="w-3.5 h-3.5 mr-1.5" />
                      {platform.name}
                      <ExternalLink className="w-3 h-3 ml-1.5" />
                    </Button>
                  </a>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-purple-100">
            <p className="text-xs font-semibold text-purple-700 mb-1">💡 How you earn from referrals:</p>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Earn <strong>10% commission</strong> on every survey your referred user completes</li>
              <li>• Referrals that become active boost your contest rank &amp; unlock tier advancement</li>
              <li>• More active referrals = higher contest tier prize eligibility</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Commission Summary */}
      {totalCommission > 0 && (
        <Card className="border-0 shadow-md bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm text-gray-500">Total Commission Earned</p>
                <p className="text-3xl font-black text-green-600">${totalCommission.toFixed(2)}</p>
              </div>
              {pendingCommission > 0 && (
                <div className="text-right">
                  <p className="text-sm text-gray-500">Pending Payout</p>
                  <p className="text-xl font-bold text-yellow-600">${pendingCommission.toFixed(2)}</p>
                </div>
              )}
            </div>
            {myReferrals.length > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Active Referral Rate</span>
                  <span>{activeReferrals.length} / {myReferrals.length}</span>
                </div>
                <Progress value={parseFloat(conversionRate)} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Referral List */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" /> My Referred Users
            <Badge className="ml-auto bg-blue-100 text-blue-700">{myReferrals.length} total</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-400">Loading referrals...</div>
          ) : myReferrals.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No referrals yet</p>
              <p className="text-sm text-gray-400 mt-1">Share your link above to start earning commissions!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {myReferrals.map(ref => (
                <div key={ref.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white text-sm font-bold">
                      {(ref.referred_user_email || ref.referred_user_id || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {ref.referred_user_email
                          ? ref.referred_user_email.replace(/(.{2}).*@/, '$1***@')
                          : `User ${(ref.referred_user_id || ref.id).slice(0, 8)}…`}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        {ref.created_date ? format(new Date(ref.created_date), 'MMM d, yyyy') : 'Unknown date'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-600">+${(ref.commission_earned || 0).toFixed(2)}</p>
                      <p className="text-xs text-gray-400">commission</p>
                    </div>
                    <Badge className={`text-xs ${statusColor[ref.status] || 'bg-gray-100 text-gray-600'}`}>
                      {ref.status || 'pending'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
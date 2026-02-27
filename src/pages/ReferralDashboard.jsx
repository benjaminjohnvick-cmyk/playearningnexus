import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';
import { Users, Copy, Share2, Trophy, Star, Crown, TrendingUp, CheckCircle, DollarSign, Link2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const TIERS = [
  { name: 'Bronze',   minReferrals: 0,  minEarnings: 0,   multiplier: 1.0,  color: 'text-amber-700', bg: 'bg-amber-100', border: 'border-amber-300' },
  { name: 'Silver',   minReferrals: 3,  minEarnings: 5,   multiplier: 1.1,  color: 'text-gray-600',  bg: 'bg-gray-100',  border: 'border-gray-400' },
  { name: 'Gold',     minReferrals: 10, minEarnings: 25,  multiplier: 1.25, color: 'text-yellow-600',bg: 'bg-yellow-50', border: 'border-yellow-400' },
  { name: 'Platinum', minReferrals: 25, minEarnings: 75,  multiplier: 1.5,  color: 'text-blue-600',  bg: 'bg-blue-50',   border: 'border-blue-400' },
  { name: 'Diamond',  minReferrals: 50, minEarnings: 200, multiplier: 2.0,  color: 'text-purple-700',bg: 'bg-purple-50', border: 'border-purple-500' },
];

function getUserTier(activeReferrals, commission) {
  let tier = TIERS[0];
  for (const t of TIERS) {
    if (activeReferrals >= t.minReferrals && commission >= t.minEarnings) tier = t;
  }
  return tier;
}

export default function ReferralDashboard() {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id }),
    enabled: !!user,
  });

  const { data: links = [] } = useQuery({
    queryKey: ['referralLinks', user?.id],
    queryFn: () => base44.entities.CustomReferralLink.filter({ user_id: user.id }),
    enabled: !!user,
  });

  const createLinkMutation = useMutation({
    mutationFn: async () => {
      const code = `${user.id.slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`;
      return base44.entities.CustomReferralLink.create({ user_id: user.id, link_code: code, link_type: 'general', is_active: true });
    },
    onSuccess: () => { queryClient.invalidateQueries(['referralLinks', user?.id]); toast.success('New referral link created!'); }
  });

  const copyLink = (code) => {
    navigator.clipboard.writeText(`${window.location.origin}?ref=${code}`);
    toast.success('Link copied to clipboard!');
  };

  const shareLink = async (code) => {
    const url = `${window.location.origin}?ref=${code}`;
    if (navigator.share) {
      await navigator.share({ title: 'Join GamerGain!', text: 'Earn money playing games!', url });
    } else {
      copyLink(code);
    }
  };

  const activeReferrals = referrals.filter(r => r.status === 'active').length;
  const commission = referrals.reduce((s, r) => s + (r.commission_earned || 0), 0);
  const currentTier = getUserTier(activeReferrals, commission);
  const nextTier = TIERS[TIERS.findIndex(t => t.name === currentTier.name) + 1];
  const points = referrals.length * 25 + activeReferrals * 10;

  if (!user) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="mb-2">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3"><Users className="w-8 h-8 text-red-600" />Referral Dashboard</h1>
          <p className="text-gray-500 mt-1">Invite friends, earn commissions, climb the tiers</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Referrals', value: referrals.length, color: 'text-blue-600', bg: 'bg-blue-50', icon: Users },
            { label: 'Active Referrals', value: activeReferrals, color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle },
            { label: 'Commission Earned', value: `$${commission.toFixed(2)}`, color: 'text-purple-600', bg: 'bg-purple-50', icon: DollarSign },
            { label: 'Referral Points', value: points, color: 'text-yellow-600', bg: 'bg-yellow-50', icon: Star },
          ].map(s => (
            <Card key={s.label} className={`border-0 shadow-lg ${s.bg}`}>
              <CardContent className="pt-5 text-center">
                <s.icon className={`w-6 h-6 mx-auto mb-1 ${s.color}`} />
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="links">
          <TabsList className="bg-white shadow border w-full grid grid-cols-3">
            <TabsTrigger value="links"><Link2 className="w-4 h-4 mr-1" />My Links</TabsTrigger>
            <TabsTrigger value="referrals"><Users className="w-4 h-4 mr-1" />My Referrals</TabsTrigger>
            <TabsTrigger value="tiers"><Crown className="w-4 h-4 mr-1" />Tiers</TabsTrigger>
          </TabsList>

          {/* Links Tab */}
          <TabsContent value="links" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-gray-700">Your Referral Links</h2>
              <Button onClick={() => createLinkMutation.mutate()} disabled={createLinkMutation.isPending} className="bg-red-600 hover:bg-red-700">
                <Zap className="w-4 h-4 mr-1" /> Generate New Link
              </Button>
            </div>
            {links.length === 0 ? (
              <Card className="border-dashed border-2">
                <CardContent className="py-12 text-center">
                  <Link className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-400 mb-3">No referral links yet</p>
                  <Button onClick={() => createLinkMutation.mutate()} className="bg-red-600 hover:bg-red-700">Create Your First Link</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {links.map((link, idx) => (
                  <motion.div key={link.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                    <Card className="border shadow-sm">
                      <CardContent className="pt-4">
                        <div className="flex flex-col md:flex-row md:items-center gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">{link.link_type}</Badge>
                              {link.is_active ? <Badge className="bg-green-600 text-xs">Active</Badge> : <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                            </div>
                            <Input readOnly value={`${window.location.origin}?ref=${link.link_code}`} className="bg-gray-50 text-sm font-mono" />
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <Button size="sm" variant="outline" onClick={() => copyLink(link.link_code)}><Copy className="w-4 h-4 mr-1" />Copy</Button>
                            <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => shareLink(link.link_code)}><Share2 className="w-4 h-4 mr-1" />Share</Button>
                          </div>
                        </div>
                        <div className="flex gap-4 mt-3 text-xs text-gray-500">
                          <span>👆 {link.clicks || 0} clicks</span>
                          <span>✅ {link.conversions || 0} conversions</span>
                          <span>💵 ${(link.total_earned || 0).toFixed(2)} earned</span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Referrals Tab */}
          <TabsContent value="referrals" className="mt-4">
            <Card>
              <CardContent className="pt-4">
                {referrals.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <Users className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                    <p>No referrals yet. Share your link to start earning!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {referrals.map(r => (
                      <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">User #{r.referred_user_id.slice(0, 8)}</p>
                          <p className="text-xs text-gray-400">Joined {new Date(r.created_date).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-bold text-green-600">${(r.commission_earned || 0).toFixed(2)}</p>
                            <p className="text-xs text-gray-400">commission</p>
                          </div>
                          <Badge className={r.status === 'active' ? 'bg-green-600' : 'bg-gray-400'}>{r.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tiers Tab */}
          <TabsContent value="tiers" className="mt-4 space-y-4">
            <Card className={`border-2 ${currentTier.border}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Crown className={`w-5 h-5 ${currentTier.color}`} />
                  Your Current Tier: <span className={`font-bold ${currentTier.color}`}>{currentTier.name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-3">{currentTier.multiplier}x commission multiplier on all referral earnings</p>
                {nextTier && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 font-medium">Progress to {nextTier.name}:</p>
                    <div>
                      <div className="flex justify-between text-xs mb-1"><span>Active Referrals</span><span>{activeReferrals}/{nextTier.minReferrals}</span></div>
                      <Progress value={Math.min(100, (activeReferrals / Math.max(nextTier.minReferrals, 1)) * 100)} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1"><span>Commission Earned</span><span>${commission.toFixed(2)}/${nextTier.minEarnings}</span></div>
                      <Progress value={Math.min(100, (commission / Math.max(nextTier.minEarnings, 1)) * 100)} className="h-2" />
                    </div>
                  </div>
                )}
                {!nextTier && <p className="text-sm font-bold text-purple-700">🏆 You've reached the maximum tier!</p>}
              </CardContent>
            </Card>

            <div className="space-y-3">
              {TIERS.map(tier => {
                const isCurrent = tier.name === currentTier.name;
                return (
                  <div key={tier.name} className={`flex items-center justify-between p-4 rounded-xl border-2 ${isCurrent ? `${tier.bg} ${tier.border}` : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center gap-3">
                      {isCurrent && <Badge className="bg-green-600 text-xs">Current</Badge>}
                      <span className={`font-bold text-lg ${isCurrent ? tier.color : 'text-gray-400'}`}>{tier.name}</span>
                    </div>
                    <div className="text-right text-xs text-gray-500 space-y-0.5">
                      <p>{tier.minReferrals}+ active referrals</p>
                      <p>${tier.minEarnings}+ commission</p>
                      <Badge className={isCurrent ? 'bg-green-600' : 'bg-gray-300'}>{tier.multiplier}x multiplier</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
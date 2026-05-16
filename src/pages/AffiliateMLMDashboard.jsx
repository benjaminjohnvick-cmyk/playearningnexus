import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users, DollarSign, TrendingUp, Share2, Zap, Globe,
  CheckCircle2, AlertCircle, Clock, ChevronRight, Instagram,
  Twitter, Facebook
} from 'lucide-react';
import { toast } from 'sonner';

const PLATFORM_ICONS = {
  facebook: <Facebook className="w-4 h-4 text-blue-600" />,
  twitter: <Twitter className="w-4 h-4 text-sky-500" />,
  instagram: <Instagram className="w-4 h-4 text-pink-500" />,
  snapchat: <span className="text-sm">👻</span>,
  tiktok: <span className="text-sm">🎵</span>
};

const ULAModal = ({ onAccept, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
      <h2 className="text-xl font-bold text-gray-900 mb-2">🤝 AI Affiliate Agreement</h2>
      <p className="text-sm text-gray-500 mb-4">Please read carefully before joining the GamerGain AI Affiliate Program.</p>
      <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 max-h-64 overflow-y-auto space-y-3 mb-6 leading-relaxed">
        <p><strong>By accepting this agreement, you authorize GamerGain to:</strong></p>
        <ul className="list-disc ml-4 space-y-1">
          <li>Automatically generate AI-written promotional ads on your behalf using current trending topics.</li>
          <li>Post those ads to your connected social media accounts (Facebook, Twitter, Instagram, Snapchat, TikTok) <strong>once per day</strong>.</li>
          <li>Embed your unique referral link in every post so you earn credit for sign-ups.</li>
        </ul>
        <p><strong>Earnings Structure:</strong></p>
        <ul className="list-disc ml-4 space-y-1">
          <li><strong>$5 website credit</strong> when a referred user earns their first $8 on GamerGain (PPC ads + BitLabs surveys only).</li>
          <li><strong>$0.25 website credit</strong> every time any of your referrals (up to 3 levels deep) earns another $8 milestone.</li>
          <li>Credits can only be spent on the GamerGain platform.</li>
        </ul>
        <p><strong>You can withdraw consent and disconnect at any time from your dashboard.</strong></p>
        <p className="text-xs text-gray-400">GamerGain reserves the right to pause posting if ads violate platform terms of service. All generated content complies with applicable advertising standards.</p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600" onClick={onAccept}>
          ✅ I Accept — Join Program
        </Button>
      </div>
    </div>
  </div>
);

export default function AffiliateMLMDashboard() {
  const [user, setUser] = useState(null);
  const [showULA, setShowULA] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: mlmNode, refetch: refetchNode } = useQuery({
    queryKey: ['mlmNode', user?.id],
    queryFn: () => base44.entities.MLMNode.filter({ user_id: user?.id }),
    enabled: !!user?.id,
    select: d => d?.[0] || null
  });

  const { data: adPosts = [] } = useQuery({
    queryKey: ['affiliateAdPosts', user?.id],
    queryFn: () => base44.entities.AffiliateAdPost.filter({ user_id: user?.id }, '-posted_at', 20),
    enabled: !!user?.id
  });

  const { data: myReferrals = [] } = useQuery({
    queryKey: ['myReferrals', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user?.id }),
    enabled: !!user?.id
  });

  const handleAcceptULA = async () => {
    setShowULA(false);
    setEnrolling(true);
    try {
      await base44.functions.invoke('enrollSocialAffiliate', {
        user_id: user.id,
        accepted_ula: true,
        social_platforms_connected: ['facebook', 'twitter', 'instagram']
      });
      await refetchNode();
      toast.success('🎉 You\'re now enrolled in the AI Affiliate Program!');
    } catch (e) {
      toast.error('Enrollment failed. Please try again.');
    }
    setEnrolling(false);
  };

  const totalCredit = mlmNode?.website_credit_balance || 0;
  const totalBonuses = mlmNode?.total_mlm_bonuses_received || 0;
  const totalDirectCredits = mlmNode?.direct_referral_credits_earned || 0;
  const totalAdsPosted = mlmNode?.total_ads_posted || 0;
  const isEnrolled = mlmNode?.is_social_affiliate && mlmNode?.accepted_ula;

  const connectedPlatforms = mlmNode?.social_platforms_connected || [];

  const mlmChain = {
    level1: myReferrals.length,
    level2: myReferrals.filter(r => r.level_2_referrer_id).length,
    level3: myReferrals.filter(r => r.level_3_referrer_id).length
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Button onClick={() => base44.auth.redirectToLogin()}>Sign In to Access Affiliate Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 p-4 md:p-8">
      {showULA && <ULAModal onAccept={handleAcceptULA} onClose={() => setShowULA(false)} />}

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900">🤖 AI Affiliate Hub</h1>
            <p className="text-gray-500 text-sm mt-1">Earn passively — AI posts ads daily, you collect credit</p>
          </div>
          {!isEnrolled ? (
            <Button
              onClick={() => setShowULA(true)}
              disabled={enrolling}
              className="bg-gradient-to-r from-green-600 to-emerald-600 shadow-lg font-bold px-6"
            >
              <Zap className="w-4 h-4 mr-2" />
              {enrolling ? 'Enrolling...' : 'Join AI Affiliate Program'}
            </Button>
          ) : (
            <Badge className="bg-green-100 text-green-700 border border-green-300 px-3 py-1 text-sm">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Active Affiliate
            </Badge>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Website Credit', value: `$${totalCredit.toFixed(2)}`, icon: <DollarSign className="w-5 h-5 text-green-600" />, color: 'from-green-500 to-emerald-500' },
            { label: 'Direct Referral Credits', value: `$${totalDirectCredits.toFixed(2)}`, icon: <Share2 className="w-5 h-5 text-blue-600" />, color: 'from-blue-500 to-sky-500' },
            { label: 'MLM Bonuses ($0.25)', value: `$${totalBonuses.toFixed(2)}`, icon: <TrendingUp className="w-5 h-5 text-purple-600" />, color: 'from-purple-500 to-indigo-500' },
            { label: 'Ads Posted by AI', value: totalAdsPosted, icon: <Globe className="w-5 h-5 text-orange-600" />, color: 'from-orange-500 to-red-500' }
          ].map(({ label, value, icon, color }) => (
            <Card key={label} className="border-0 shadow-md">
              <CardContent className="p-4 flex flex-col gap-2">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} bg-opacity-10 flex items-center justify-center`}>
                  {icon}
                </div>
                <div className="text-2xl font-black text-gray-900">{value}</div>
                <div className="text-xs text-gray-500">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="earnings">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="earnings">💰 Earnings Structure</TabsTrigger>
            <TabsTrigger value="ads">📱 Ad Posts</TabsTrigger>
            <TabsTrigger value="downline">🌲 My MLM Tree</TabsTrigger>
          </TabsList>

          {/* Earnings Structure */}
          <TabsContent value="earnings">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border-0 shadow-md">
                <CardHeader><CardTitle className="text-base">How You Earn</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {[
                    { icon: '🎯', title: '$5 Direct Referral Credit', desc: 'When your referred user earns their first $8 from PPC ads or BitLabs surveys' },
                    { icon: '🔁', title: '$0.25 Per $8 Milestone', desc: 'Every time any downline member earns another $8 (up to 3 levels deep)' },
                    { icon: '📊', title: '50/50 Split', desc: 'Each $8 earned = $4 to user + $4 to GamerGain. Your $0.25 bonus comes from PPC/BitLabs earnings only' },
                    { icon: '🏦', title: 'Platform Credits Only', desc: 'All earnings are website credit — spend on games, surveys, and more on GamerGain' }
                  ].map(({ icon, title, desc }) => (
                    <div key={title} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
                      <span className="text-xl flex-shrink-0">{icon}</span>
                      <div>
                        <div className="font-semibold text-gray-800">{title}</div>
                        <div className="text-gray-500 text-xs mt-0.5">{desc}</div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardHeader><CardTitle className="text-base">3-Level MLM Structure</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {[
                    { level: 'Level 1', label: 'You → Direct Referrals', count: mlmChain.level1, color: 'bg-green-100 text-green-700' },
                    { level: 'Level 2', label: 'Your referrals\' referrals', count: mlmChain.level2, color: 'bg-blue-100 text-blue-700' },
                    { level: 'Level 3', label: 'Deepest network layer', count: mlmChain.level3, color: 'bg-purple-100 text-purple-700' }
                  ].map(({ level, label, count, color }) => (
                    <div key={level} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Badge className={`${color} text-xs`}>{level}</Badge>
                        <span className="text-gray-600">{label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{count}</span>
                        <span className="text-gray-400 text-xs">members</span>
                      </div>
                    </div>
                  ))}
                  <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                    <p className="text-xs text-green-700">
                      💡 <strong>Tip:</strong> Each level earns you $0.25 per $8 milestone independently.
                      The more active your downline, the more passive income you earn.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Ad Posts */}
          <TabsContent value="ads">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Recent AI-Posted Ads</CardTitle>
                  <div className="flex gap-2">
                    {connectedPlatforms.map(p => (
                      <span key={p} className="flex items-center gap-1 text-xs bg-gray-100 rounded-full px-2 py-1">
                        {PLATFORM_ICONS[p]} {p}
                      </span>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {adPosts.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Globe className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No ads posted yet</p>
                    {!isEnrolled && <p className="text-xs mt-1">Join the program to start receiving daily AI-posted ads</p>}
                  </div>
                ) : adPosts.map(post => (
                  <div key={post.id} className="p-4 border border-gray-100 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {PLATFORM_ICONS[post.platform]}
                        <span className="text-sm font-medium capitalize">{post.platform}</span>
                        <Badge className={
                          post.status === 'posted' ? 'bg-green-100 text-green-700' :
                          post.status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }>{post.status}</Badge>
                      </div>
                      <span className="text-xs text-gray-400">
                        {post.posted_at ? new Date(post.posted_at).toLocaleDateString() : ''}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 leading-relaxed">{post.ad_content}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>📌 Trend: <strong className="text-gray-600">{post.trending_topic}</strong></span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Downline */}
          <TabsContent value="downline">
            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle className="text-base">My Referral Network</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {myReferrals.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No referrals yet</p>
                    <p className="text-xs mt-1">Share your referral link to start building your network</p>
                  </div>
                ) : myReferrals.map(ref => (
                  <div key={ref.id} className="p-4 border border-gray-100 rounded-xl">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white text-xs font-bold">
                          {ref.referred_user_id?.slice(-2)?.toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-800">Referred User</div>
                          <div className="text-xs text-gray-400">ID: {ref.referred_user_id?.slice(-8)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-center">
                          <div className="font-bold text-green-600">${(ref.ppc_bitlabs_earnings || 0).toFixed(2)}</div>
                          <div className="text-xs text-gray-400">PPC+BitLabs</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-purple-600">{ref.mlm_bonuses_paid || 0}</div>
                          <div className="text-xs text-gray-400">Bonuses Paid</div>
                        </div>
                        <Badge className={ref.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                          {ref.status}
                        </Badge>
                      </div>
                    </div>
                    {/* Milestone progress */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>Progress to next $8 milestone</span>
                        <span>${((ref.ppc_bitlabs_earnings || 0) % 8).toFixed(2)} / $8</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-green-400 to-emerald-500 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(100, ((ref.ppc_bitlabs_earnings || 0) % 8) / 8 * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
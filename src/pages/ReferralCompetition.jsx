import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Users, Trophy, TrendingUp, Mail, Share2, Heart, Zap, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function ReferralCompetition() {
  const [user, setUser] = useState(null);
  const [referralLink, setReferralLink] = useState('');
  const [emailShare, setEmailShare] = useState('');
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setReferralLink(`${window.location.origin}?ref=${u.id}`);
    }).catch(() => {});
  }, []);

  const { data: referrals = [] } = useQuery({
    queryKey: ['user-referrals', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_id: user.id }),
    enabled: !!user
  });

  const { data: convertedReferrals = [] } = useQuery({
    queryKey: ['converted-referrals', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_id: user.id, status: 'converted' }),
    enabled: !!user
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ['referral-leaderboard'],
    queryFn: async () => {
      const allReferrals = await base44.entities.Referral.list();
      const grouped = {};
      allReferrals.forEach(r => {
        if (!grouped[r.referrer_id]) grouped[r.referrer_id] = { count: 0, converted: 0 };
        grouped[r.referrer_id].count++;
        if (r.status === 'converted') grouped[r.referrer_id].converted++;
      });
      return Object.entries(grouped)
        .map(([id, data]) => ({ referrer_id: id, ...data }))
        .sort((a, b) => b.converted - a.converted)
        .slice(0, 10);
    }
  });

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const sendEmailShare = async () => {
    if (!emailShare) {
      toast.error('Enter an email address');
      return;
    }
    try {
      await base44.functions.invoke('sendReferralShareEmail', { 
        email: emailShare, 
        referrerName: user.full_name,
        referralLink 
      });
      toast.success('Invitation sent!');
      setEmailShare('');
    } catch (err) {
      toast.error('Failed to send email');
    }
  };

  if (!user) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" /></div>;

  const conversionRate = referrals.length > 0 ? Math.round((convertedReferrals.length / referrals.length) * 100) : 0;
  const userRank = leaderboard.findIndex(l => l.referrer_id === user.id) + 1 || 'N/A';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-black text-gray-900 mb-2 flex items-center gap-3">
            <Users className="w-10 h-10 text-purple-600" /> Referral Competition
          </h1>
          <p className="text-gray-600">Invite friends and earn real money for every conversion</p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 shadow-lg">
              <Users className="w-6 h-6 mb-2 opacity-80" />
              <p className="text-sm opacity-90">Total Invites</p>
              <p className="text-3xl font-black mt-1">{referrals.length}</p>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white p-6 shadow-lg">
              <Check className="w-6 h-6 mb-2 opacity-80" />
              <p className="text-sm opacity-90">Conversions</p>
              <p className="text-3xl font-black mt-1">{convertedReferrals.length}</p>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-gradient-to-br from-purple-500 to-pink-600 text-white p-6 shadow-lg">
              <TrendingUp className="w-6 h-6 mb-2 opacity-80" />
              <p className="text-sm opacity-90">Conversion Rate</p>
              <p className="text-3xl font-black mt-1">{conversionRate}%</p>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="bg-gradient-to-br from-yellow-500 to-orange-600 text-white p-6 shadow-lg">
              <Trophy className="w-6 h-6 mb-2 opacity-80" />
              <p className="text-sm opacity-90">Leaderboard Rank</p>
              <p className="text-3xl font-black mt-1">#{userRank}</p>
            </Card>
          </motion.div>
        </div>

        <Tabs defaultValue="invite" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="invite">
              <Share2 className="w-4 h-4 mr-2" /> Invite Friends
            </TabsTrigger>
            <TabsTrigger value="tracking">
              <TrendingUp className="w-4 h-4 mr-2" /> My Referrals
            </TabsTrigger>
            <TabsTrigger value="leaderboard">
              <Trophy className="w-4 h-4 mr-2" /> Leaderboard
            </TabsTrigger>
          </TabsList>

          {/* Invite Tab */}
          <TabsContent value="invite" className="space-y-6">
            <Card className="p-8 bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Share Your Referral Link</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Your Link</label>
                  <div className="flex gap-2">
                    <Input value={referralLink} readOnly className="bg-white" />
                    <Button onClick={copyToClipboard} className="bg-purple-600 hover:bg-purple-700 px-6">
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Share this link with friends to earn commission</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Or Send Direct Email Invites</label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Enter friend's email..." 
                      value={emailShare}
                      onChange={(e) => setEmailShare(e.target.value)}
                      type="email"
                    />
                    <Button onClick={sendEmailShare} className="bg-blue-600 hover:bg-blue-700 px-6">
                      <Mail className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-purple-200">
                  <p className="text-sm text-gray-700 font-semibold mb-2">💡 Share Tips</p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>✓ Share on social media to reach more people</li>
                    <li>✓ Send direct emails for personalized invites</li>
                    <li>✓ Earn 20% commission on friend's first 3 surveys</li>
                  </ul>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* My Referrals Tab */}
          <TabsContent value="tracking" className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Referrals</h2>
            {referrals.length === 0 ? (
              <Card className="p-12 text-center">
                <Users className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-400">No referrals yet. Start inviting friends!</p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {referrals.map((ref, idx) => (
                  <motion.div key={ref.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}>
                    <Card className={`p-4 ${ref.status === 'converted' ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{ref.referred_email}</p>
                          <p className="text-xs text-gray-500">Invited {new Date(ref.created_date).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={ref.status === 'converted' ? 'bg-green-600' : 'bg-gray-400'}>
                            {ref.status === 'converted' ? '✓ Converted' : 'Pending'}
                          </Badge>
                          {ref.status === 'converted' && (
                            <span className="text-sm font-bold text-green-600">+${(ref.commission_earned || 0).toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard" className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Top Referrers</h2>
            <div className="space-y-2">
              {leaderboard.map((entry, idx) => (
                <motion.div key={entry.referrer_id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}>
                  <Card className={`p-4 ${entry.referrer_id === user.id ? 'bg-purple-100 border-2 border-purple-500' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-black w-8 h-8 rounded-full flex items-center justify-center ${
                          idx === 0 ? 'bg-yellow-400 text-white' :
                          idx === 1 ? 'bg-gray-400 text-white' :
                          idx === 2 ? 'bg-orange-400 text-white' :
                          'bg-gray-200 text-gray-700'
                        }`}>
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-gray-900">User #{entry.referrer_id.slice(0, 8)}</p>
                          <p className="text-xs text-gray-500">{entry.converted} conversions</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-purple-600">{entry.count} invites</p>
                        <Badge className="bg-green-100 text-green-700 mt-1">{entry.converted} converted</Badge>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
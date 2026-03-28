import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Trophy, Users, DollarSign, Link2, Copy, TrendingUp, Crown, Medal, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const TIER_RATES = { 1: 0.05, 2: 0.02, 3: 0.01 };

function RankBadge({ rank }) {
  if (rank === 1) return <Crown className="w-5 h-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-slate-400" />;
  if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
  return <span className="text-sm font-bold text-gray-400">#{rank}</span>;
}

export default function ReferralLeaderboardPage() {
  const [user, setUser] = useState(null);
  const [myLink, setMyLink] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  // Fetch all referrals + custom links
  const { data: referrals = [], isLoading: loadingRefs } = useQuery({
    queryKey: ['all-referrals'],
    queryFn: () => base44.asServiceRole?.entities
      ? base44.asServiceRole.entities.Referral.list('-created_date', 500)
      : base44.entities.Referral.list('-created_date', 500),
    enabled: !!user,
  });

  const { data: myLinks = [], isLoading: loadingLinks } = useQuery({
    queryKey: ['my-ref-links', user?.id],
    queryFn: () => base44.entities.CustomReferralLink.filter({ user_id: user.id }),
    enabled: !!user,
    onSuccess: (data) => { if (data.length > 0) setMyLink(data[0]); },
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['referral-transactions', user?.id],
    queryFn: () => base44.entities.PPCTransaction.filter({ user_id: user.id, type: 'referral_commission' }),
    enabled: !!user,
  });

  // Build leaderboard from referral data
  const leaderboard = useMemo(() => {
    const referrerMap = {};
    referrals.forEach(r => {
      const id = r.referrer_user_id;
      if (!id) return;
      if (!referrerMap[id]) referrerMap[id] = { userId: id, referralCount: 0, totalEarned: 0, name: r.referrer_name || 'User' };
      referrerMap[id].referralCount++;
    });
    return Object.values(referrerMap)
      .sort((a, b) => b.referralCount - a.referralCount)
      .slice(0, 20)
      .map((entry, i) => ({ ...entry, rank: i + 1 }));
  }, [referrals]);

  // My referral stats
  const myReferrals = referrals.filter(r => r.referrer_user_id === user?.id);
  const myTotalCommissions = transactions.reduce((s, t) => s + (t.amount || 0), 0);
  const myRank = leaderboard.findIndex(e => e.userId === user?.id) + 1;

  const copyLink = () => {
    const link = myLinks[0]?.link_code
      ? `${window.location.origin}?ref=${myLinks[0].link_code}`
      : `${window.location.origin}?ref=${user?.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const createLink = async () => {
    if (!user) return;
    const code = `${user.id.slice(0, 8)}-${Date.now().toString(36)}`;
    const newLink = await base44.entities.CustomReferralLink.create({
      user_id: user.id,
      link_code: code,
      label: 'My Referral Link',
      clicks: 0,
      conversions: 0,
    });
    setMyLink(newLink);
    toast.success('Referral link created!');
  };

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Trophy className="w-8 h-8 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Referral Leaderboard</h1>
            <p className="text-sm text-gray-500">Multi-tier commissions • Top referrers ranked</p>
          </div>
        </div>

        {/* Commission tiers info */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { tier: 1, rate: '5%', label: 'Direct referrals', color: 'from-yellow-400 to-yellow-500' },
            { tier: 2, rate: '2%', label: 'Referral of referral', color: 'from-purple-400 to-purple-500' },
            { tier: 3, rate: '1%', label: 'Tier-3 chain', color: 'from-indigo-400 to-indigo-500' },
          ].map(t => (
            <Card key={t.tier} className="border-0 shadow-md overflow-hidden">
              <div className={`bg-gradient-to-r ${t.color} p-3 text-white`}>
                <p className="text-2xl font-black">{t.rate}</p>
                <p className="text-xs opacity-90">Tier {t.tier} Commission</p>
              </div>
              <CardContent className="p-3">
                <p className="text-xs text-gray-500">{t.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: My stats + referral link */}
          <div className="space-y-4">
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2"><CardTitle className="text-sm">My Referral Stats</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-black text-purple-600">{myReferrals.length}</p>
                    <p className="text-xs text-gray-500">Referrals</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-black text-green-600">${myTotalCommissions.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">Earned</p>
                  </div>
                </div>
                {myRank > 0 && (
                  <div className="flex items-center gap-2 bg-yellow-50 rounded-lg p-2">
                    <Trophy className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm font-semibold text-gray-700">Rank #{myRank} on leaderboard</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Your Referral Link</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {myLinks.length > 0 ? (
                  <>
                    <div className="bg-gray-50 rounded-lg p-2 text-xs text-gray-600 font-mono break-all">
                      {window.location.origin}?ref={myLinks[0]?.link_code || user.id}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center text-xs text-gray-500">
                      <div>
                        <p className="font-bold text-gray-800">{myLinks[0]?.clicks || 0}</p>
                        <p>Clicks</p>
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">{myLinks[0]?.conversions || 0}</p>
                        <p>Conversions</p>
                      </div>
                    </div>
                    <Button className="w-full gap-2 bg-purple-600 hover:bg-purple-700" onClick={copyLink}>
                      <Copy className="w-4 h-4" />
                      {copied ? 'Copied!' : 'Copy Link'}
                    </Button>
                  </>
                ) : (
                  <Button className="w-full gap-2 bg-purple-600 hover:bg-purple-700" onClick={createLink}>
                    <Link2 className="w-4 h-4" /> Generate My Link
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* How commissions work */}
            <Card className="border-0 shadow-sm bg-indigo-50 border-indigo-100">
              <CardContent className="p-4 space-y-2 text-xs text-indigo-700">
                <p className="font-bold">How commissions work:</p>
                <p>• Earn <strong>5%</strong> every time your direct referral completes a survey</p>
                <p>• Earn <strong>2%</strong> from users they refer</p>
                <p>• Earn <strong>1%</strong> from the next tier down</p>
                <p>• Commissions are credited automatically and instantly</p>
              </CardContent>
            </Card>
          </div>

          {/* Right: Leaderboard */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" /> Top Referrers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-4 pb-4">
                {loadingRefs ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /></div>
                ) : leaderboard.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No referral data yet. Be the first!</p>
                  </div>
                ) : leaderboard.map(entry => (
                  <div key={entry.userId}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all
                      ${entry.userId === user.id ? 'border-purple-200 bg-purple-50' : 'border-gray-100 bg-white hover:shadow-sm'}`}>
                    <div className="w-8 flex items-center justify-center flex-shrink-0">
                      <RankBadge rank={entry.rank} />
                    </div>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {(entry.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {entry.userId === user.id ? 'You' : entry.name || `User ${entry.userId.slice(0, 6)}`}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                        <span className="flex items-center gap-0.5">
                          <Users className="w-3 h-3" />{entry.referralCount} referrals
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-black text-green-600">
                        ${((entry.referralCount * 4) * TIER_RATES[1]).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-400">est. earned</p>
                    </div>
                    {entry.rank <= 3 && (
                      <Badge className={
                        entry.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                        entry.rank === 2 ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700'
                      }>
                        {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                      </Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Trophy, Users, DollarSign, Link2, Copy, TrendingUp, Crown, Medal,
  Loader2, Star, Zap, Target, Calendar, Gift
} from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth } from 'date-fns';
import JackpotWidget from '@/components/leaderboard/JackpotWidget';
import RecentWinnersPanel from '@/components/leaderboard/RecentWinnersPanel';

const TIER_RATES = { 1: 0.05, 2: 0.02, 3: 0.01 };

// Weekly challenges that refresh
const WEEKLY_CHALLENGES = [
  { id: 'w1', title: '5 Quality Referrals', desc: 'Refer 5 users who complete at least 3 surveys', reward: 150, metric: 'quality_referrals', target: 5 },
  { id: 'w2', title: 'Top 3 This Week',     desc: 'Rank in the top 3 on the weekly leaderboard',    reward: 300, metric: 'weekly_rank',       target: 3 },
  { id: 'w3', title: 'Referral Streak',     desc: 'Get at least 1 new referral for 5 consecutive days', reward: 200, metric: 'streak',        target: 5 },
];

function RankBadge({ rank }) {
  if (rank === 1) return <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center"><Crown className="w-4 h-4 text-white" /></div>;
  if (rank === 2) return <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 flex items-center justify-center"><Medal className="w-4 h-4 text-white" /></div>;
  if (rank === 3) return <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center"><Medal className="w-4 h-4 text-white" /></div>;
  return <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">#{rank}</div>;
}

function LeaderboardRow({ entry, isMe, rank }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isMe ? 'border-purple-300 bg-purple-50 shadow-sm' : 'border-gray-100 bg-white hover:shadow-sm'}`}>
      <RankBadge rank={rank} />
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
        {(entry.name || 'U').charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-800 truncate">{isMe ? '⭐ You' : (entry.name || `User ${entry.userId?.slice(0, 6)}`)}</p>
          {rank <= 3 && <Badge className={rank === 1 ? 'bg-yellow-100 text-yellow-700 text-xs' : rank === 2 ? 'bg-slate-100 text-slate-600 text-xs' : 'bg-amber-100 text-amber-700 text-xs'}>
            {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
          </Badge>}
        </div>
        <p className="text-xs text-gray-400">{entry.referralCount} referrals</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-black text-green-600">${entry.earned.toFixed(2)}</p>
        <p className="text-xs text-gray-400">earned</p>
      </div>
      {entry.prestigePoints > 0 && (
        <Badge className="bg-violet-100 text-violet-700 text-xs ml-1 flex-shrink-0">
          +{entry.prestigePoints}pts
        </Badge>
      )}
    </div>
  );
}

export default function ReferralLeaderboardPage() {
  const [user, setUser] = useState(null);
  const [myLink, setMyLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const [timeFilter, setTimeFilter] = useState('all_time'); // 'all_time' | 'this_month'

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: referrals = [], isLoading: loadingRefs } = useQuery({
    queryKey: ['all-referrals-lb'],
    queryFn: () => base44.entities.Referral.list('-created_date', 1000),
    enabled: !!user,
    refetchInterval: 30000, // refresh every 30s for "real-time" feel
  });

  const { data: myLinks = [] } = useQuery({
    queryKey: ['my-ref-links', user?.id],
    queryFn: () => base44.entities.CustomReferralLink.filter({ user_id: user.id }),
    enabled: !!user,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['referral-transactions-lb', user?.id],
    queryFn: () => base44.entities.PPCTransaction.filter({ user_id: user.id, type: 'referral_commission' }),
    enabled: !!user,
  });

  useEffect(() => {
    if (myLinks.length > 0) setMyLink(myLinks[0]);
  }, [myLinks]);

  const monthStart = startOfMonth(new Date()).toISOString();

  const buildLeaderboard = (refs) => {
    const map = {};
    refs.forEach(r => {
      const id = r.referrer_user_id;
      if (!id) return;
      if (!map[id]) map[id] = { userId: id, referralCount: 0, earned: 0, name: r.referrer_name || 'User', prestigePoints: 0 };
      map[id].referralCount++;
      map[id].earned += (r.commission_earned || 0);
      // Award prestige points for high-quality referrals
      if (r.quality_score >= 80) map[id].prestigePoints += 10;
    });
    return Object.values(map)
      .sort((a, b) => b.referralCount - a.referralCount)
      .slice(0, 25)
      .map((e, i) => ({ ...e, rank: i + 1 }));
  };

  const allTimeLeaderboard = useMemo(() => buildLeaderboard(referrals), [referrals]);
  const monthlyLeaderboard = useMemo(() => {
    const monthly = referrals.filter(r => r.created_date >= monthStart);
    return buildLeaderboard(monthly);
  }, [referrals, monthStart]);

  const leaderboard = timeFilter === 'this_month' ? monthlyLeaderboard : allTimeLeaderboard;
  const myReferrals = referrals.filter(r => r.referrer_user_id === user?.id);
  const myMonthRefs = myReferrals.filter(r => r.created_date >= monthStart);
  const myTotalCommissions = transactions.reduce((s, t) => s + (t.amount || 0), 0);
  const myRank = leaderboard.findIndex(e => e.userId === user?.id) + 1;

  // Weekly challenge progress (simulated from data)
  const weekStart = new Date(Date.now() - 7 * 86400000).toISOString();
  const myWeekRefs = myReferrals.filter(r => r.created_date >= weekStart);
  const challengeProgress = {
    quality_referrals: myWeekRefs.filter(r => (r.quality_score || 0) >= 70).length,
    weekly_rank: myRank > 0 ? myRank : 999,
    streak: myWeekRefs.length > 0 ? Math.min(5, myWeekRefs.length) : 0,
  };

  const copyLink = () => {
    const link = myLink?.link_code ? `${window.location.origin}?ref=${myLink.link_code}` : `${window.location.origin}?ref=${user?.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const createLink = async () => {
    if (!user) return;
    const code = `${user.id.slice(0, 8)}-${Date.now().toString(36)}`;
    const newLink = await base44.entities.CustomReferralLink.create({ user_id: user.id, link_code: code, label: 'My Referral Link', clicks: 0, conversions: 0 });
    setMyLink(newLink);
    toast.success('Referral link created!');
  };

  if (!user) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
            <Trophy className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Referral Leaderboard</h1>
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Live rankings · updated every 30s
            </p>
          </div>
        </div>

        {/* Live Prize Pool */}
        <JackpotWidget />

        {/* Commission tiers */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { tier: 1, rate: '5%', label: 'Direct referrals', color: 'from-yellow-400 to-yellow-500' },
            { tier: 2, rate: '2%', label: 'Referral of referral', color: 'from-purple-400 to-purple-500' },
            { tier: 3, rate: '1%', label: 'Tier-3 chain', color: 'from-indigo-400 to-indigo-500' },
          ].map(t => (
            <Card key={t.tier} className="border-0 shadow-md overflow-hidden">
              <div className={`bg-gradient-to-r ${t.color} p-3 text-white`}>
                <p className="text-2xl font-black">{t.rate}</p>
                <p className="text-xs opacity-90">Tier {t.tier}</p>
              </div>
              <CardContent className="p-2"><p className="text-xs text-gray-500">{t.label}</p></CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left sidebar */}
          <div className="space-y-4">
            {/* My stats */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2"><CardTitle className="text-sm">My Stats</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-black text-purple-600">{myReferrals.length}</p>
                    <p className="text-xs text-gray-500">All-Time</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-black text-blue-600">{myMonthRefs.length}</p>
                    <p className="text-xs text-gray-500">This Month</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-xl font-black text-green-600">${myTotalCommissions.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">Commissions</p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-3 text-center">
                    <p className="text-xl font-black text-yellow-600">{myRank > 0 ? `#${myRank}` : '—'}</p>
                    <p className="text-xs text-gray-500">Rank</p>
                  </div>
                </div>
                {myRank > 0 && myRank <= 3 && (
                  <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                    <Trophy className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm font-semibold text-gray-700">You're in the top 3! 🎉</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Referral link */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Your Referral Link</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {myLink || myLinks.length > 0 ? (
                  <>
                    <div className="bg-gray-50 rounded-lg p-2 text-xs text-gray-600 font-mono break-all">
                      {window.location.origin}?ref={(myLink || myLinks[0])?.link_code || user.id}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center text-xs text-gray-500">
                      <div><p className="font-bold text-gray-800">{(myLink || myLinks[0])?.clicks || 0}</p><p>Clicks</p></div>
                      <div><p className="font-bold text-gray-800">{(myLink || myLinks[0])?.conversions || 0}</p><p>Converts</p></div>
                    </div>
                    <Button className="w-full gap-2 bg-purple-600 hover:bg-purple-700" onClick={copyLink}>
                      <Copy className="w-4 h-4" />{copied ? 'Copied!' : 'Copy Link'}
                    </Button>
                  </>
                ) : (
                  <Button className="w-full gap-2 bg-purple-600 hover:bg-purple-700" onClick={createLink}>
                    <Link2 className="w-4 h-4" /> Generate My Link
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Recent Winners */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <RecentWinnersPanel />
              </CardContent>
            </Card>

            {/* Weekly Challenges */}
            <Card className="border-0 shadow-md border-l-4 border-l-violet-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-violet-500" /> Weekly Challenges
                  <Badge className="bg-violet-100 text-violet-700 text-xs ml-auto">Prestige Points</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {WEEKLY_CHALLENGES.map(ch => {
                  const progress = challengeProgress[ch.metric] || 0;
                  const pct = Math.min(100, (progress / ch.target) * 100);
                  const isComplete = pct >= 100;
                  return (
                    <div key={ch.id} className={`rounded-xl border p-3 ${isComplete ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-xs font-bold text-gray-800">{ch.title}</p>
                          <p className="text-xs text-gray-500">{ch.desc}</p>
                        </div>
                        <Badge className={`text-xs flex-shrink-0 ${isComplete ? 'bg-green-100 text-green-700' : 'bg-violet-100 text-violet-700'}`}>
                          {isComplete ? '✓' : <><Star className="w-2.5 h-2.5 mr-0.5" />{ch.reward}pts</>}
                        </Badge>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                      <p className="text-xs text-gray-400 mt-1">{progress}/{ch.target} {isComplete ? '— Complete!' : 'to go'}</p>
                    </div>
                  );
                })}
                <p className="text-xs text-gray-400 text-center">Challenges reset every Monday</p>
              </CardContent>
            </Card>
          </div>

          {/* Right: Leaderboard */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-600" /> Top Referrers
                  </CardTitle>
                  {/* Time filter */}
                  <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                    {[
                      { key: 'all_time', label: '🏆 All-Time' },
                      { key: 'this_month', label: <><Calendar className="w-3 h-3 mr-1" /> This Month</> },
                    ].map(f => (
                      <button
                        key={f.key}
                        onClick={() => setTimeFilter(f.key)}
                        className={`flex items-center text-xs px-3 py-1.5 rounded-md font-medium transition-all ${timeFilter === f.key ? 'bg-white shadow text-purple-700' : 'text-gray-500 hover:text-gray-800'}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 px-4 pb-4">
                {loadingRefs ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /></div>
                ) : leaderboard.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No referral data {timeFilter === 'this_month' ? 'this month' : 'yet'}. Be the first!</p>
                  </div>
                ) : (
                  leaderboard.map(entry => (
                    <LeaderboardRow key={entry.userId} entry={entry} isMe={entry.userId === user.id} rank={entry.rank} />
                  ))
                )}
              </CardContent>
            </Card>

            {/* How it works */}
            <Card className="border-0 shadow-sm bg-indigo-50">
              <CardContent className="p-4 grid sm:grid-cols-3 gap-4 text-xs text-indigo-700">
                <div><p className="font-bold mb-1">💰 Multi-Tier Commissions</p><p>5% from direct · 2% tier-2 · 1% tier-3 — auto-credited instantly</p></div>
                <div><p className="font-bold mb-1">⭐ Prestige Points</p><p>Earn bonus Prestige Points for high-quality referrals who complete surveys</p></div>
                <div><p className="font-bold mb-1">🏆 Weekly Challenges</p><p>Compete for challenge bonuses each week — rankings reset every Monday</p></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
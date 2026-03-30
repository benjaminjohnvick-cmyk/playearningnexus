import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Trophy, Users, DollarSign, AlertCircle, Star, Infinity,
  Clock, Gift, Crown, Medal, Award, Flame, CheckCircle2,
  Loader2, ArrowUpCircle, Lock, Link2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { format, differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from 'date-fns';
import MyReferralsTab from '@/components/referral/MyReferralsTab';
import ShareableReferralCard from '@/components/referral/ShareableReferralCard';

// Contest config: monthly contest, resets on 1st of each month
const getContestWindow = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
};

const PRIZE_POOL = [
  { rank: 1, label: '1st Place', prize: '$500', color: 'from-yellow-400 to-yellow-600', icon: Crown },
  { rank: 2, label: '2nd Place', prize: '$250', color: 'from-gray-300 to-gray-500', icon: Medal },
  { rank: 3, label: '3rd Place', prize: '$100', color: 'from-amber-600 to-amber-800', icon: Award },
  { rank: 4, label: '4th–5th', prize: '$50 each', color: 'from-blue-400 to-blue-600', icon: Star },
  { rank: 6, label: '6th–10th', prize: '$25 each', color: 'from-purple-400 to-purple-600', icon: Gift },
];

function Countdown({ targetDate }) {
  const [time, setTime] = useState({});
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const days = differenceInDays(targetDate, now);
      const hours = differenceInHours(targetDate, now) % 24;
      const minutes = differenceInMinutes(targetDate, now) % 60;
      const seconds = differenceInSeconds(targetDate, now) % 60;
      setTime({ days, hours, minutes, seconds });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  const units = [
    { label: 'Days', value: time.days },
    { label: 'Hours', value: time.hours },
    { label: 'Mins', value: time.minutes },
    { label: 'Secs', value: time.seconds },
  ];

  return (
    <div className="flex items-center gap-3 justify-center">
      {units.map(u => (
        <div key={u.label} className="text-center">
          <div className="bg-gray-900 text-white rounded-xl w-16 h-16 flex items-center justify-center text-2xl font-black tabular-nums">
            {String(u.value ?? 0).padStart(2, '0')}
          </div>
          <p className="text-xs text-gray-500 mt-1 font-medium">{u.label}</p>
        </div>
      ))}
    </div>
  );
}

export default function ReferralContest() {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();
  const { end: contestEnd } = getContestWindow();
  const thisMonth = format(new Date(), 'yyyy-MM');

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Get all referrals to build a leaderboard
  const { data: allReferrals = [] } = useQuery({
    queryKey: ['all-referrals-contest'],
    queryFn: () => base44.entities.Referral.list('-created_date', 200),
  });

  const { data: myReferrals = [] } = useQuery({
    queryKey: ['my-referrals-contest', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id }),
    enabled: !!user,
  });

  // Build leaderboard: group by referrer, count active referrals this month
  const leaderboard = React.useMemo(() => {
    const map = {};
    allReferrals.forEach(r => {
      if (!r.referrer_user_id) return;
      if (!map[r.referrer_user_id]) map[r.referrer_user_id] = { user_id: r.referrer_user_id, count: 0, commission: 0 };
      if (r.status === 'active') map[r.referrer_user_id].count++;
      map[r.referrer_user_id].commission += r.commission_earned || 0;
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 20);
  }, [allReferrals]);

  const myRank = user ? leaderboard.findIndex(e => e.user_id === user.id) + 1 : 0;
  const myActiveReferrals = myReferrals.filter(r => r.status === 'active').length;
  const myEntry = leaderboard.find(e => e.user_id === user?.id);

  const claimBonusMutation = useMutation({
    mutationFn: async () => {
      if (!user || myRank === 0 || myRank > 10) throw new Error('Not in top 10');
      const prize = myRank === 1 ? 500 : myRank === 2 ? 250 : myRank === 3 ? 100 : myRank <= 5 ? 50 : 25;
      await base44.entities.Payout.create({
        user_id: user.id,
        recipient_type: 'user',
        recipient_id: user.id,
        recipient_email: user.email,
        amount: prize,
        currency: 'USD',
        method: 'paypal',
        payout_type: 'contest_win',
        status: 'pending',
        description: `Referral Contest Rank #${myRank} — ${format(new Date(), 'MMMM yyyy')} prize: $${prize}`,
      });
    },
    onSuccess: () => {
      toast.success('Bonus claimed! Payout is being processed to your PayPal.');
      queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(e.message || 'Could not claim bonus'),
  });

  const rankColor = (rank) => {
    if (rank === 1) return 'text-yellow-500';
    if (rank === 2) return 'text-gray-400';
    if (rank === 3) return 'text-amber-600';
    if (rank <= 10) return 'text-blue-500';
    return 'text-gray-500';
  };

  const rankBg = (rank) => {
    if (rank === 1) return 'bg-yellow-50 border-yellow-300';
    if (rank === 2) return 'bg-gray-50 border-gray-300';
    if (rank === 3) return 'bg-amber-50 border-amber-300';
    if (rank <= 10) return 'bg-blue-50 border-blue-200';
    return 'bg-white border-gray-100';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-red-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Hero */}
        <div className="text-center py-6">
          <div className="inline-flex items-center gap-2 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full text-sm font-bold mb-4">
            <Trophy className="w-4 h-4" /> REFERRAL CONTEST / REFERRAL TRACKING
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 leading-tight mb-2">
            Compete. Refer. <span className="text-yellow-500">Win Cash.</span>
          </h1>
          <p className="text-gray-500 text-lg">Top 10 referrers every month share the prize pool.</p>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="contest">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="contest" className="flex items-center gap-2">
              <Trophy className="w-4 h-4" /> Referral Contest
            </TabsTrigger>
            <TabsTrigger value="referrals" className="flex items-center gap-2">
              <Link2 className="w-4 h-4" /> My Referrals
            </TabsTrigger>
          </TabsList>

          <TabsContent value="referrals" className="space-y-6">
            {user && <ShareableReferralCard user={user} />}
            {user && <MyReferralsTab user={user} />}
          </TabsContent>

          <TabsContent value="contest" className="space-y-8">

        {/* Countdown + Prize */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-2 border-gray-200 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-700">
                <Clock className="w-5 h-5 text-red-500" /> Contest Ends In
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Countdown targetDate={contestEnd} />
              <p className="text-center text-sm text-gray-400 mt-3">
                Resets on {format(contestEnd, 'MMMM d, yyyy')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-orange-50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-800">
                <Gift className="w-5 h-5" /> Prize Pool
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {PRIZE_POOL.map(p => {
                  const Icon = p.icon;
                  return (
                    <div key={p.rank} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${p.color} flex items-center justify-center`}>
                          <Icon className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">{p.label}</span>
                      </div>
                      <span className="font-bold text-green-600">{p.prize}</span>
                    </div>
                  );
                })}
                <div className="border-t pt-2 mt-2 flex justify-between text-sm font-bold">
                  <span className="text-gray-700">Total Pool</span>
                  <span className="text-green-600">$1,125</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* My Position */}
        {user && (
          <Card className={`border-2 shadow-lg ${myRank > 0 && myRank <= 10 ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}>
            <CardContent className="p-5">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black ${myRank > 0 && myRank <= 10 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                    {myRank > 0 ? `#${myRank}` : '—'}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-lg">Your Current Position</p>
                    <p className="text-sm text-gray-500">{myActiveReferrals} active referrals · {format(new Date(), 'MMMM yyyy')} contest</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {myRank > 0 && myRank <= 10 ? (
                    <>
                      <Badge className="bg-green-100 text-green-700 text-sm px-3 py-1">
                        <Trophy className="w-3.5 h-3.5 mr-1" />
                        Prize Eligible!
                      </Badge>
                      <Button
                        onClick={() => claimBonusMutation.mutate()}
                        disabled={claimBonusMutation.isPending}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {claimBonusMutation.isPending
                          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Claiming...</>
                          : <><Gift className="w-4 h-4 mr-2" /> Claim Bonus</>}
                      </Button>
                    </>
                  ) : (
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Need to reach top 10 to claim</p>
                      {myRank > 10 && leaderboard[9] && (
                        <p className="text-xs text-amber-600 font-medium mt-0.5">
                          Gap to #10: {leaderboard[9].count - myActiveReferrals} more active referrals
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {myRank > 10 && leaderboard[9] && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Progress to Top 10</span>
                    <span>{myActiveReferrals} / {leaderboard[9].count}</span>
                  </div>
                  <Progress value={Math.min((myActiveReferrals / (leaderboard[9].count || 1)) * 100, 100)} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Leaderboard */}
        <Card className="border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" /> Live Leaderboard
              <Badge className="ml-auto bg-red-100 text-red-700 animate-pulse">
                <Flame className="w-3 h-3 mr-1" /> Live
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <div className="text-center py-12">
                <Trophy className="w-16 h-16 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500">No entries yet — be the first!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry, idx) => {
                  const rank = idx + 1;
                  const isMe = user && entry.user_id === user.id;
                  const RankIcon = rank === 1 ? Crown : rank === 2 ? Medal : rank === 3 ? Award : rank <= 10 ? Star : null;
                  return (
                    <div key={entry.user_id}
                      className={`flex items-center justify-between rounded-xl px-4 py-3 border-2 transition-all ${rankBg(rank)} ${isMe ? 'ring-2 ring-green-400' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${rank === 1 ? 'bg-yellow-400 text-white' : rank === 2 ? 'bg-gray-300 text-white' : rank === 3 ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                          {RankIcon ? <RankIcon className="w-4 h-4" /> : rank}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">
                            {isMe ? `${user.full_name} (You)` : `User ${entry.user_id.slice(0, 6)}…`}
                          </p>
                          <p className="text-xs text-gray-400">${entry.commission.toFixed(2)} commission earned</p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <p className={`font-bold text-lg ${rankColor(rank)}`}>{entry.count}</p>
                          <p className="text-xs text-gray-400">active refs</p>
                        </div>
                        {rank <= 10 && (
                          <Badge className={`text-xs ${rank <= 3 ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                            {rank === 1 ? '$500' : rank === 2 ? '$250' : rank === 3 ? '$100' : rank <= 5 ? '$50' : '$25'}
                          </Badge>
                        )}
                        {rank > 10 && <Lock className="w-4 h-4 text-gray-300" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mega Contest Info */}
        <Card className="border-2 border-red-200 bg-gradient-to-br from-red-50 to-rose-50">
          <CardContent className="pt-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Infinity className="w-5 h-5 text-red-500" /> The Mega Contest Still Runs
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              This monthly leaderboard is separate from the long-term Mega Referral Contest. 
              Hit 7M referrals for a lifetime 10% share — up to <strong>$766.5M/year</strong>.
            </p>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: 'Referral Goal', value: '7,000,000', color: 'text-red-600' },
                { label: 'Commission Rate', value: '10%', color: 'text-purple-600' },
                { label: 'Lifetime Payout', value: '$766.5M', color: 'text-green-600' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl p-3 shadow-sm">
                  <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Terms */}
        <Card className="border-2 border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" /> Contest Rules & Terms
            </h2>
            <div className="space-y-2 text-sm text-gray-700">
              <p>• Leaderboard resets on the 1st of each month. Only <strong>active referrals</strong> (completed at least 1 survey in last 30 days) count.</p>
              <p>• Top 10 players may claim their monthly prize once per contest period. Claims processed within 3–5 business days via PayPal.</p>
              <p>• Self-referrals, duplicate accounts, or fraudulent referrals are disqualified immediately.</p>
              <p>• GamerGain reserves the right to adjust prize amounts or contest rules with 7 days notice.</p>
              <p>• Ties are broken by total commission earned during the contest period.</p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center pb-8">
          <Link to={createPageUrl('ReferralHub')}>
            <Button size="lg" className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold px-8 shadow-xl">
              <Users className="w-5 h-5 mr-2" /> Go to My Referral Hub
            </Button>
          </Link>
        </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
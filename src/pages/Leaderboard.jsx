import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, DollarSign, Users, TrendingUp, Medal, Crown, Star, Flame, Award, Zap } from "lucide-react";
import { format } from 'date-fns';
import InspireShareButton from '@/components/leaderboard/InspireShareButton';

// Hall of Fame milestones
const HOF_MILESTONES = [
  { id: 'hof_10',   label: 'First $10',     threshold: 10,   icon: '🌟', color: 'from-yellow-400 to-amber-500',  desc: 'Earned their first $10' },
  { id: 'hof_50',   label: 'Power Earner',  threshold: 50,   icon: '⚡', color: 'from-blue-400 to-blue-600',     desc: 'Lifetime earnings over $50' },
  { id: 'hof_100',  label: 'Century Club',  threshold: 100,  icon: '💯', color: 'from-purple-400 to-purple-600', desc: 'Reached $100 lifetime earnings' },
  { id: 'hof_500',  label: 'High Roller',   threshold: 500,  icon: '🏆', color: 'from-orange-400 to-red-500',    desc: 'Over $500 in lifetime earnings' },
  { id: 'hof_1000', label: 'Elite Earner',  threshold: 1000, icon: '👑', color: 'from-yellow-500 to-yellow-700', desc: 'Legendary $1,000+ earner' },
];

const getRankIcon = (i) => {
  if (i === 0) return <Crown className="w-6 h-6 text-yellow-500" />;
  if (i === 1) return <Medal className="w-6 h-6 text-gray-400" />;
  if (i === 2) return <Medal className="w-6 h-6 text-orange-500" />;
  return <span className="text-gray-500 font-bold text-sm">#{i + 1}</span>;
};

const getRankBg = (i) => {
  if (i === 0) return 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300';
  if (i === 1) return 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-300';
  if (i === 2) return 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-300';
  return 'bg-white border-gray-100';
};

function LeaderRow({ rankUser, index, currentUserId, valueLabel, value, valueColor }) {
  const isMe = rankUser.id === currentUserId;
  return (
    <div className={`flex items-center justify-between border-2 rounded-xl p-4 transition-all hover:shadow-md ${getRankBg(index)} ${isMe ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}>
      <div className="flex items-center gap-4">
        <div className="w-10 flex items-center justify-center flex-shrink-0">{getRankIcon(index)}</div>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {(rankUser.full_name || 'U').charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-bold text-gray-900 flex items-center gap-2">
            {rankUser.full_name || 'Anonymous'}
            {isMe && <Badge className="bg-blue-600 text-xs py-0">You</Badge>}
          </p>
          <p className="text-xs text-gray-400">
            {index < 3 ? ['🥇 Champion', '🥈 Runner-up', '🥉 Third Place'][index] : `Rank #${index + 1}`}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-xl font-black ${valueColor}`}>{value}</p>
        <p className="text-xs text-gray-400">{valueLabel}</p>
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const [user, setUser] = useState(null);
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: allUsers = [] } = useQuery({
    queryKey: ['leaderboard-users'],
    queryFn: () => base44.entities.User.list(),
    refetchInterval: 60000, // refresh every minute
  });

  const { data: allReferrals = [] } = useQuery({
    queryKey: ['all-referrals'],
    queryFn: () => base44.entities.Referral.list(),
  });

  const { data: todayEarnings = [] } = useQuery({
    queryKey: ['daily-earnings-today', today],
    queryFn: () => base44.entities.DailyEarnings.filter({ date: today }),
    refetchInterval: 30000,
  });

  // Top 10 daily earners (by today's earnings)
  const dailyTop10 = todayEarnings
    .map(e => ({ user: allUsers.find(u => u.id === e.user_id), earned: e.total_earned || 0, surveys: e.total_surveys_completed || 0 }))
    .filter(x => x.user && x.earned > 0)
    .sort((a, b) => b.earned - a.earned)
    .slice(0, 10);

  // All-time top earners
  const topEarners = [...allUsers].sort((a, b) => (b.total_earnings || 0) - (a.total_earnings || 0)).slice(0, 10);

  // Top referrers
  const referrerStats = allReferrals.reduce((acc, ref) => {
    if (!acc[ref.referrer_user_id]) acc[ref.referrer_user_id] = { count: 0, activeCount: 0, commission: 0 };
    acc[ref.referrer_user_id].count++;
    if (ref.status === 'active') acc[ref.referrer_user_id].activeCount++;
    acc[ref.referrer_user_id].commission += (ref.commission_earned || 0);
    return acc;
  }, {});

  const topReferrers = Object.entries(referrerStats)
    .map(([userId, stats]) => ({ user: allUsers.find(u => u.id === userId), ...stats }))
    .filter(x => x.user)
    .sort((a, b) => b.activeCount - a.activeCount)
    .slice(0, 10);

  // Hall of Fame: users who hit specific milestones
  const hofData = HOF_MILESTONES.map(milestone => ({
    ...milestone,
    members: [...allUsers]
      .filter(u => (u.total_earnings || 0) >= milestone.threshold)
      .sort((a, b) => (b.total_earnings || 0) - (a.total_earnings || 0)),
  }));

  // User's own ranks
  const myEarningsRank = topEarners.findIndex(u => u.id === user?.id) + 1;
  const myDailyRank = dailyTop10.findIndex(x => x.user?.id === user?.id) + 1;
  const myDailyEntry = dailyTop10.find(x => x.user?.id === user?.id);
  const myWeeklyEarned = (user?.total_earnings || 0); // proxy for weekly

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-orange-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
              <Trophy className="w-10 h-10 text-yellow-600" /> USA Leaderboard
            </h1>
            <p className="text-gray-500 mt-1">Top earners & referrers — refreshes daily</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Today</p>
            <p className="font-bold text-gray-700">{format(new Date(), 'MMM d, yyyy')}</p>
          </div>
        </div>

        {/* Your rank summary */}
        {(myEarningsRank > 0 || myDailyRank > 0) && (
          <Card className="border-2 border-blue-300 bg-blue-50">
            <CardContent className="p-4 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-blue-600" />
                <span className="font-bold text-blue-800">Your Rankings:</span>
              </div>
              {myEarningsRank > 0 && <Badge className="bg-green-100 text-green-700">All-Time #{myEarningsRank}</Badge>}
              {myDailyRank > 0 && <Badge className="bg-orange-100 text-orange-700">Today's Daily #{myDailyRank}</Badge>}
              <div className="ml-auto">
                <InspireShareButton
                  user={user}
                  rank={myDailyRank || myEarningsRank || 1}
                  dailyEarned={myDailyEntry?.earned || 0}
                  weeklyEarned={myWeeklyEarned}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="daily">
          <TabsList className="grid w-full grid-cols-4 bg-white shadow-md">
            <TabsTrigger value="daily" className="flex items-center gap-1"><Flame className="w-4 h-4" /><span className="hidden sm:inline">Daily</span> Top 10</TabsTrigger>
            <TabsTrigger value="earners" className="flex items-center gap-1"><DollarSign className="w-4 h-4" /><span className="hidden sm:inline">All-Time</span></TabsTrigger>
            <TabsTrigger value="referrers" className="flex items-center gap-1"><Users className="w-4 h-4" /><span className="hidden sm:inline">Referrers</span></TabsTrigger>
            <TabsTrigger value="hof" className="flex items-center gap-1"><Award className="w-4 h-4" /><span className="hidden sm:inline">Hall of Fame</span></TabsTrigger>
          </TabsList>

          {/* Daily Top 10 */}
          <TabsContent value="daily" className="space-y-3 mt-4">
            <Card className="border-2 border-orange-200 bg-orange-50 mb-2">
              <CardContent className="p-3 flex items-center gap-2 text-sm text-orange-800">
                <Flame className="w-4 h-4 text-orange-500 flex-shrink-0" />
                <span>Daily rankings reset at midnight. Today's survey earnings ranked in real-time.</span>
              </CardContent>
            </Card>
            {dailyTop10.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="py-12 text-center text-gray-400">
                  <Flame className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                  <p>No survey completions yet today. Be the first!</p>
                </CardContent>
              </Card>
            ) : (
              dailyTop10.map(({ user: u, earned, surveys }, i) => (
                <div key={u.id} className="relative">
                  <LeaderRow rankUser={u} index={i} currentUserId={user.id}
                    value={`$${earned.toFixed(2)}`} valueLabel={`${surveys} surveys today`} valueColor="text-orange-600" />
                  {u.id === user?.id && (
                    <div className="absolute top-3 right-3">
                      <InspireShareButton user={user} rank={i + 1} dailyEarned={earned} weeklyEarned={earned} />
                    </div>
                  )}
                </div>
              ))
            )}
          </TabsContent>

          {/* All-Time Earners */}
          <TabsContent value="earners" className="space-y-3 mt-4">
            {topEarners.map((u, i) => (
              <LeaderRow key={u.id} rankUser={u} index={i} currentUserId={user.id}
                value={`$${(u.total_earnings || 0).toFixed(2)}`} valueLabel="All-time earned" valueColor="text-green-600" />
            ))}
          </TabsContent>

          {/* Top Referrers */}
          <TabsContent value="referrers" className="space-y-3 mt-4">
            {topReferrers.map(({ user: u, activeCount, count, commission }, i) => (
              <LeaderRow key={u.id} rankUser={u} index={i} currentUserId={user.id}
                value={activeCount.toString()} valueLabel={`${count} total · $${commission.toFixed(2)} commission`} valueColor="text-purple-600" />
            ))}
            {topReferrers.length === 0 && (
              <Card className="border-0 shadow-md">
                <CardContent className="py-12 text-center text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                  <p>No referral data yet. Share your link to climb the board!</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Hall of Fame */}
          <TabsContent value="hof" className="space-y-6 mt-4">
            <div className="text-center mb-2">
              <h2 className="text-2xl font-black text-gray-900">🏛️ Hall of Fame</h2>
              <p className="text-gray-500 text-sm">Users who achieved legendary lifetime earning milestones</p>
            </div>
            {hofData.map(milestone => (
              <Card key={milestone.id} className="border-0 shadow-xl overflow-hidden">
                <div className={`bg-gradient-to-r ${milestone.color} p-5`}>
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{milestone.icon}</span>
                    <div>
                      <h3 className="text-xl font-black text-white">{milestone.label}</h3>
                      <p className="text-white/80 text-sm">{milestone.desc} · ${milestone.threshold}+ lifetime</p>
                    </div>
                    <Badge className="ml-auto bg-white/20 text-white border-white/30">{milestone.members.length} members</Badge>
                  </div>
                </div>
                <CardContent className="p-4">
                  {milestone.members.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-4">No members yet — be the first to reach ${milestone.threshold}!</p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {milestone.members.slice(0, 12).map((u, i) => (
                        <div key={u.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {(u.full_name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{u.full_name || 'Anonymous'}</p>
                            <p className="text-xs text-green-600 font-bold">${(u.total_earnings || 0).toFixed(0)}</p>
                          </div>
                          {i === 0 && <Zap className="w-4 h-4 text-yellow-500 flex-shrink-0" />}
                        </div>
                      ))}
                      {milestone.members.length > 12 && (
                        <div className="flex items-center px-3 py-2 text-sm text-gray-400">+{milestone.members.length - 12} more</div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
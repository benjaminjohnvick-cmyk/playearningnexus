import { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Crown, Medal, Star, Flame, Trophy, DollarSign, Award, Zap, TrendingUp } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { motion } from 'framer-motion';

const TOP10_BADGES = [
  { rank: 1, badge: '👑', label: 'Champion', color: 'from-yellow-400 to-amber-500', border: 'border-yellow-300' },
  { rank: 2, badge: '🥈', label: 'Runner-Up', color: 'from-slate-300 to-gray-400', border: 'border-slate-300' },
  { rank: 3, badge: '🥉', label: 'Third Place', color: 'from-amber-500 to-orange-500', border: 'border-amber-400' },
  { rank: 4, badge: '💎', label: 'Elite', color: 'from-blue-400 to-indigo-500', border: 'border-blue-300' },
  { rank: 5, badge: '⚡', label: 'High Voltage', color: 'from-violet-400 to-purple-500', border: 'border-violet-300' },
  { rank: 6, badge: '🔥', label: 'Blazer', color: 'from-orange-400 to-red-500', border: 'border-orange-300' },
  { rank: 7, badge: '🚀', label: 'Rocket', color: 'from-cyan-400 to-blue-500', border: 'border-cyan-300' },
  { rank: 8, badge: '🌟', label: 'Star', color: 'from-pink-400 to-rose-500', border: 'border-pink-300' },
  { rank: 9, badge: '💪', label: 'Grinder', color: 'from-teal-400 to-emerald-500', border: 'border-teal-300' },
  { rank: 10, badge: '🎯', label: 'Sharpshooter', color: 'from-green-400 to-emerald-500', border: 'border-green-300' },
];

function getRankInfo(index) {
  return TOP10_BADGES[index] || null;
}

function getRankIcon(i) {
  if (i === 0) return <Crown className="w-5 h-5 text-yellow-500" />;
  if (i === 1) return <Medal className="w-5 h-5 text-slate-400" />;
  if (i === 2) return <Medal className="w-5 h-5 text-amber-500" />;
  return <span className="text-gray-400 font-bold text-sm">#{i + 1}</span>;
}

function LeaderRow({ entry, index, currentUserId, valueLabel, valueKey }) {
  const isMe = entry.user_id === currentUserId;
  const rankInfo = getRankInfo(index);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`flex items-center gap-3 border-2 rounded-xl px-4 py-3 transition-all
        ${index === 0 ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200' :
          index === 1 ? 'bg-gradient-to-r from-slate-50 to-gray-50 border-slate-200' :
          index === 2 ? 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200' :
          'bg-white border-gray-100'}
        ${isMe ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}
        hover:shadow-md`}
    >
      <div className="w-8 flex items-center justify-center flex-shrink-0">{getRankIcon(index)}</div>

      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
        {(entry.name || 'U').charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-gray-900 truncate">{entry.name || 'Anonymous'}</span>
          {isMe && <Badge className="bg-indigo-600 text-xs py-0">You</Badge>}
          {rankInfo && index < 10 && (
            <span className={`text-xs px-2 py-0.5 rounded-full bg-gradient-to-r ${rankInfo.color} text-white font-bold`}>
              {rankInfo.badge} {rankInfo.label}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400">{entry.surveys || 0} surveys</p>
      </div>

      <div className="text-right flex-shrink-0">
        <p className="text-lg font-black text-green-600">{valueLabel(entry)}</p>
      </div>
    </motion.div>
  );
}

function MiniPodium({ top3, currentUserId }) {
  const order = [1, 0, 2]; // silver, gold, bronze
  const heights = ['h-20', 'h-28', 'h-16'];
  const colors = ['from-slate-300 to-gray-400', 'from-yellow-400 to-amber-500', 'from-amber-500 to-orange-500'];

  return (
    <div className="flex items-end justify-center gap-2 mb-6 pt-4">
      {order.map((i, pos) => {
        const entry = top3[i];
        if (!entry) return <div key={pos} className="w-24" />;
        return (
          <motion.div key={i} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: pos * 0.15 }}
            className="flex flex-col items-center gap-1">
            <div className="text-2xl">{TOP10_BADGES[i]?.badge}</div>
            <div className="text-center">
              <p className="text-xs font-bold text-gray-800 truncate max-w-[80px]">{entry.name}</p>
              <p className="text-xs text-green-600 font-bold">${(entry.earned || 0).toFixed(2)}</p>
            </div>
            <div className={`w-20 ${heights[pos]} bg-gradient-to-t ${colors[pos]} rounded-t-xl flex items-center justify-center text-white font-black text-xl`}>
              {i + 1}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default function GlobalLeaderboard() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('daily');

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const today = format(new Date(), 'yyyy-MM-dd');
  const weekCutoff = format(subDays(new Date(), 7), 'yyyy-MM-dd');

  const { data: allUsers = [] } = useQuery({
    queryKey: ['glb-users'],
    queryFn: () => base44.entities.User.list(),
    staleTime: 2 * 60 * 1000,
  });

  const { data: todayEarnings = [] } = useQuery({
    queryKey: ['glb-today', today],
    queryFn: () => base44.entities.DailyEarnings.filter({ date: today }),
    refetchInterval: 30000,
  });

  const { data: weeklyEarnings = [] } = useQuery({
    queryKey: ['glb-weekly', weekCutoff],
    queryFn: () => base44.entities.DailyEarnings.filter({}),
    select: data => data.filter(e => e.date >= weekCutoff),
    staleTime: 2 * 60 * 1000,
  });

  const userMap = useMemo(() => Object.fromEntries(allUsers.map(u => [u.id, u])), [allUsers]);

  const dailyRanked = useMemo(() => {
    return todayEarnings
      .map(e => ({ user_id: e.user_id, name: userMap[e.user_id]?.full_name || 'Anonymous', earned: e.total_earned || 0, surveys: e.total_surveys_completed || 0 }))
      .sort((a, b) => b.earned - a.earned)
      .slice(0, 50);
  }, [todayEarnings, userMap]);

  const weeklyRanked = useMemo(() => {
    const acc = {};
    weeklyEarnings.forEach(e => {
      if (!acc[e.user_id]) acc[e.user_id] = { user_id: e.user_id, earned: 0, surveys: 0 };
      acc[e.user_id].earned += e.total_earned || 0;
      acc[e.user_id].surveys += e.total_surveys_completed || 0;
    });
    return Object.values(acc)
      .map(e => ({ ...e, name: userMap[e.user_id]?.full_name || 'Anonymous' }))
      .sort((a, b) => b.earned - a.earned)
      .slice(0, 50);
  }, [weeklyEarnings, userMap]);

  const allTimeRanked = useMemo(() =>
    allUsers
      .map(u => ({ user_id: u.id, name: u.full_name || 'Anonymous', earned: u.total_earnings || 0, surveys: 0 }))
      .sort((a, b) => b.earned - a.earned)
      .slice(0, 50),
    [allUsers]
  );

  const ranked = tab === 'daily' ? dailyRanked : tab === 'weekly' ? weeklyRanked : allTimeRanked;
  const myRank = ranked.findIndex(e => e.user_id === user?.id);
  const top3 = ranked.slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center py-4">
          <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-3 shadow-xl">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-gray-900">Global Leaderboard</h1>
          <p className="text-gray-500 mt-1">Compete with the community — top 10 earn exclusive badges</p>
        </div>

        {/* Your rank card */}
        {user && myRank >= 0 && (
          <Card className="border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50">
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center text-white font-bold">
                  {(user.full_name || 'U').charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-gray-900">Your Rank</p>
                  <p className="text-xs text-gray-500">{user.full_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="bg-indigo-100 text-indigo-700 text-sm px-3 py-1">#{myRank + 1}</Badge>
                {myRank < 10 && <Badge className={`text-white bg-gradient-to-r ${TOP10_BADGES[myRank]?.color} text-xs`}>{TOP10_BADGES[myRank]?.badge} {TOP10_BADGES[myRank]?.label}</Badge>}
                <p className="font-black text-green-600 text-xl">${(ranked[myRank]?.earned || 0).toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Podium */}
        {top3.length >= 3 && <MiniPodium top3={top3} currentUserId={user?.id} />}

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3 bg-white shadow">
            <TabsTrigger value="daily"><Flame className="w-3.5 h-3.5 mr-1" /> Today</TabsTrigger>
            <TabsTrigger value="weekly"><Zap className="w-3.5 h-3.5 mr-1" /> This Week</TabsTrigger>
            <TabsTrigger value="alltime"><Trophy className="w-3.5 h-3.5 mr-1" /> All Time</TabsTrigger>
          </TabsList>

          {['daily', 'weekly', 'alltime'].map(t => (
            <TabsContent key={t} value={t} className="space-y-2 mt-3">
              {ranked.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No data yet for this period</p>
                </div>
              ) : (
                ranked.map((entry, i) => (
                  <LeaderRow
                    key={entry.user_id || i}
                    entry={entry}
                    index={i}
                    currentUserId={user?.id}
                    valueLabel={e => `$${(e.earned || 0).toFixed(2)}`}
                    valueKey="earned"
                  />
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Top 10 badge legend */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600 uppercase tracking-wide">Top 10 Exclusive Badges</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {TOP10_BADGES.map(b => (
              <div key={b.rank} className={`flex items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r ${b.color} text-white text-xs font-bold`}>
                {b.badge} #{b.rank} {b.label}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
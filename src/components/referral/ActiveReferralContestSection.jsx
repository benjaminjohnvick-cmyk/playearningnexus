import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Trophy, Crown, Medal, Award, Star, Gift,
  Clock, Flame, Users, ArrowRight, Lock, Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from 'date-fns';

const PRIZE_POOL = [
  { rank: 1, prize: '$500', color: 'from-yellow-400 to-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-300', textColor: 'text-yellow-700', Icon: Crown },
  { rank: 2, prize: '$250', color: 'from-gray-300 to-gray-500', bg: 'bg-gray-50', border: 'border-gray-300', textColor: 'text-gray-600', Icon: Medal },
  { rank: 3, prize: '$100', color: 'from-amber-500 to-amber-700', bg: 'bg-amber-50', border: 'border-amber-300', textColor: 'text-amber-700', Icon: Award },
];

function getContestEnd() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

function CountdownTimer({ targetDate }) {
  const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime({
        days: differenceInDays(targetDate, now),
        hours: differenceInHours(targetDate, now) % 24,
        minutes: differenceInMinutes(targetDate, now) % 60,
        seconds: differenceInSeconds(targetDate, now) % 60,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  const isUrgent = time.days < 3;

  return (
    <div className={`flex items-center gap-2 justify-center ${isUrgent ? 'animate-pulse' : ''}`}>
      {[
        { label: 'D', value: time.days },
        { label: 'H', value: time.hours },
        { label: 'M', value: time.minutes },
        { label: 'S', value: time.seconds },
      ].map((u, i) => (
        <div key={u.label} className="flex items-center gap-2">
          {i > 0 && <span className="text-white/60 font-bold text-lg mb-3">:</span>}
          <div className="text-center">
            <div className={`rounded-lg w-12 h-12 flex items-center justify-center text-xl font-black tabular-nums ${isUrgent ? 'bg-red-500 text-white' : 'bg-white/20 text-white'}`}>
              {String(u.value ?? 0).padStart(2, '0')}
            </div>
            <p className="text-xs text-white/70 mt-1 font-medium">{u.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function LeaderRow({ entry, rank, isMe, userName }) {
  const rankBg = rank === 1 ? 'bg-yellow-50 border-yellow-200' : rank === 2 ? 'bg-gray-50 border-gray-200' : rank === 3 ? 'bg-amber-50 border-amber-200' : rank <= 10 ? 'bg-blue-50/50 border-blue-100' : 'bg-white border-gray-100';
  const prizeLabel = rank === 1 ? '$500' : rank === 2 ? '$250' : rank === 3 ? '$100' : rank <= 5 ? '$50' : rank <= 10 ? '$25' : null;
  const RankIcon = rank === 1 ? Crown : rank === 2 ? Medal : rank === 3 ? Award : null;

  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${rankBg} ${isMe ? 'ring-2 ring-green-400 ring-offset-1' : ''} transition-all`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs flex-shrink-0 ${rank === 1 ? 'bg-yellow-400 text-white' : rank === 2 ? 'bg-gray-300 text-gray-700' : rank === 3 ? 'bg-amber-500 text-white' : rank <= 10 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
        {RankIcon ? <RankIcon className="w-4 h-4" /> : rank}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 text-sm truncate">
          {isMe ? <span className="text-green-700">{userName} <Badge className="text-xs bg-green-100 text-green-700 border-0 py-0">You</Badge></span> : `Referrer #${entry.user_id.slice(-4).toUpperCase()}`}
        </p>
        <p className="text-xs text-gray-400">${entry.commission.toFixed(2)} earned</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="text-right">
          <p className="font-black text-base text-gray-800">{entry.count}</p>
          <p className="text-xs text-gray-400">refs</p>
        </div>
        {prizeLabel ? (
          <Badge className={`text-xs font-bold ${rank <= 3 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
            {prizeLabel}
          </Badge>
        ) : (
          <Lock className="w-3.5 h-3.5 text-gray-200" />
        )}
      </div>
    </div>
  );
}

export default function ActiveReferralContestSection({ user }) {
  const contestEnd = getContestEnd();

  const { data: allReferrals = [], dataUpdatedAt } = useQuery({
    queryKey: ['contest-referrals-home'],
    queryFn: () => base44.entities.Referral.list('-created_date', 300),
    refetchInterval: 30000, // refresh every 30s for real-time feel
  });

  const leaderboard = useMemo(() => {
    const map = {};
    allReferrals.forEach(r => {
      if (!r.referrer_user_id) return;
      if (!map[r.referrer_user_id]) map[r.referrer_user_id] = { user_id: r.referrer_user_id, count: 0, commission: 0 };
      if (r.status === 'active') map[r.referrer_user_id].count++;
      map[r.referrer_user_id].commission += r.commission_earned || 0;
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [allReferrals]);

  const myRank = user ? leaderboard.findIndex(e => e.user_id === user.id) + 1 : 0;
  const myEntry = leaderboard.find(e => e.user_id === user?.id);
  const myCount = myEntry?.count || 0;
  const top10Threshold = leaderboard[9]?.count || 1;

  const lastUpdated = dataUpdatedAt ? format(new Date(dataUpdatedAt), 'h:mm:ss a') : null;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-black text-gray-900">🏆 Active Referral Contest</h2>
            <Badge className="bg-red-100 text-red-700 border-red-200 animate-pulse text-xs font-bold">
              <Flame className="w-3 h-3 mr-1" /> LIVE
            </Badge>
          </div>
          <p className="text-sm text-gray-500">Top 10 referrers split the prize pool · Resets {format(contestEnd, 'MMM d')}</p>
        </div>
        <Link to={createPageUrl('ReferralContest')}>
          <Button size="sm" className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold gap-1.5 shadow-md">
            Join Contest <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">

        {/* Left: Countdown + Prize Pool */}
        <div className="space-y-4">
          {/* Countdown */}
          <div className="rounded-2xl bg-gradient-to-br from-purple-600 to-red-500 p-5 text-center shadow-xl">
            <div className="flex items-center justify-center gap-1.5 text-white/80 text-xs font-bold uppercase tracking-wide mb-3">
              <Clock className="w-3.5 h-3.5" /> Contest Ends In
            </div>
            <CountdownTimer targetDate={contestEnd} />
            <p className="text-white/60 text-xs mt-3">
              Ends {format(contestEnd, 'MMMM d, yyyy')} at midnight
            </p>
          </div>

          {/* Prize Pool */}
          <Card className="border-2 border-yellow-200 shadow-lg">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2 text-yellow-800">
                <Gift className="w-4 h-4" /> Prize Pool — $1,125 Total
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {PRIZE_POOL.map(p => (
                <div key={p.rank} className={`flex items-center justify-between rounded-lg px-3 py-2 border ${p.bg} ${p.border}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${p.color} flex items-center justify-center`}>
                      <p.Icon className="w-3 h-3 text-white" />
                    </div>
                    <span className={`text-xs font-semibold ${p.textColor}`}>#{p.rank} Place</span>
                  </div>
                  <span className="text-sm font-black text-green-600">{p.prize}</span>
                </div>
              ))}
              {[
                { label: '#4–5 Place', prize: '$50 each' },
                { label: '#6–10 Place', prize: '$25 each' },
              ].map(p => (
                <div key={p.label} className="flex items-center justify-between rounded-lg px-3 py-2 border border-blue-100 bg-blue-50">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                      <Star className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-blue-700">{p.label}</span>
                  </div>
                  <span className="text-sm font-black text-green-600">{p.prize}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right: Live Leaderboard */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-xl h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="w-4 h-4 text-yellow-500" /> Live Leaderboard
                </CardTitle>
                <div className="flex items-center gap-2">
                  {lastUpdated && (
                    <span className="text-xs text-gray-400">Updated {lastUpdated}</span>
                  )}
                  <Badge className="text-xs bg-green-100 text-green-700 border-0">
                    <Zap className="w-3 h-3 mr-1" /> Refreshes every 30s
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {leaderboard.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy className="w-14 h-14 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No entries yet — be first to climb the board!</p>
                  <Link to={createPageUrl('ReferralHub')}>
                    <Button size="sm" className="mt-3 bg-yellow-500 hover:bg-yellow-600 text-white">
                      <Users className="w-4 h-4 mr-1" /> Start Referring
                    </Button>
                  </Link>
                </div>
              ) : (
                leaderboard.map((entry, idx) => (
                  <LeaderRow
                    key={entry.user_id}
                    entry={entry}
                    rank={idx + 1}
                    isMe={user && entry.user_id === user.id}
                    userName={user?.full_name}
                  />
                ))
              )}

              {/* My position if not in top 10 */}
              {user && myRank === 0 && leaderboard.length > 0 && (
                <div className="mt-3 pt-3 border-t border-dashed border-gray-200">
                  <div className="rounded-xl px-3 py-2.5 border-2 border-dashed border-green-300 bg-green-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center text-green-700 font-black text-xs">?</div>
                        <div>
                          <p className="font-semibold text-green-700 text-sm">{user.full_name} <Badge className="text-xs bg-green-100 text-green-700 border-0 py-0">You</Badge></p>
                          <p className="text-xs text-gray-400">Not yet on the board</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-amber-600 font-semibold">Need {top10Threshold - myCount} more refs</p>
                        <p className="text-xs text-gray-400">to enter top 10</p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <Progress value={Math.min((myCount / top10Threshold) * 100, 100)} className="h-1.5" />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
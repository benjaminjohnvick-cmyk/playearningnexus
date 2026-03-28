import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Crown, Medal, Star, Flame, Trophy, DollarSign, Users, Award, Zap } from 'lucide-react';
import { ACHIEVEMENT_DEFINITIONS } from '@/components/achievements/AchievementBadgeSystem';
import { format, subDays } from 'date-fns';

const TIER_BADGES = [
  { name: 'Diamond', min: 10, color: 'text-purple-700 bg-purple-100 border-purple-300', icon: '💎' },
  { name: 'Gold',    min: 6,  color: 'text-yellow-700 bg-yellow-100 border-yellow-300', icon: '🥇' },
  { name: 'Silver',  min: 3,  color: 'text-slate-700 bg-slate-100 border-slate-300',   icon: '🥈' },
  { name: 'Bronze',  min: 1,  color: 'text-amber-700 bg-amber-100 border-amber-300',   icon: '🥉' },
  { name: 'Starter', min: 0,  color: 'text-gray-600 bg-gray-100 border-gray-300',      icon: '⭐' },
];

function getTierBadge(badgeCount) {
  return TIER_BADGES.find(t => badgeCount >= t.min) || TIER_BADGES[TIER_BADGES.length - 1];
}

function getRankIcon(i) {
  if (i === 0) return <Crown className="w-5 h-5 text-yellow-500" />;
  if (i === 1) return <Medal className="w-5 h-5 text-slate-400" />;
  if (i === 2) return <Medal className="w-5 h-5 text-amber-500" />;
  return <span className="text-gray-400 font-bold text-sm w-5 text-center">#{i + 1}</span>;
}

function LeaderRow({ entry, index, currentUserId, metric }) {
  const isMe = entry.user?.id === currentUserId;
  const tier = getTierBadge(entry.badgeCount || 0);

  return (
    <div className={`flex items-center gap-3 border-2 rounded-xl px-4 py-3 transition-all hover:shadow-md
      ${index === 0 ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200' :
        index === 1 ? 'bg-gradient-to-r from-slate-50 to-gray-50 border-slate-200' :
        index === 2 ? 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200' :
        'bg-white border-gray-100'}
      ${isMe ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}`}
    >
      <div className="w-8 flex items-center justify-center flex-shrink-0">{getRankIcon(index)}</div>
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
        {(entry.user?.full_name || 'U').charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-gray-900 truncate">
            {entry.user?.full_name || 'Anonymous'}
          </span>
          {isMe && <Badge className="bg-indigo-600 text-xs py-0">You</Badge>}
          <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${tier.color}`}>
            {tier.icon} {tier.name}
          </span>
        </div>
        <p className="text-xs text-gray-400">
          {entry.surveysCompleted || 0} surveys · {entry.badgeCount || 0} badges
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-lg font-black ${metric === 'earnings' ? 'text-green-600' : 'text-blue-600'}`}>
          {metric === 'earnings' ? `$${(entry.earnings || 0).toFixed(2)}` : (entry.surveysCompleted || 0)}
        </p>
        <p className="text-xs text-gray-400">{metric === 'earnings' ? 'earned' : 'completed'}</p>
      </div>
    </div>
  );
}

export default function GlobalLeaderboardPanel({ currentUserId }) {
  const [metric, setMetric] = React.useState('earnings');

  const { data: allUsers = [] } = useQuery({
    queryKey: ['lb-users'],
    queryFn: () => base44.entities.User.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: allResponses = [] } = useQuery({
    queryKey: ['lb-responses'],
    queryFn: () => base44.entities.PPCSurveyResponse.filter({ completed: true }, '-created_date', 500),
    staleTime: 5 * 60 * 1000,
  });

  const { data: userAchievements = [] } = useQuery({
    queryKey: ['lb-achievements'],
    queryFn: () => base44.entities.UserAchievement.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: weeklyEarnings = [] } = useQuery({
    queryKey: ['lb-weekly'],
    queryFn: () => base44.entities.DailyEarnings.filter({}),
    select: data => {
      const cutoff = format(subDays(new Date(), 7), 'yyyy-MM-dd');
      return data.filter(e => e.date >= cutoff);
    },
    staleTime: 5 * 60 * 1000,
  });

  // Build enriched user list
  const enriched = useMemo(() => {
    const surveyCountByUser = allResponses.reduce((acc, r) => {
      acc[r.user_id] = (acc[r.user_id] || 0) + 1;
      return acc;
    }, {});

    const badgeCountByUser = userAchievements.reduce((acc, a) => {
      acc[a.user_id] = (acc[a.user_id] || 0) + 1;
      return acc;
    }, {});

    return allUsers.map(u => ({
      user: u,
      earnings: u.total_earnings || 0,
      surveysCompleted: surveyCountByUser[u.id] || 0,
      badgeCount: badgeCountByUser[u.id] || 0,
    }));
  }, [allUsers, allResponses, userAchievements]);

  // Weekly top performers
  const weeklyByUser = useMemo(() => {
    const acc = {};
    weeklyEarnings.forEach(e => {
      if (!acc[e.user_id]) acc[e.user_id] = { earned: 0, surveys: 0 };
      acc[e.user_id].earned += (e.total_earned || 0);
      acc[e.user_id].surveys += (e.total_surveys_completed || 0);
    });
    return Object.entries(acc)
      .map(([uid, stats]) => ({ user: allUsers.find(u => u.id === uid), ...stats }))
      .filter(x => x.user)
      .sort((a, b) => b.earned - a.earned)
      .slice(0, 5);
  }, [weeklyEarnings, allUsers]);

  const sorted = useMemo(() =>
    [...enriched]
      .sort((a, b) => metric === 'earnings' ? b.earnings - a.earnings : b.surveysCompleted - a.surveysCompleted)
      .slice(0, 100),
    [enriched, metric]
  );

  const top100Earnings = [...enriched].sort((a, b) => b.earnings - a.earnings).slice(0, 100);
  const myRankEarnings = top100Earnings.findIndex(e => e.user?.id === currentUserId) + 1;
  const myEntry = enriched.find(e => e.user?.id === currentUserId);
  const myPercentile = enriched.length > 0
    ? ((enriched.filter(e => e.earnings <= (myEntry?.earnings || 0)).length / enriched.length) * 100).toFixed(0)
    : 0;

  return (
    <div className="space-y-6">
      {/* Your position card */}
      {myEntry && (
        <Card className="border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-indigo-600" />
                <span className="font-bold text-indigo-800">Your Position</span>
              </div>
              <Badge className="bg-green-100 text-green-700">All-Time Rank #{myRankEarnings || '100+'}</Badge>
              <Badge className="bg-purple-100 text-purple-700">Top {100 - parseInt(myPercentile) || '<1'}%</Badge>
              <Badge className="bg-amber-100 text-amber-700">{myEntry.badgeCount} badges earned</Badge>
              <div className="ml-auto text-right">
                <p className="text-sm text-gray-500">Your earnings</p>
                <p className="text-xl font-black text-green-600">${myEntry.earnings.toFixed(2)}</p>
              </div>
            </div>
            {myRankEarnings > 0 && myRankEarnings <= 10 && (
              <div className="mt-3">
                <p className="text-xs text-indigo-700 mb-1">Progress to #{myRankEarnings - 1}</p>
                <Progress value={70} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Weekly Top Performers */}
      {weeklyByUser.length > 0 && (
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" /> Weekly Top Performers
              <Badge className="bg-orange-100 text-orange-700 text-xs">Last 7 days</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {weeklyByUser.map(({ user: u, earned, surveys }, i) => (
                <div key={u.id} className={`flex items-center gap-3 p-3 rounded-xl border ${i === 0 ? 'border-orange-200 bg-orange-50' : 'border-gray-100 bg-white'}`}>
                  <div className="w-7 flex items-center justify-center flex-shrink-0">
                    {i === 0 ? <Crown className="w-5 h-5 text-orange-500" /> : <span className="text-gray-400 text-sm font-bold">#{i + 1}</span>}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                    {(u.full_name || 'U').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate flex items-center gap-1.5">
                      {u.full_name || 'Anonymous'}
                      {u.id === currentUserId && <Badge className="bg-indigo-600 text-xs py-0">You</Badge>}
                    </p>
                    <p className="text-xs text-gray-400">{surveys} surveys this week</p>
                  </div>
                  <p className={`text-base font-black flex-shrink-0 ${i === 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    ${earned.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tier explanation */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-4 pb-3">
          <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Badge Tier System</p>
          <div className="flex flex-wrap gap-2">
            {TIER_BADGES.map(t => (
              <div key={t.name} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${t.color}`}>
                <span>{t.icon}</span> {t.name} ({t.min}+ badges)
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main leaderboard */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-600" /> Top 100 Earners
            </CardTitle>
            <div className="flex gap-1.5">
              {[
                { key: 'earnings', label: '💰 By Earnings', icon: DollarSign },
                { key: 'surveys', label: '📋 By Surveys', icon: Award },
              ].map(m => (
                <button
                  key={m.key}
                  onClick={() => setMetric(m.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                    ${metric === m.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {sorted.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No users ranked yet</p>
            </div>
          ) : (
            sorted.map((entry, i) => (
              <LeaderRow key={entry.user?.id || i} entry={entry} index={i} currentUserId={currentUserId} metric={metric} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
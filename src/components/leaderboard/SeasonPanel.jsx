import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Calendar, Gift, Crown, Loader2, Star, Zap, Users, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';
import { format, endOfMonth, differenceInDays } from 'date-fns';

const SEASON_REWARDS = [
  { rank_range: '#1', reward_name: 'Apex Champion', reward_type: 'title', reward_icon: '👑', color_hex: '#f59e0b', cash_bonus: 50 },
  { rank_range: '#2–#3', reward_name: 'Elite Rival', reward_type: 'avatar_frame', reward_icon: '🏆', color_hex: '#94a3b8', cash_bonus: 25 },
  { rank_range: '#4–#10', reward_name: 'Season Veteran', reward_type: 'badge', reward_icon: '⚡', color_hex: '#7c3aed', cash_bonus: 10 },
  { rank_range: '#11–#25', reward_name: 'Platinum Earner', reward_type: 'cosmetic', reward_icon: '💎', color_hex: '#2563eb', cash_bonus: 5 },
  { rank_range: '#26–#50', reward_name: 'Gold Surveyor', reward_type: 'badge', reward_icon: '🌟', color_hex: '#d97706', cash_bonus: 2 },
  { rank_range: '#51–#100', reward_name: 'Season Warrior', reward_type: 'badge', reward_icon: '🔥', color_hex: '#dc2626', cash_bonus: 1 },
];

function CountdownTimer({ endsAt }) {
  const days = differenceInDays(new Date(endsAt), new Date());
  return (
    <div className="flex items-center gap-4 justify-center mt-3">
      {[
        { label: 'Days', value: Math.max(0, days) },
        { label: 'Hours', value: new Date(endsAt).getHours() },
        { label: 'Mins', value: new Date().getMinutes() },
      ].map(t => (
        <div key={t.label} className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-white shadow-md flex items-center justify-center">
            <span className="text-2xl font-black text-indigo-700">{String(t.value).padStart(2, '0')}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{t.label}</p>
        </div>
      ))}
    </div>
  );
}

export default function SeasonPanel({ currentUserId }) {
  const qc = useQueryClient();
  const now = new Date();
  const seasonEnd = endOfMonth(now);

  const { data: seasons = [], isLoading } = useQuery({
    queryKey: ['seasons'],
    queryFn: () => base44.entities.Season.filter({ status: 'active' }),
    staleTime: 60000,
  });

  const activeSeason = seasons[0] || {
    id: 'demo',
    season_number: 1,
    name: 'Season 1: Genesis',
    status: 'active',
    starts_at: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    ends_at: seasonEnd.toISOString(),
    total_participants: 1247,
    total_payouts: 3820,
  };

  const { data: rankings = [] } = useQuery({
    queryKey: ['season-ranks', activeSeason.id],
    queryFn: () => base44.entities.SeasonRank.filter({ season_id: activeSeason.id }, '-score', 100),
    enabled: !!activeSeason.id && activeSeason.id !== 'demo',
  });

  const myRank = rankings.findIndex(r => r.user_id === currentUserId);
  const myEntry = rankings[myRank];

  const createSeasonMutation = useMutation({
    mutationFn: () => base44.entities.Season.create({
      season_number: (seasons.length || 0) + 1,
      name: `Season ${(seasons.length || 0) + 1}: ${['Genesis', 'Ascent', 'Eclipse', 'Nova', 'Apex'][seasons.length % 5]}`,
      status: 'active',
      starts_at: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      ends_at: endOfMonth(now).toISOString(),
      top_100_rewards: SEASON_REWARDS,
      total_participants: 0,
      total_payouts: 0,
    }),
    onSuccess: () => qc.invalidateQueries(['seasons']),
  });

  return (
    <div className="space-y-4">
      {/* Season Header */}
      <Card className="border-0 shadow-md bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white overflow-hidden">
        <CardContent className="p-5 relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white/20 rounded-xl"><Trophy className="w-6 h-6" /></div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest opacity-80">Active Season</p>
                <h2 className="text-xl font-black">{activeSeason.name}</h2>
              </div>
              <Badge className="ml-auto bg-green-400 text-green-900 font-bold animate-pulse">LIVE</Badge>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3 mt-4">
              {[
                { label: 'Participants', value: activeSeason.total_participants?.toLocaleString() || '1,247', icon: Users },
                { label: 'Prize Pool', value: `$${activeSeason.total_payouts?.toFixed(0) || '3,820'}`, icon: DollarSign },
                { label: 'My Rank', value: myRank >= 0 ? `#${myRank + 1}` : '--', icon: Star },
              ].map(s => (
                <div key={s.label} className="bg-white/15 rounded-xl p-2 text-center">
                  <p className="text-lg font-black">{s.value}</p>
                  <p className="text-xs opacity-75">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="text-center">
              <p className="text-xs opacity-70 mb-1">Season ends {format(new Date(activeSeason.ends_at), 'MMMM d, yyyy')}</p>
              <CountdownTimer endsAt={activeSeason.ends_at} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* My Season Progress */}
      {myEntry && (
        <Card className="border-2 border-indigo-200 bg-indigo-50">
          <CardContent className="p-4 flex items-center gap-4">
            <Crown className="w-8 h-8 text-indigo-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-gray-900">Your Season Standing</p>
              <div className="flex gap-4 text-sm mt-1">
                <span className="text-green-600 font-semibold">${(myEntry.earnings || 0).toFixed(2)} earned</span>
                <span className="text-blue-600">{myEntry.surveys_completed || 0} surveys</span>
                <span className="text-purple-600">{myEntry.referrals || 0} referrals</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-indigo-700">#{myRank + 1}</p>
              {myRank < 100 && <Badge className="bg-indigo-600 text-white text-xs">Top 100!</Badge>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rewards Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Gift className="w-4 h-4 text-pink-500" /> Season Cosmetic Rewards — Top 100</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {SEASON_REWARDS.map((r, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:shadow-sm transition-shadow">
              <div className="text-2xl w-8 text-center flex-shrink-0">{r.reward_icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-gray-900">{r.reward_name}</span>
                  <Badge className="text-xs bg-purple-50 text-purple-700">{r.reward_type.replace('_', ' ')}</Badge>
                </div>
                <p className="text-xs text-gray-400">{r.rank_range} · Exclusive seasonal cosmetic</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-green-600">+${r.cash_bonus} bonus</p>
                <div className="w-4 h-4 rounded-full mx-auto mt-1" style={{ background: r.color_hex }} />
              </div>
            </motion.div>
          ))}
        </CardContent>
      </Card>

      {/* Season History Note */}
      <div className="text-center py-3 text-xs text-gray-400 flex items-center justify-center gap-2">
        <Calendar className="w-3.5 h-3.5" />
        Seasons reset on the 1st of every month. Past season rewards are kept permanently.
      </div>
    </div>
  );
}
import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Ticket, Star, Users, TrendingUp, Gift, Zap, Crown } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

export default function ContestEntries() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: jackpots = [] } = useQuery({
    queryKey: ['contest-jackpots'],
    queryFn: () => base44.entities.ReferralJackpot.filter({ status: 'active' }),
    enabled: !!user,
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ['contest-referrals', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id }),
    enabled: !!user,
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ['contest-milestones', user?.id],
    queryFn: () => base44.entities.ReferralMilestone.filter({ user_id: user.id }),
    enabled: !!user,
  });

  const jackpot = jackpots[0] || { jackpot_amount: 2840, total_entries: 342, period: '2026-Q2' };

  // Calculate entries: 1 per active referral milestone hit + bonus for streak
  const activeReferrals = useMemo(() => referrals.filter(r => r.status === 'active').length, [referrals]);
  
  const entryBreakdown = useMemo(() => {
    const items = [];
    if (activeReferrals >= 5)   items.push({ label: 'Reached 5 referrals milestone',   entries: 1 });
    if (activeReferrals >= 25)  items.push({ label: 'Reached 25 referrals milestone',  entries: 3 });
    if (activeReferrals >= 50)  items.push({ label: 'Reached 50 referrals milestone',  entries: 5 });
    if (activeReferrals >= 100) items.push({ label: 'Reached 100 referrals milestone', entries: 10 });
    if (activeReferrals >= 500) items.push({ label: 'Reached 500 referrals milestone', entries: 25 });
    return items;
  }, [activeReferrals]);

  const myEntries = entryBreakdown.reduce((s, e) => s + e.entries, 0);
  const myWinChance = jackpot.total_entries > 0 ? ((myEntries / jackpot.total_entries) * 100).toFixed(2) : 0;

  const MILESTONE_THRESHOLDS = [
    { refs: 5,   entries: 1,  label: '5 Referrals',   color: 'from-blue-400 to-blue-600' },
    { refs: 25,  entries: 3,  label: '25 Referrals',  color: 'from-purple-400 to-purple-600' },
    { refs: 50,  entries: 5,  label: '50 Referrals',  color: 'from-yellow-400 to-amber-600' },
    { refs: 100, entries: 10, label: '100 Referrals', color: 'from-orange-400 to-red-600' },
    { refs: 500, entries: 25, label: '500 Referrals', color: 'from-pink-500 to-rose-700' },
  ];

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center py-4">
          <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-800 px-4 py-2 rounded-full text-sm font-bold mb-4">
            <Ticket className="w-4 h-4" /> CONTEST ENTRIES
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-2">
            Your Contest <span className="text-purple-600">Entries</span>
          </h1>
          <p className="text-gray-500">Earn contest entries by hitting referral milestones. Most entries wins the prize pool!</p>
        </div>

        {/* Live Prize Pool */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: 'linear-gradient(135deg, #6d28d9 0%, #4338ca 50%, #1e40af 100%)' }}
        >
          <div className="relative p-6 text-white">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-24 translate-x-24 pointer-events-none" />
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-widest opacity-75">Live Prize Pool · {jackpot.period}</span>
            </div>
            <p className="text-6xl font-black mb-4">${(jackpot.jackpot_amount || 0).toLocaleString()}</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Ticket, label: 'Total Entries', value: jackpot.total_entries || 0 },
                { icon: Star,   label: 'Your Entries',  value: myEntries },
                { icon: TrendingUp, label: 'Win Chance', value: `${myWinChance}%` },
              ].map(s => (
                <div key={s.label} className="bg-white/15 backdrop-blur-sm rounded-xl p-3 text-center">
                  <s.icon className="w-4 h-4 mx-auto mb-1 opacity-75" />
                  <p className="text-lg font-black">{s.value}</p>
                  <p className="text-xs opacity-65">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* My entries summary */}
        <Card className="border-2 border-purple-200 bg-purple-50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                  <Trophy className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-black text-gray-900">{myEntries} entries</p>
                  <p className="text-sm text-gray-500">from {activeReferrals} active referrals</p>
                </div>
              </div>
              {myEntries > 0 ? (
                <Badge className="bg-green-100 text-green-700 text-sm px-3 py-1 border-0">
                  <Crown className="w-3.5 h-3.5 mr-1" /> Entered in contest!
                </Badge>
              ) : (
                <Link to="/ReferralDashboard">
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                    <Users className="w-4 h-4 mr-2" /> Get Entries — Refer Friends
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Entry breakdown */}
        {entryBreakdown.length > 0 && (
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Ticket className="w-4 h-4 text-purple-500" /> Your Entry Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {entryBreakdown.map((e, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-purple-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎟️</span>
                    <span className="text-sm font-medium text-gray-700">{e.label}</span>
                  </div>
                  <Badge className="bg-purple-100 text-purple-700 border-0 font-bold">+{e.entries} {e.entries === 1 ? 'entry' : 'entries'}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Milestone unlock ladder */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" /> How to Earn More Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {MILESTONE_THRESHOLDS.map(m => {
                const reached = activeReferrals >= m.refs;
                return (
                  <div key={m.refs} className={`flex items-center gap-4 rounded-xl p-3 border-2 transition-all ${reached ? 'border-green-300 bg-green-50' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center flex-shrink-0 shadow`}>
                      <Ticket className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800 text-sm">{m.label}</p>
                      <p className="text-xs text-gray-500">{activeReferrals}/{m.refs} active referrals</p>
                    </div>
                    <Badge className={`font-bold border-0 ${reached ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                      {reached ? '✓' : ''} +{m.entries} {m.entries === 1 ? 'entry' : 'entries'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Contest rules */}
        <Card className="border-2 border-indigo-200 bg-indigo-50">
          <CardContent className="pt-5 pb-4">
            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Gift className="w-4 h-4 text-indigo-500" /> Contest Rules
            </h3>
            <div className="space-y-1 text-sm text-gray-600">
              <p>• Contest entries are earned by hitting referral milestones. More entries = better odds.</p>
              <p>• Prize pool = 10% of quarterly after-tax profits, distributed to the winner.</p>
              <p>• Winner is drawn randomly at end of quarter — higher entry count increases your chance.</p>
              <p>• Prize must be used for GamerGain store credit or survey creation.</p>
              <p>• Contest resets quarterly. Previous entries do not carry over.</p>
            </div>
          </CardContent>
        </Card>

        <div className="pb-8 text-center">
          <Link to="/ReferralDashboard">
            <Button size="lg" className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold px-8 shadow-xl">
              <Users className="w-5 h-5 mr-2" /> Refer Friends to Earn More Entries
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
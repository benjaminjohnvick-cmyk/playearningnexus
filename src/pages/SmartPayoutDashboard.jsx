import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign, TrendingUp, Zap, Clock, CheckCircle2, ArrowRight,
  BarChart2, Target, Wallet, Star, CreditCard, Calendar, Flame, AlertCircle
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format, subDays, startOfWeek, eachDayOfInterval } from 'date-fns';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import DailyLoginStreak from '@/components/streaks/DailyLoginStreak';
import ReferralConquestLeaderboard from '@/components/referral/ReferralConquestLeaderboard';
import { toast } from 'sonner';

export default function SmartPayoutDashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: payouts = [] } = useQuery({
    queryKey: ['smart-payouts', user?.id],
    queryFn: () => base44.entities.Payout.filter({ user_id: user.id }, '-created_date', 100),
    enabled: !!user,
  });

  const { data: dailyEarnings = [] } = useQuery({
    queryKey: ['smart-daily-earnings', user?.id],
    queryFn: () => base44.entities.DailyEarnings.filter({ user_id: user.id }, '-date', 30),
    enabled: !!user,
  });

  const { data: wishlistItems = [] } = useQuery({
    queryKey: ['smart-wishlist', user?.id],
    queryFn: () => base44.entities.ProductWishlistItem.filter({ user_id: user.id, status: 'active' }, '-created_date', 20),
    enabled: !!user,
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ['smart-referrals', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id }),
    enabled: !!user,
  });

  const stats = useMemo(() => {
    const balance = user?.current_balance || 0;
    const totalEarned = user?.total_earnings || 0;
    const totalPaidOut = payouts.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount || 0), 0);
    const pendingPayout = payouts.filter(p => ['pending', 'processing'].includes(p.status)).reduce((s, p) => s + (p.amount || 0), 0);
    const activeReferrals = referrals.filter(r => r.status === 'active').length;
    const referralEarnings = referrals.reduce((s, r) => s + (r.commission_earned || 0), 0);
    const wishlistTotal = wishlistItems.reduce((s, i) => s + (i.price_with_markup || i.best_price || 0), 0);
    const avgDaily = dailyEarnings.length > 0
      ? dailyEarnings.reduce((s, d) => s + (d.total_earnings || 0), 0) / dailyEarnings.length
      : 0;
    const daysToWishlist = wishlistTotal > 0 && avgDaily > 0 ? Math.ceil((wishlistTotal - balance) / avgDaily) : null;

    return { balance, totalEarned, totalPaidOut, pendingPayout, activeReferrals, referralEarnings, wishlistTotal, avgDaily, daysToWishlist };
  }, [user, payouts, referrals, dailyEarnings, wishlistItems]);

  // Chart data — last 14 days
  const chartData = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(new Date(), 13), end: new Date() });
    return days.map(day => {
      const key = format(day, 'yyyy-MM-dd');
      const entry = dailyEarnings.find(e => e.date === key);
      return {
        date: format(day, 'MMM d'),
        earned: entry?.total_earnings || 0,
        surveys: entry?.total_surveys_completed || 0,
      };
    });
  }, [dailyEarnings]);

  // Smart suggestions
  const suggestions = useMemo(() => {
    const tips = [];
    if (stats.balance >= 10 && stats.balance < 50) tips.push({ icon: '💸', text: `You have $${stats.balance.toFixed(2)} ready — withdraw via PayPal in seconds.`, action: { label: 'Withdraw now', href: '/Withdrawal' } });
    if (stats.balance >= 50) tips.push({ icon: '⚡', text: `$${stats.balance.toFixed(2)} qualifies for Instant Payout — fastest way to get paid!`, action: { label: 'Instant Payout', href: '/Withdrawal' } });
    if (stats.activeReferrals < 5) tips.push({ icon: '👥', text: `Refer ${5 - stats.activeReferrals} more active users to unlock extra monthly bonuses.`, action: { label: 'Refer friends', href: '/ReferralDashboard' } });
    if (stats.wishlistTotal > 0 && stats.daysToWishlist) tips.push({ icon: '🛍️', text: `At your current pace, you'll cover your wishlist ($${stats.wishlistTotal.toFixed(2)}) in ~${stats.daysToWishlist} days.`, action: { label: 'View wishlist', href: '/Wishlist' } });
    if (stats.avgDaily < 1) tips.push({ icon: '📋', text: 'Complete at least 1 survey per day to build your earning streak and multiplier.', action: { label: 'Browse surveys', href: '/Surveys' } });
    return tips.slice(0, 3);
  }, [stats]);

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-green-200 border-t-green-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-white" />
            </div>
            Smart Payout Dashboard
          </h1>
          <p className="text-gray-500 mt-1">Your complete earnings hub — track, optimize, and withdraw intelligently.</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Available Balance', value: `$${stats.balance.toFixed(2)}`, icon: Wallet, color: 'from-emerald-500 to-teal-600', sub: stats.balance >= 50 ? '⚡ Instant eligible' : `$${(50 - stats.balance).toFixed(2)} to instant` },
            { label: 'Total Earned', value: `$${stats.totalEarned.toFixed(2)}`, icon: TrendingUp, color: 'from-blue-500 to-indigo-600', sub: `$${stats.totalPaidOut.toFixed(2)} paid out` },
            { label: 'Avg Daily', value: `$${stats.avgDaily.toFixed(2)}`, icon: Flame, color: 'from-orange-500 to-red-500', sub: 'last 30 days' },
            { label: 'Referral Earnings', value: `$${stats.referralEarnings.toFixed(2)}`, icon: Star, color: 'from-yellow-500 to-amber-600', sub: `${stats.activeReferrals} active referrals` },
          ].map((kpi, i) => (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
              <Card className="border-0 shadow-md overflow-hidden">
                <div className={`bg-gradient-to-br ${kpi.color} p-4 text-white`}>
                  <kpi.icon className="w-5 h-5 mb-1 opacity-80" />
                  <p className="text-2xl font-black">{kpi.value}</p>
                  <p className="text-xs opacity-80">{kpi.label}</p>
                </div>
                <CardContent className="py-2 px-3">
                  <p className="text-xs text-gray-500">{kpi.sub}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Smart Suggestions */}
        {suggestions.length > 0 && (
          <Card className="border-0 shadow-md bg-gradient-to-r from-indigo-50 to-blue-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-indigo-700">
                <Zap className="w-4 h-4" /> Smart Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {suggestions.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-3 bg-white rounded-xl px-3 py-2.5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{s.icon}</span>
                    <p className="text-sm text-gray-700">{s.text}</p>
                  </div>
                  {s.action && (
                    <Link to={s.action.href}>
                      <Button size="sm" variant="outline" className="flex-shrink-0 text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                        {s.action.label} <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="streak">Login Streak</TabsTrigger>
            <TabsTrigger value="conquest">Conquest</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            {/* Earnings Chart */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-emerald-600" /> 14-Day Earnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => [`$${v.toFixed(2)}`, 'Earned']} />
                    <Area type="monotone" dataKey="earned" stroke="#10b981" fill="url(#earnGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Wishlist goal */}
            {wishlistItems.length > 0 && (
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="w-4 h-4 text-rose-500" /> Wishlist Goals
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {wishlistItems.slice(0, 3).map(item => {
                    const goal = item.price_with_markup || item.best_price || 0;
                    const earned = item.amount_earned || 0;
                    const pct = goal > 0 ? Math.min(100, (earned / goal) * 100) : 0;
                    return (
                      <div key={item.id}>
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span className="font-medium truncate max-w-[60%]">{item.product_name}</span>
                          <span>${earned.toFixed(2)} / ${goal.toFixed(2)}</span>
                        </div>
                        <Progress value={pct} className="h-2 [&>div]:bg-rose-400" />
                      </div>
                    );
                  })}
                  <Link to="/Wishlist">
                    <Button variant="outline" size="sm" className="w-full mt-1 text-xs">View all wishlist items →</Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="streak" className="mt-4">
            <DailyLoginStreak user={user} />
          </TabsContent>

          <TabsContent value="conquest" className="mt-4">
            <ReferralConquestLeaderboard user={user} />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-base">Payout History</CardTitle>
              </CardHeader>
              <CardContent>
                {payouts.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>No payouts yet. Keep earning!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {payouts.slice(0, 20).map(p => (
                      <div key={p.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 border border-gray-100 hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${p.status === 'completed' ? 'bg-green-100' : p.status === 'failed' ? 'bg-red-100' : 'bg-amber-100'}`}>
                            {p.status === 'completed' ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : p.status === 'failed' ? <AlertCircle className="w-4 h-4 text-red-500" /> : <Clock className="w-4 h-4 text-amber-500" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">${(p.amount || 0).toFixed(2)} via {p.method || 'PayPal'}</p>
                            <p className="text-xs text-gray-400">{p.created_date ? format(new Date(p.created_date), 'MMM d, yyyy') : '—'}</p>
                          </div>
                        </div>
                        <Badge className={p.status === 'completed' ? 'bg-green-100 text-green-700' : p.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>
                          {p.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Quick actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Withdraw Funds', icon: DollarSign, href: '/Withdrawal', color: 'bg-emerald-600 hover:bg-emerald-700' },
            { label: 'Browse Surveys', icon: Zap, href: '/Surveys', color: 'bg-blue-600 hover:bg-blue-700' },
            { label: 'Referral Hub', icon: Star, href: '/ReferralDashboard', color: 'bg-yellow-500 hover:bg-yellow-600' },
            { label: 'My Wishlist', icon: Target, href: '/Wishlist', color: 'bg-rose-500 hover:bg-rose-600' },
          ].map(a => (
            <Link key={a.label} to={a.href}>
              <Button className={`w-full ${a.color} text-white font-semibold`}>
                <a.icon className="w-4 h-4 mr-2" /> {a.label}
              </Button>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
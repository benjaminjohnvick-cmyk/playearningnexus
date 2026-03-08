import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  User, Trophy, DollarSign, Settings, Gamepad2, CreditCard,
  Users, Star, Zap, Target, Award, Camera, Edit2, Check, X,
  Crown, Shield, Medal, ClipboardList, TrendingUp, AlertCircle
} from 'lucide-react';
import AboutMeEditor from '../components/profile/AboutMeEditor';
import SocialLinksEditor from '../components/profile/SocialLinksEditor';
import FeaturedBadges from '../components/profile/FeaturedBadges';
import SurveyInterestPicker from '../components/profile/SurveyInterestPicker';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// ── Badge definitions (same as GamificationHub) ──────────────────────────────
const BADGES = [
  { id: 'first_survey', icon: ClipboardList, label: 'First Survey', color: 'text-blue-600', bg: 'bg-blue-100', threshold: (s) => (s.totalSurveys || 0) >= 1 },
  { id: 'survey_champ', icon: Trophy, label: 'Survey Champion', color: 'text-yellow-600', bg: 'bg-yellow-100', threshold: (s) => (s.totalSurveys || 0) >= 50 },
  { id: 'first_referral', icon: Users, label: 'First Referral', color: 'text-green-600', bg: 'bg-green-100', threshold: (s) => (s.totalReferrals || 0) >= 1 },
  { id: 'referral_master', icon: Crown, label: 'Referral Master', color: 'text-purple-600', bg: 'bg-purple-100', threshold: (s) => (s.activeReferrals || 0) >= 10 },
  { id: 'daily_goal', icon: Target, label: 'Daily Achiever', color: 'text-teal-600', bg: 'bg-teal-100', threshold: (s) => (s.daysGoalMet || 0) >= 1 },
  { id: 'streak_7', icon: Zap, label: '7-Day Streak', color: 'text-orange-600', bg: 'bg-orange-100', threshold: (s) => (s.streakDays || 0) >= 7 },
  { id: 'earner_10', icon: Star, label: 'Power Earner', color: 'text-pink-600', bg: 'bg-pink-100', threshold: (s) => (s.totalEarnings || 0) >= 10 },
  { id: 'top_earner', icon: Medal, label: 'Top Earner', color: 'text-red-600', bg: 'bg-red-100', threshold: (s) => (s.totalEarnings || 0) >= 100 },
  { id: 'shield', icon: Shield, label: 'Loyal Member', color: 'text-indigo-600', bg: 'bg-indigo-100', threshold: (s) => (s.memberDays || 0) >= 30 },
];

const TIERS = [
  { name: 'Bronze', minReferrals: 0, minEarnings: 0, color: 'text-amber-700', bg: 'bg-amber-100', border: 'border-amber-300', multiplier: 1.0 },
  { name: 'Silver', minReferrals: 3, minEarnings: 5, color: 'text-gray-600', bg: 'bg-gray-100', border: 'border-gray-400', multiplier: 1.1 },
  { name: 'Gold', minReferrals: 10, minEarnings: 25, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-400', multiplier: 1.25 },
  { name: 'Platinum', minReferrals: 25, minEarnings: 75, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-400', multiplier: 1.5 },
  { name: 'Diamond', minReferrals: 50, minEarnings: 200, color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-500', multiplier: 2.0 },
];

function getUserTier(activeReferrals = 0, commission = 0) {
  let tier = TIERS[0];
  for (const t of TIERS) {
    if (activeReferrals >= t.minReferrals && commission >= t.minEarnings) tier = t;
  }
  return tier;
}

export default function UserProfile() {
  const [user, setUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setEditName(u.full_name); setAvatarUrl(u.avatar_url || ''); })
      .catch(() => base44.auth.redirectToLogin());
  }, []);

  const handleUserUpdate = (patch) => setUser(prev => ({ ...prev, ...patch }));

  // ── Data fetching ────────────────────────────────────────────────────────
  const { data: referrals = [] } = useQuery({
    queryKey: ['profileReferrals', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id }),
    enabled: !!user
  });

  const { data: gameLibrary = [] } = useQuery({
    queryKey: ['profileGameLibrary', user?.id],
    queryFn: async () => {
      if (!user?.game_library?.length) return [];
      const games = await Promise.all(user.game_library.map(id => base44.entities.Game.get(id).catch(() => null)));
      return games.filter(Boolean);
    },
    enabled: !!user
  });

  const { data: purchaseHistory = [] } = useQuery({
    queryKey: ['profilePurchases', user?.id],
    queryFn: () => base44.entities.Transaction.filter({ user_id: user.id, transaction_type: 'game_purchase' }, '-created_date', 50),
    enabled: !!user
  });

  const { data: dailyEarnings = [] } = useQuery({
    queryKey: ['profileDailyEarnings', user?.id],
    queryFn: () => base44.entities.DailyEarnings.filter({ user_id: user.id }, '-date', 30),
    enabled: !!user
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ['profilePayouts', user?.id],
    queryFn: () => base44.entities.Payout.filter({ user_id: user.id }, '-created_date', 50),
    enabled: !!user
  });

  const { data: payoutPrefs = [] } = useQuery({
    queryKey: ['profilePayoutPrefs', user?.id],
    queryFn: () => base44.entities.PayoutPreference.filter({ user_id: user.id }),
    enabled: !!user
  });

  // ── Computed stats ───────────────────────────────────────────────────────
  const totalReferrals = referrals.length;
  const activeReferrals = referrals.filter(r => r.status === 'active').length;
  const commissionEarned = referrals.reduce((s, r) => s + (r.commission_earned || 0), 0);
  const totalEarnings = user?.total_earnings || 0;
  const memberDays = user?.created_date ? Math.floor((Date.now() - new Date(user.created_date)) / 86400000) : 0;
  const daysGoalMet = dailyEarnings.filter(d => d.goal_met).length;
  const totalSurveys = dailyEarnings.reduce((s, d) => s + (d.total_surveys_completed || 0), 0);

  const userStats = { totalReferrals, activeReferrals, commissionEarned, totalEarnings, memberDays, daysGoalMet, totalSurveys, streakDays: 0 };
  const currentTier = getUserTier(activeReferrals, commissionEarned);
  const nextTier = TIERS[TIERS.findIndex(t => t.name === currentTier.name) + 1];
  const earnedBadges = BADGES.filter(b => b.threshold(userStats));
  const points = Math.floor(totalSurveys * 10 + totalReferrals * 25 + totalEarnings * 5 + daysGoalMet * 15);

  // ── Avatar upload ────────────────────────────────────────────────────────
  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingAvatar(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.auth.updateMe({ avatar_url: file_url });
    setAvatarUrl(file_url);
    const u = await base44.auth.me();
    setUser(u);
    setUploadingAvatar(false);
    toast.success('Avatar updated!');
  };

  // ── Name edit ────────────────────────────────────────────────────────────
  const saveNameMutation = useMutation({
    mutationFn: async () => {
      await base44.auth.updateMe({ full_name: editName });
      const u = await base44.auth.me();
      setUser(u);
    },
    onSuccess: () => { setIsEditing(false); toast.success('Name updated!'); }
  });

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ── Hero Header ─────────────────────────────────────────────────── */}
        <Card className="overflow-hidden border-0 shadow-xl">
          <div className="bg-gradient-to-r from-red-600 via-red-700 to-rose-700 p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <Avatar className="w-24 h-24 md:w-28 md:h-28 border-4 border-white shadow-lg">
                  {avatarUrl ? <AvatarImage src={avatarUrl} /> : null}
                  <AvatarFallback className="text-3xl bg-white text-red-600 font-bold">
                    {user.full_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 bg-white rounded-full p-1.5 shadow-md hover:bg-gray-100 transition-colors"
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /> : <Camera className="w-4 h-4 text-red-600" />}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>

              {/* Name & Email */}
              <div className="flex-1 text-white text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="text-gray-900 font-bold text-lg h-9 w-48"
                      />
                      <button onClick={() => saveNameMutation.mutate()} className="bg-white/20 hover:bg-white/30 p-1.5 rounded-full">
                        <Check className="w-4 h-4 text-white" />
                      </button>
                      <button onClick={() => { setIsEditing(false); setEditName(user.full_name); }} className="bg-white/20 hover:bg-white/30 p-1.5 rounded-full">
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h1 className="text-2xl md:text-3xl font-bold">{user.full_name}</h1>
                      <button onClick={() => setIsEditing(true)} className="bg-white/20 hover:bg-white/30 p-1 rounded-full transition-colors">
                        <Edit2 className="w-4 h-4 text-white" />
                      </button>
                    </>
                  )}
                </div>
                <p className="text-red-200 text-sm mb-1">{user.email}</p>
                <p className="text-red-300 text-xs">Member for {memberDays} days · {user.role || 'User'}</p>
                <div className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full ${currentTier.bg}`}>
                  <Crown className={`w-4 h-4 ${currentTier.color}`} />
                  <span className={`text-sm font-bold ${currentTier.color}`}>{currentTier.name} Tier</span>
                </div>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-2 md:grid-cols-2 gap-3 flex-shrink-0">
                {[
                  { icon: DollarSign, label: 'Balance', value: `$${(user.current_balance || 0).toFixed(2)}`, color: 'text-green-300' },
                  { icon: TrendingUp, label: 'Total Earned', value: `$${totalEarnings.toFixed(2)}`, color: 'text-blue-300' },
                  { icon: Star, label: 'Points', value: points.toLocaleString(), color: 'text-yellow-300' },
                  { icon: Award, label: 'Badges', value: `${earnedBadges.length}/${BADGES.length}`, color: 'text-purple-300' },
                ].map(stat => (
                  <div key={stat.label} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center min-w-[90px]">
                    <stat.icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
                    <p className="text-white font-bold text-lg leading-tight">{stat.value}</p>
                    <p className="text-white/70 text-xs">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 bg-white shadow-md">
            <TabsTrigger value="overview"><User className="w-4 h-4 mr-1 hidden sm:inline" />Overview</TabsTrigger>
            <TabsTrigger value="badges"><Award className="w-4 h-4 mr-1 hidden sm:inline" />Badges</TabsTrigger>
            <TabsTrigger value="referrals"><Users className="w-4 h-4 mr-1 hidden sm:inline" />Referrals</TabsTrigger>
            <TabsTrigger value="payouts"><DollarSign className="w-4 h-4 mr-1 hidden sm:inline" />Payouts</TabsTrigger>
            <TabsTrigger value="library"><Gamepad2 className="w-4 h-4 mr-1 hidden sm:inline" />Library</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-1 hidden sm:inline" />Settings</TabsTrigger>
          </TabsList>

          {/* ── Overview ── */}
          <TabsContent value="overview" className="space-y-4">
            {/* Featured Badges */}
            <FeaturedBadges user={user} userStats={userStats} onUpdate={handleUserUpdate} />

            {/* About Me */}
            <AboutMeEditor user={user} onUpdate={handleUserUpdate} />

            {/* Social Links */}
            <SocialLinksEditor user={user} onUpdate={handleUserUpdate} />

            <div className="grid md:grid-cols-3 gap-4">
              {/* Earnings */}
              <Card className="md:col-span-2 border-0 shadow-lg">
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><DollarSign className="w-5 h-5 text-green-600" />Earnings & Balance</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-green-50 rounded-xl p-4 border-2 border-green-200">
                      <p className="text-xs text-gray-500 mb-1">Available Balance</p>
                      <p className="text-3xl font-bold text-green-600">${(user.current_balance || 0).toFixed(2)}</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
                      <p className="text-xs text-gray-500 mb-1">All-Time Earned</p>
                      <p className="text-3xl font-bold text-blue-600">${totalEarnings.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <p className="text-xl font-bold text-purple-600">${commissionEarned.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">Referral Commission</p>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <p className="text-xl font-bold text-orange-600">{daysGoalMet}</p>
                      <p className="text-xs text-gray-500">Daily Goals Hit</p>
                    </div>
                    <div className="text-center p-3 bg-teal-50 rounded-lg">
                      <p className="text-xl font-bold text-teal-600">{totalSurveys}</p>
                      <p className="text-xs text-gray-500">Surveys Done</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Points & Tier */}
              <Card className={`border-2 ${currentTier.border} shadow-lg`}>
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Crown className={`w-5 h-5 ${currentTier.color}`} />Tier & Points</CardTitle></CardHeader>
                <CardContent>
                  <div className={`rounded-xl p-4 text-center mb-4 ${currentTier.bg}`}>
                    <p className={`text-2xl font-bold ${currentTier.color}`}>{currentTier.name}</p>
                    <p className="text-xs text-gray-500">{currentTier.multiplier}x commission</p>
                  </div>
                  <div className="text-center mb-4">
                    <p className="text-3xl font-bold text-yellow-600">{points.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Total XP Points</p>
                  </div>
                  {nextTier && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Progress to {nextTier.name}</p>
                      <Progress value={Math.min(100, (activeReferrals / nextTier.minReferrals) * 100)} className="h-2 mb-1" />
                      <p className="text-xs text-gray-400">{activeReferrals}/{nextTier.minReferrals} active referrals</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent purchases summary */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><CreditCard className="w-5 h-5 text-gray-600" />Recent Purchases</CardTitle></CardHeader>
              <CardContent>
                {purchaseHistory.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4">No purchases yet</p>
                ) : (
                  <div className="space-y-2">
                    {purchaseHistory.slice(0, 5).map(tx => (
                      <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">Game Purchase</p>
                          <p className="text-xs text-gray-400">{new Date(tx.created_date).toLocaleDateString()}</p>
                        </div>
                        <p className="font-bold text-green-600">${tx.amount?.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Badges ── */}
          <TabsContent value="badges" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border-0 shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Award className="w-5 h-5 text-purple-600" />
                    Earned Badges
                    <Badge className="bg-purple-600">{earnedBadges.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {earnedBadges.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-8">Complete actions to earn badges!</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {earnedBadges.map((badge, idx) => {
                        const Icon = badge.icon;
                        return (
                          <motion.div key={badge.id} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: idx * 0.06 }}
                            className={`flex flex-col items-center p-3 rounded-xl ${badge.bg} border-2 border-current text-center`}>
                            <Icon className={`w-8 h-8 mb-1 ${badge.color}`} />
                            <p className={`text-xs font-bold ${badge.color}`}>{badge.label}</p>
                            <p className="text-xs text-green-600 mt-0.5">✓ Earned</p>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-gray-400" />
                    Locked Badges
                    <Badge variant="outline">{BADGES.length - earnedBadges.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    {BADGES.filter(b => !b.threshold(userStats)).map((badge) => {
                      const Icon = badge.icon;
                      return (
                        <div key={badge.id} className="flex flex-col items-center p-3 rounded-xl bg-gray-100 opacity-50 text-center">
                          <Icon className="w-8 h-8 mb-1 text-gray-400" />
                          <p className="text-xs font-bold text-gray-400">{badge.label}</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Referrals ── */}
          <TabsContent value="referrals" className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              {[
                { label: 'Total Referrals', value: totalReferrals, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Active Referrals', value: activeReferrals, color: 'text-green-600', bg: 'bg-green-50' },
                { label: 'Commission Earned', value: `$${commissionEarned.toFixed(2)}`, color: 'text-purple-600', bg: 'bg-purple-50' },
              ].map(s => (
                <Card key={s.label} className={`border-0 shadow-lg ${s.bg}`}>
                  <CardContent className="pt-6 text-center">
                    <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-sm text-gray-600 mt-1">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-2"><CardTitle className="text-base">Your Referrals</CardTitle></CardHeader>
              <CardContent>
                {referrals.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No referrals yet. Share your link to start earning!</p>
                ) : (
                  <div className="space-y-3">
                    {referrals.map(r => (
                      <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">User #{r.referred_user_id.slice(0, 8)}</p>
                          <p className="text-xs text-gray-400">Joined {new Date(r.created_date).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-bold text-green-600">${(r.commission_earned || 0).toFixed(2)}</p>
                            <p className="text-xs text-gray-400">Your commission</p>
                          </div>
                          <Badge variant={r.status === 'active' ? 'default' : 'secondary'} className={r.status === 'active' ? 'bg-green-600' : ''}>
                            {r.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Payouts ── */}
          <TabsContent value="payouts" className="space-y-4">
            {/* Stats */}
            {(() => {
              const pref = payoutPrefs[0];
              const totalPaid = payouts.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount || 0), 0);
              const pendingAmt = payouts.filter(p => p.status === 'pending' || p.status === 'processing').reduce((s, p) => s + (p.amount || 0), 0);
              return (
                <>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <Card className="border-0 shadow-lg bg-green-50">
                      <CardContent className="pt-5 pb-4 text-center">
                        <p className="text-3xl font-bold text-green-600">${totalPaid.toFixed(2)}</p>
                        <p className="text-sm text-gray-500 mt-1">Total Received</p>
                      </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-amber-50">
                      <CardContent className="pt-5 pb-4 text-center">
                        <p className="text-3xl font-bold text-amber-600">${pendingAmt.toFixed(2)}</p>
                        <p className="text-sm text-gray-500 mt-1">Pending / Processing</p>
                      </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-blue-50">
                      <CardContent className="pt-5 pb-4 text-center">
                        <p className="text-3xl font-bold text-blue-600">{payouts.length}</p>
                        <p className="text-sm text-gray-500 mt-1">Total Payouts</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Payout method & verification */}
                  <Card className="border-0 shadow-lg">
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                        <p className="font-semibold text-gray-800 text-sm">Payout Configuration</p>
                        <Link to={createPageUrl('PayoutSettings')}>
                          <Button size="sm" variant="outline" className="text-xs">Edit Settings</Button>
                        </Link>
                      </div>
                      {pref ? (
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="capitalize">{pref.payout_method?.replace('_', ' ') || '—'}</Badge>
                          <Badge variant="outline">{pref.payout_frequency || 'net_90'}</Badge>
                          <Badge variant="outline">Min ${pref.minimum_payout_threshold || 50}</Badge>
                          <Badge className={pref.is_verified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                            {pref.is_verified ? '✓ Verified' : '⚠ Pending Verification'}
                          </Badge>
                          <Badge className={pref.auto_payout_enabled ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}>
                            {pref.auto_payout_enabled ? 'Auto-Pay On' : 'Manual'}
                          </Badge>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-amber-600 text-sm">
                          <AlertCircle className="w-4 h-4" />
                          No payout method configured.
                          <Link to={createPageUrl('PayoutSettings')} className="underline font-medium">Set up now →</Link>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Payout History */}
                  <Card className="border-0 shadow-lg">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-600" /> Payout History
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {payouts.length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-8">No payouts yet. Earn and configure payout settings to get started!</p>
                      ) : (
                        <div className="space-y-2">
                          {payouts.slice(0, 10).map(p => (
                            <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div>
                                <p className="font-medium text-sm capitalize">{p.payout_type?.replace('_', ' ') || 'Payout'}</p>
                                <p className="text-xs text-gray-400">{new Date(p.created_date).toLocaleDateString()} · {p.method}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-green-600">${(p.amount || 0).toFixed(2)}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  p.status === 'completed' ? 'bg-green-100 text-green-700' :
                                  p.status === 'failed' ? 'bg-red-100 text-red-700' :
                                  'bg-amber-100 text-amber-700'
                                }`}>{p.status}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              );
            })()}
          </TabsContent>

          {/* ── Library ── */}
          <TabsContent value="library">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5 text-blue-600" />
                  Game Library ({gameLibrary.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {gameLibrary.length === 0 ? (
                  <div className="text-center py-12">
                    <Gamepad2 className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                    <p className="text-gray-400 mb-4">No games in your library yet</p>
                    <Button onClick={() => window.location.href = '/InAppGameStore'} className="bg-red-600 hover:bg-red-700">Browse Store</Button>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-3 gap-4">
                    {gameLibrary.map(game => (
                      <Card key={game.id} className="hover:shadow-lg transition-shadow border border-gray-100">
                        <CardContent className="p-4">
                          {game.icon_url
                            ? <img src={game.icon_url} alt={game.title} className="w-full h-28 object-cover rounded-lg mb-3" />
                            : <div className="w-full h-28 bg-gradient-to-br from-red-400 to-rose-600 rounded-lg mb-3" />}
                          <h3 className="font-bold mb-1 text-sm">{game.title}</h3>
                          <p className="text-xs text-gray-500 line-clamp-2 mb-3">{game.description}</p>
                          <Button size="sm" className="w-full bg-red-600 hover:bg-red-700">
                            <Gamepad2 className="w-3 h-3 mr-1" /> Play Now
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Settings ── */}
          <TabsContent value="settings">
            <div className="space-y-4">
              <SurveyInterestPicker user={user} onUpdate={handleUserUpdate} />
              <ChatbotPreferences />
              <Card className="border-0 shadow-lg">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Settings className="w-5 h-5 text-gray-600" />Account Settings</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  {/* Avatar section */}
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                    <Avatar className="w-16 h-16 border-2 border-gray-200">
                      {avatarUrl ? <AvatarImage src={avatarUrl} /> : null}
                      <AvatarFallback className="text-xl bg-red-100 text-red-600 font-bold">{user.full_name?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-gray-900">Profile Photo</p>
                      <p className="text-sm text-gray-500 mb-2">Upload a photo to personalize your profile</p>
                      <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar}>
                        <Camera className="w-4 h-4 mr-1" />
                        {uploadingAvatar ? 'Uploading...' : 'Change Photo'}
                      </Button>
                    </div>
                  </div>

                  {/* Name */}
                  <div className="space-y-2">
                    <Label>Display Name</Label>
                    <div className="flex gap-2">
                      <Input value={editName} onChange={e => setEditName(e.target.value)} />
                      <Button onClick={() => saveNameMutation.mutate()} disabled={editName === user.full_name || saveNameMutation.isPending}>
                        Save
                      </Button>
                    </div>
                  </div>

                  {/* Read-only info */}
                  <div className="space-y-4">
                    <div>
                      <Label>Email</Label>
                      <p className="mt-1 text-gray-700 bg-gray-50 rounded-lg px-3 py-2 text-sm">{user.email}</p>
                      <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
                    </div>
                    <div>
                      <Label>Account Role</Label>
                      <p className="mt-1 text-gray-700 bg-gray-50 rounded-lg px-3 py-2 text-sm capitalize">{user.role || 'User'}</p>
                    </div>
                    <div>
                      <Label>Member Since</Label>
                      <p className="mt-1 text-gray-700 bg-gray-50 rounded-lg px-3 py-2 text-sm">{new Date(user.created_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ChatbotPreferences() {
  const DEFAULT_PREFS = { tone: 'friendly', proactive: true, quickSuggestions: true, notifyTips: true };
  const [prefs, setPrefs] = React.useState(() => {
    try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem('chatbot_prefs') || '{}') }; }
    catch { return DEFAULT_PREFS; }
  });

  const updatePref = (key, value) => {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    localStorage.setItem('chatbot_prefs', JSON.stringify(updated));
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="w-5 h-5 text-purple-600" />
          AI Chatbot Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Label className="text-sm font-semibold mb-2 block">Response Tone</Label>
          <div className="flex gap-3">
            {['friendly', 'professional', 'casual'].map(t => (
              <button key={t}
                onClick={() => updatePref('tone', t)}
                className={`px-4 py-2 rounded-full border transition-all capitalize text-sm font-medium ${prefs.tone === t ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}`}
              >{t}</button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {[
            { key: 'proactive', label: 'Proactive suggestions', description: 'Let the AI offer help based on your activity' },
            { key: 'quickSuggestions', label: 'Show quick prompts', description: 'Display shortcut buttons in the chat window' },
            { key: 'notifyTips', label: 'Tip notifications', description: 'Show helpful tips as you browse the platform' },
          ].map(({ key, label, description }) => (
            <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div>
                <p className="font-medium text-sm text-gray-900">{label}</p>
                <p className="text-xs text-gray-500">{description}</p>
              </div>
              <div
                onClick={() => updatePref(key, !prefs[key])}
                className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors flex-shrink-0 ${prefs[key] ? 'bg-purple-600' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${prefs[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
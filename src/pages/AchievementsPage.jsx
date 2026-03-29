import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Star, Zap, Users, ClipboardList, Crown, Shield,
  Award, Target, Flame, Lock, CheckCircle2, Gift, TrendingUp, Calendar
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// ── Master badge catalog ─────────────────────────────────────────────────────
export const BADGE_CATALOG = [
  {
    id: 'early_bird',
    icon: '🐦',
    label: 'Early Bird',
    description: 'Signed up and joined the community',
    color: 'from-sky-400 to-blue-500',
    border: 'border-sky-300',
    bg: 'bg-sky-50',
    category: 'Milestones',
    check: (s) => true, // everyone who is in earns this
    progress: () => ({ current: 1, max: 1 }),
    reward: '$0.25 bonus',
  },
  {
    id: 'first_survey',
    icon: '📋',
    label: 'First Steps',
    description: 'Completed your very first survey',
    color: 'from-green-400 to-emerald-500',
    border: 'border-green-300',
    bg: 'bg-green-50',
    category: 'Surveys',
    check: (s) => s.surveysCompleted >= 1,
    progress: (s) => ({ current: Math.min(s.surveysCompleted, 1), max: 1 }),
    reward: '$0.50 bonus',
  },
  {
    id: 'survey_master',
    icon: '🎯',
    label: 'Survey Master',
    description: 'Completed 50 surveys — you\'re a pro!',
    color: 'from-violet-400 to-purple-600',
    border: 'border-violet-300',
    bg: 'bg-violet-50',
    category: 'Surveys',
    check: (s) => s.surveysCompleted >= 50,
    progress: (s) => ({ current: Math.min(s.surveysCompleted, 50), max: 50 }),
    reward: '$2.00 bonus',
  },
  {
    id: 'survey_legend',
    icon: '🏆',
    label: 'Survey Legend',
    description: 'Completed 200 surveys — legendary status!',
    color: 'from-yellow-400 to-amber-500',
    border: 'border-yellow-300',
    bg: 'bg-yellow-50',
    category: 'Surveys',
    check: (s) => s.surveysCompleted >= 200,
    progress: (s) => ({ current: Math.min(s.surveysCompleted, 200), max: 200 }),
    reward: '$10.00 bonus',
  },
  {
    id: 'referral_starter',
    icon: '🤝',
    label: 'Connector',
    description: 'Invited your first friend to GamerGain',
    color: 'from-teal-400 to-cyan-500',
    border: 'border-teal-300',
    bg: 'bg-teal-50',
    category: 'Referrals',
    check: (s) => s.totalReferrals >= 1,
    progress: (s) => ({ current: Math.min(s.totalReferrals, 1), max: 1 }),
    reward: '$1.00 bonus',
  },
  {
    id: 'referral_king',
    icon: '👑',
    label: 'Referral King',
    description: 'Referred 10 friends who joined and stayed active',
    color: 'from-orange-400 to-red-500',
    border: 'border-orange-300',
    bg: 'bg-orange-50',
    category: 'Referrals',
    check: (s) => s.activeReferrals >= 10,
    progress: (s) => ({ current: Math.min(s.activeReferrals, 10), max: 10 }),
    reward: '$5.00 bonus',
  },
  {
    id: 'referral_legend',
    icon: '🌟',
    label: 'Referral Legend',
    description: 'Built a network of 50+ active referrals',
    color: 'from-pink-400 to-rose-500',
    border: 'border-pink-300',
    bg: 'bg-pink-50',
    category: 'Referrals',
    check: (s) => s.activeReferrals >= 50,
    progress: (s) => ({ current: Math.min(s.activeReferrals, 50), max: 50 }),
    reward: '$25.00 bonus',
  },
  {
    id: 'streak_7',
    icon: '🔥',
    label: '7-Day Streak',
    description: 'Logged in and earned for 7 days in a row',
    color: 'from-red-400 to-orange-500',
    border: 'border-red-300',
    bg: 'bg-red-50',
    category: 'Streaks',
    check: (s) => s.streakDays >= 7,
    progress: (s) => ({ current: Math.min(s.streakDays, 7), max: 7 }),
    reward: '$1.00 bonus',
  },
  {
    id: 'streak_30',
    icon: '⚡',
    label: 'Monthly Warrior',
    description: 'Maintained a 30-day earning streak',
    color: 'from-indigo-400 to-violet-600',
    border: 'border-indigo-300',
    bg: 'bg-indigo-50',
    category: 'Streaks',
    check: (s) => s.streakDays >= 30,
    progress: (s) => ({ current: Math.min(s.streakDays, 30), max: 30 }),
    reward: '$5.00 bonus',
  },
  {
    id: 'top_earner',
    icon: '💰',
    label: 'Top Earner',
    description: 'Earned $100 or more on the platform',
    color: 'from-green-500 to-emerald-600',
    border: 'border-green-400',
    bg: 'bg-green-50',
    category: 'Earnings',
    check: (s) => s.totalEarnings >= 100,
    progress: (s) => ({ current: Math.min(s.totalEarnings, 100), max: 100 }),
    reward: '$3.00 bonus',
  },
  {
    id: 'power_earner',
    icon: '🚀',
    label: 'Power Earner',
    description: 'Crossed $500 in lifetime earnings',
    color: 'from-amber-400 to-yellow-500',
    border: 'border-amber-300',
    bg: 'bg-amber-50',
    category: 'Earnings',
    check: (s) => s.totalEarnings >= 500,
    progress: (s) => ({ current: Math.min(s.totalEarnings, 500), max: 500 }),
    reward: '$15.00 bonus',
  },
  {
    id: 'loyal_member',
    icon: '🛡️',
    label: 'Loyal Member',
    description: 'Been a member for 30+ days',
    color: 'from-slate-400 to-gray-600',
    border: 'border-slate-300',
    bg: 'bg-slate-50',
    category: 'Milestones',
    check: (s) => s.memberDays >= 30,
    progress: (s) => ({ current: Math.min(s.memberDays, 30), max: 30 }),
    reward: '$1.00 bonus',
  },
  {
    id: 'quality_champion',
    icon: '⭐',
    label: 'Quality Champion',
    description: 'Maintained an 85+ quality score over 20 surveys',
    color: 'from-cyan-400 to-blue-500',
    border: 'border-cyan-300',
    bg: 'bg-cyan-50',
    category: 'Quality',
    check: (s) => s.avgQuality >= 85 && s.surveysCompleted >= 20,
    progress: (s) => ({ current: Math.min(Math.floor(s.avgQuality), 85), max: 85 }),
    reward: '$2.50 bonus',
  },
];

const CATEGORIES = ['All', 'Surveys', 'Referrals', 'Streaks', 'Earnings', 'Milestones', 'Quality'];

function BadgeCard({ badge, earned, progress, onClaim, claimed }) {
  const pct = Math.round((progress.current / progress.max) * 100);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative rounded-2xl border-2 p-4 transition-all ${
        earned
          ? `${badge.border} bg-white shadow-lg hover:shadow-xl`
          : 'border-gray-200 bg-gray-50 opacity-75'
      }`}
    >
      {/* Glow for newly earned */}
      {earned && !claimed && (
        <div className="absolute -top-1 -right-1">
          <span className="flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
          </span>
        </div>
      )}

      <div className="text-center mb-3">
        {/* Badge icon */}
        <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl mb-2 ${
          earned ? `bg-gradient-to-br ${badge.color} shadow-lg` : 'bg-gray-200'
        }`}>
          {earned ? badge.icon : <Lock className="w-7 h-7 text-gray-400" />}
        </div>
        <h3 className={`font-bold text-sm ${earned ? 'text-gray-900' : 'text-gray-400'}`}>
          {badge.label}
        </h3>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{badge.description}</p>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{progress.current}/{progress.max}</span>
          <span>{pct}%</span>
        </div>
        <Progress value={pct} className={`h-1.5 ${earned ? '[&>div]:bg-green-500' : '[&>div]:bg-gray-400'}`} />
      </div>

      {/* Reward */}
      <div className={`text-center text-xs px-2 py-1 rounded-full mb-2 ${badge.bg}`}>
        🎁 {badge.reward}
      </div>

      {/* Claim button */}
      {earned && !claimed && (
        <Button
          size="sm"
          className={`w-full text-xs h-7 bg-gradient-to-r ${badge.color} text-white border-0`}
          onClick={() => onClaim(badge)}
        >
          Claim Reward!
        </Button>
      )}
      {claimed && (
        <div className="flex items-center justify-center gap-1 text-xs text-green-600 font-semibold">
          <CheckCircle2 className="w-3 h-3" /> Claimed
        </div>
      )}
    </motion.div>
  );
}

export default function AchievementsPage() {
  const [user, setUser] = useState(null);
  const [category, setCategory] = useState('All');
  const [claimedIds, setClaimedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('claimed_badges') || '[]'); } catch { return []; }
  });
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: responses = [] } = useQuery({
    queryKey: ['ach_responses', user?.id],
    queryFn: () => base44.entities.PPCSurveyResponse.filter({ user_id: user.id, completed: true }, '-created_date', 500),
    enabled: !!user?.id,
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ['ach_referrals', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id }),
    enabled: !!user?.id,
  });

  const { data: streak = null } = useQuery({
    queryKey: ['ach_streak', user?.id],
    queryFn: async () => {
      const r = await base44.entities.Streak.filter({ user_id: user.id });
      return r[0] || null;
    },
    enabled: !!user?.id,
  });

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
    </div>
  );

  const memberDays = user.created_date ? Math.floor((Date.now() - new Date(user.created_date)) / 86400000) : 0;
  const avgQuality = responses.length > 0
    ? responses.reduce((s, r) => s + (r.quality_score || 70), 0) / responses.length : 0;
  const activeReferrals = referrals.filter(r => r.status === 'active').length;

  const stats = {
    surveysCompleted: responses.length,
    totalReferrals: referrals.length,
    activeReferrals,
    totalEarnings: user.total_earnings || 0,
    memberDays,
    streakDays: streak?.current_streak || 0,
    avgQuality,
  };

  const badgesWithStatus = BADGE_CATALOG.map(b => ({
    ...b,
    earned: b.check(stats),
    progress: b.progress(stats),
    claimed: claimedIds.includes(b.id),
  }));

  const earnedCount = badgesWithStatus.filter(b => b.earned).length;
  const filtered = category === 'All' ? badgesWithStatus : badgesWithStatus.filter(b => b.category === category);

  const handleClaim = async (badge) => {
    const newClaimed = [...claimedIds, badge.id];
    setClaimedIds(newClaimed);
    localStorage.setItem('claimed_badges', JSON.stringify(newClaimed));

    // Parse reward amount
    const amountMatch = badge.reward.match(/\$([0-9.]+)/);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;
    if (amount > 0) {
      const newBalance = parseFloat(((user.current_balance || 0) + amount).toFixed(2));
      await base44.auth.updateMe({ current_balance: newBalance });
      setUser(prev => ({ ...prev, current_balance: newBalance }));
    }

    toast.success(`🎉 ${badge.label} claimed! +${badge.reward}`, { duration: 5000 });

    // Create a notification
    await base44.entities.Notification.create({
      user_id: user.id,
      type: 'achievement_unlocked',
      title: `🏅 Badge Unlocked: ${badge.label}`,
      message: `You earned the "${badge.label}" badge and ${badge.reward}!`,
      status: 'unread',
      delivery_method: ['in_app'],
    }).catch(() => {});
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center py-6">
          <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-gray-900">Achievements</h1>
          <p className="text-gray-500 mt-1">Earn badges, build your status, collect rewards</p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Badges Earned', value: earnedCount, total: BADGE_CATALOG.length, icon: '🏅', color: 'from-violet-500 to-purple-600' },
            { label: 'Total Rewards', value: `$${badgesWithStatus.filter(b => b.earned && b.claimed).reduce((s, b) => { const m = b.reward.match(/\$([0-9.]+)/); return s + (m ? parseFloat(m[1]) : 0); }, 0).toFixed(2)}`, icon: '💰', color: 'from-green-500 to-emerald-600' },
            { label: 'Surveys Done', value: stats.surveysCompleted, icon: '📋', color: 'from-blue-500 to-cyan-600' },
          ].map(s => (
            <Card key={s.label} className="border-0 shadow-lg overflow-hidden">
              <div className={`bg-gradient-to-br ${s.color} p-4 text-white text-center`}>
                <div className="text-2xl mb-1">{s.icon}</div>
                <p className="text-2xl font-black">{s.value}{s.total ? `/${s.total}` : ''}</p>
                <p className="text-white/80 text-xs">{s.label}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Progress bar */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-gray-800 text-sm">Collection Progress</span>
              <span className="text-violet-600 font-bold text-sm">{earnedCount}/{BADGE_CATALOG.length} badges</span>
            </div>
            <Progress value={(earnedCount / BADGE_CATALOG.length) * 100} className="h-3 [&>div]:bg-gradient-to-r [&>div]:from-violet-500 [&>div]:to-indigo-600" />
            <p className="text-xs text-gray-400 mt-1">{BADGE_CATALOG.length - earnedCount} badges remaining to unlock</p>
          </CardContent>
        </Card>

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                category === cat
                  ? 'bg-violet-600 text-white border-violet-600 shadow-md'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Badge grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <AnimatePresence>
            {filtered.map(badge => (
              <BadgeCard
                key={badge.id}
                badge={badge}
                earned={badge.earned}
                progress={badge.progress}
                claimed={badge.claimed}
                onClaim={handleClaim}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Profile CTA */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
          <CardContent className="p-6 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="font-bold text-lg">Show off your badges!</h3>
              <p className="text-violet-200 text-sm">Earned badges appear on your public profile for the community to see.</p>
            </div>
            <Link to={createPageUrl('UserProfile')}>
              <Button className="bg-white text-violet-700 hover:bg-violet-50 font-bold">
                View My Profile
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
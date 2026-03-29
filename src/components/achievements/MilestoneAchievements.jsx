import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export const MILESTONE_BADGES = [
  // Surveys
  { key: 'first_survey',    emoji: '🎯', label: 'First Step',        desc: 'Complete your first survey',          color: 'bg-blue-100 text-blue-700 border-blue-300',       cat: 'Surveys',    check: s => s.surveysCompleted >= 1,    progress: s => [s.surveysCompleted, 1] },
  { key: 'survey_10',       emoji: '📋', label: '10 Surveys',        desc: 'Complete 10 surveys',                 color: 'bg-sky-100 text-sky-700 border-sky-300',           cat: 'Surveys',    check: s => s.surveysCompleted >= 10,   progress: s => [s.surveysCompleted, 10] },
  { key: 'survey_pro',      emoji: '⭐', label: 'Survey Pro',        desc: 'Complete 50 surveys',                 color: 'bg-yellow-100 text-yellow-700 border-yellow-300',  cat: 'Surveys',    check: s => s.surveysCompleted >= 50,   progress: s => [s.surveysCompleted, 50] },
  { key: 'survey_legend',   emoji: '🏆', label: 'Survey Legend',     desc: 'Complete 200 surveys',                color: 'bg-purple-100 text-purple-700 border-purple-300', cat: 'Surveys',    check: s => s.surveysCompleted >= 200,  progress: s => [s.surveysCompleted, 200] },
  { key: 'accuracy_king',   emoji: '🎖️', label: 'Accuracy King',    desc: '90+ quality across 20 surveys',       color: 'bg-green-100 text-green-700 border-green-300',    cat: 'Quality',    check: s => s.avgQuality >= 90 && s.surveysCompleted >= 20, progress: s => [Math.min(s.avgQuality, 90), 90] },
  { key: 'quality_champ',   emoji: '✨', label: 'Quality Champion',  desc: '50 surveys with 85+ score',           color: 'bg-cyan-100 text-cyan-700 border-cyan-300',       cat: 'Quality',    check: s => s.highQualityCompletions >= 50, progress: s => [s.highQualityCompletions, 50] },
  // Earnings
  { key: 'earner_first_50', emoji: '💵', label: 'First $50',         desc: 'Earn your first $50',                 color: 'bg-emerald-100 text-emerald-700 border-emerald-300', cat: 'Earnings', check: s => s.totalEarnings >= 50,      progress: s => [s.totalEarnings, 50] },
  { key: 'top_earner',      emoji: '💰', label: 'Top Earner',        desc: 'Earn $100+ total',                    color: 'bg-green-100 text-green-700 border-green-300',    cat: 'Earnings',   check: s => s.totalEarnings >= 100,     progress: s => [s.totalEarnings, 100] },
  { key: 'earner_500',      emoji: '🤑', label: 'High Roller',       desc: 'Earn $500+ total',                    color: 'bg-lime-100 text-lime-700 border-lime-300',       cat: 'Earnings',   check: s => s.totalEarnings >= 500,     progress: s => [s.totalEarnings, 500] },
  // Streaks
  { key: 'streak_7',        emoji: '🔥', label: '7-Day Streak',      desc: 'Complete surveys 7 days in a row',    color: 'bg-rose-100 text-rose-700 border-rose-300',       cat: 'Streaks',    check: s => s.streakDays >= 7,          progress: s => [s.streakDays, 7] },
  { key: 'streak_30',       emoji: '🌟', label: 'Monthly Warrior',   desc: '30-day survey streak',                color: 'bg-amber-100 text-amber-700 border-amber-300',    cat: 'Streaks',    check: s => s.streakDays >= 30,         progress: s => [s.streakDays, 30] },
  { key: 'streak_10',       emoji: '⚡', label: '10-Day Streak',     desc: 'Complete surveys 10 days in a row',   color: 'bg-orange-100 text-orange-700 border-orange-300', cat: 'Streaks',    check: s => s.streakDays >= 10,         progress: s => [s.streakDays, 10] },
  // Referrals
  { key: 'referral_starter',emoji: '🤝', label: 'Connector',         desc: 'Refer your first user',               color: 'bg-teal-100 text-teal-700 border-teal-300',       cat: 'Referrals',  check: s => s.totalReferrals >= 1,      progress: s => [s.totalReferrals, 1] },
  { key: 'referral_master', emoji: '👑', label: 'Referral Master',   desc: '10+ active referrals',                color: 'bg-red-100 text-red-700 border-red-300',          cat: 'Referrals',  check: s => s.activeReferrals >= 10,    progress: s => [s.activeReferrals, 10] },
  { key: 'referral_legend', emoji: '💎', label: 'Referral Legend',   desc: '25+ active referrals',                color: 'bg-indigo-100 text-indigo-700 border-indigo-300', cat: 'Referrals',  check: s => s.activeReferrals >= 25,    progress: s => [s.activeReferrals, 25] },
  // Prestige
  { key: 'top_10pct',       emoji: '🥇', label: 'Top 10% Contributor', desc: 'Reach Gold prestige tier',          color: 'bg-yellow-100 text-yellow-700 border-yellow-300', cat: 'Prestige',   check: s => (s.prestigeScore || 0) >= 400, progress: s => [s.prestigeScore || 0, 400] },
  { key: 'loyal_member',    emoji: '🛡️', label: 'Loyal Member',     desc: 'Member for 30+ days',                 color: 'bg-slate-100 text-slate-700 border-slate-300',    cat: 'Loyalty',    check: s => s.memberDays >= 30,         progress: s => [s.memberDays, 30] },
];

const CATEGORIES = ['All', 'Surveys', 'Earnings', 'Streaks', 'Referrals', 'Quality', 'Prestige', 'Loyalty'];

// Auto-awards badges when milestones are hit
export function useMilestoneAwarder(user, stats) {
  const qc = useQueryClient();
  const { data: earned = [] } = useQuery({
    queryKey: ['milestone_badges', user?.id],
    queryFn: () => base44.entities.Badge.filter({ user_id: user.id }),
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!user?.id || !stats) return;
    const earnedKeys = new Set(earned.map(b => b.badge_key));
    const toAward = MILESTONE_BADGES.filter(b => !earnedKeys.has(b.key) && b.check(stats));
    toAward.forEach(async (b) => {
      await base44.entities.Badge.create({ user_id: user.id, badge_key: b.key, earned_at: new Date().toISOString() });
      toast.success(`🏅 ${b.emoji} Badge Unlocked: ${b.label}!`, { description: b.desc });
      qc.invalidateQueries({ queryKey: ['milestone_badges', user.id] });
    });
  }, [user?.id, stats?.surveysCompleted, stats?.totalEarnings, stats?.streakDays, stats?.activeReferrals, stats?.prestigeScore]);

  return { earned };
}

export default function MilestoneAchievements({ userId, stats, compact = false }) {
  const [activecat, setActivecat] = useState('All');

  const { data: earned = [] } = useQuery({
    queryKey: ['milestone_badges', userId],
    queryFn: () => base44.entities.Badge.filter({ user_id: userId }),
    enabled: !!userId,
  });

  const earnedKeys = new Set(earned.map(b => b.badge_key));
  const filtered = MILESTONE_BADGES.filter(b => activecat === 'All' || b.cat === activecat);
  const earnedCount = MILESTONE_BADGES.filter(b => earnedKeys.has(b.key)).length;

  if (compact) {
    const earnedBadges = MILESTONE_BADGES.filter(b => earnedKeys.has(b.key));
    return (
      <div className="flex flex-wrap gap-1.5">
        {earnedBadges.slice(0, 8).map(b => (
          <span key={b.key} title={b.desc}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${b.color}`}>
            {b.emoji} {b.label}
          </span>
        ))}
        {earnedBadges.length > 8 && <span className="text-xs text-gray-400 self-center">+{earnedBadges.length - 8}</span>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-bold text-gray-900">🏅 Milestone Achievements</h3>
          <p className="text-xs text-gray-500">{earnedCount}/{MILESTONE_BADGES.length} badges earned</p>
        </div>
        <Progress value={(earnedCount / MILESTONE_BADGES.length) * 100} className="w-32 h-2" />
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map(cat => (
          <button key={cat}
            onClick={() => setActivecat(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${activecat === cat ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}`}>
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        <AnimatePresence mode="popLayout">
          {filtered.map(b => {
            const isEarned = earnedKeys.has(b.key);
            const [cur, max] = stats ? b.progress(stats) : [0, 1];
            const pct = Math.min(100, (cur / max) * 100);
            const earnedRecord = earned.find(e => e.badge_key === b.key);
            return (
              <motion.div key={b.key} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <div className={`rounded-xl border-2 p-3 text-center transition-all h-full flex flex-col ${isEarned ? `${b.color} shadow-md` : 'bg-gray-50 border-gray-200 opacity-50'}`}>
                  <div className="text-3xl mb-1">{b.emoji}</div>
                  <p className="text-xs font-bold leading-tight">{b.label}</p>
                  <p className="text-xs opacity-70 mt-0.5 flex-1">{b.desc}</p>
                  {isEarned ? (
                    <p className="text-xs font-semibold mt-2 opacity-80">
                      ✓ {earnedRecord?.earned_at ? new Date(earnedRecord.earned_at).toLocaleDateString() : 'Earned'}
                    </p>
                  ) : stats ? (
                    <div className="mt-2">
                      <Progress value={pct} className="h-1.5" />
                      <p className="text-xs opacity-60 mt-1">{Math.min(cur, max).toFixed(0)}/{max}</p>
                    </div>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
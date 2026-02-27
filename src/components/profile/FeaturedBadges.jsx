import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Award, Check, Star } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Trophy, Users, Target, Zap, Shield, ClipboardList, Crown, Medal, ShoppingBag, Flame } from 'lucide-react';

const ALL_BADGES = [
  { id: 'first_survey',   icon: ClipboardList, label: 'First Survey',     color: 'text-blue-600',   bg: 'bg-blue-100',   threshold: (s) => (s.totalSurveys || 0) >= 1 },
  { id: 'survey_master',  icon: Trophy,        label: 'Survey Master',    color: 'text-yellow-600', bg: 'bg-yellow-100', threshold: (s) => (s.totalSurveys || 0) >= 25 },
  { id: 'survey_champ',   icon: Medal,         label: 'Survey Champion',  color: 'text-amber-600',  bg: 'bg-amber-100',  threshold: (s) => (s.totalSurveys || 0) >= 50 },
  { id: 'first_referral', icon: Users,         label: 'First Referral',   color: 'text-green-600',  bg: 'bg-green-100',  threshold: (s) => (s.totalReferrals || 0) >= 1 },
  { id: 'top_referrer',   icon: Crown,         label: 'Top Referrer',     color: 'text-purple-600', bg: 'bg-purple-100', threshold: (s) => (s.activeReferrals || 0) >= 10 },
  { id: 'first_purchase', icon: ShoppingBag,   label: 'First Purchase',   color: 'text-teal-600',   bg: 'bg-teal-100',   threshold: (s) => (s.purchases || 0) >= 1 },
  { id: 'daily_goal',     icon: Target,        label: 'Daily Achiever',   color: 'text-teal-600',   bg: 'bg-teal-100',   threshold: (s) => (s.daysGoalMet || 0) >= 1 },
  { id: 'streak_7',       icon: Flame,         label: '7-Day Streak',     color: 'text-orange-600', bg: 'bg-orange-100', threshold: (s) => (s.streakDays || 0) >= 7 },
  { id: 'earner_10',      icon: Star,          label: 'Power Earner',     color: 'text-pink-600',   bg: 'bg-pink-100',   threshold: (s) => (s.totalEarnings || 0) >= 10 },
  { id: 'top_earner',     icon: Zap,           label: 'Top Earner',       color: 'text-red-600',    bg: 'bg-red-100',    threshold: (s) => (s.totalEarnings || 0) >= 100 },
  { id: 'shield',         icon: Shield,        label: 'Loyal Member',     color: 'text-indigo-600', bg: 'bg-indigo-100', threshold: (s) => (s.memberDays || 0) >= 30 },
];

const MAX_FEATURED = 3;

export default function FeaturedBadges({ user, userStats, onUpdate }) {
  const [selecting, setSelecting] = useState(false);
  const [featured, setFeatured] = useState(user?.featured_badges || []);
  const [saving, setSaving] = useState(false);

  const earnedBadges = ALL_BADGES.filter(b => b.threshold(userStats));
  const displayBadges = ALL_BADGES.filter(b => featured.includes(b.id));

  const toggle = (id) => {
    setFeatured(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < MAX_FEATURED ? [...prev, id] : prev
    );
  };

  const save = async () => {
    setSaving(true);
    await base44.auth.updateMe({ featured_badges: featured });
    onUpdate({ featured_badges: featured });
    setSaving(false);
    setSelecting(false);
    toast.success('Featured badges updated!');
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-500" />
            Featured Badges
            <span className="text-xs text-gray-400 font-normal">(up to {MAX_FEATURED})</span>
          </div>
          {earnedBadges.length > 0 && !selecting && (
            <Button size="sm" variant="ghost" onClick={() => setSelecting(true)}>
              <Star className="w-4 h-4 mr-1" /> Customize
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {selecting ? (
          <div>
            <p className="text-xs text-gray-500 mb-3">Select up to {MAX_FEATURED} badges to showcase ({featured.length}/{MAX_FEATURED} selected)</p>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {earnedBadges.map(badge => {
                const Icon = badge.icon;
                const isFeatured = featured.includes(badge.id);
                return (
                  <button
                    key={badge.id}
                    onClick={() => toggle(badge.id)}
                    className={`relative flex flex-col items-center p-2 rounded-xl border-2 transition-all text-center ${
                      isFeatured ? `${badge.bg} border-current` : 'bg-gray-50 border-gray-200 opacity-60'
                    }`}
                  >
                    <Icon className={`w-6 h-6 mb-1 ${isFeatured ? badge.color : 'text-gray-400'}`} />
                    <p className={`text-[10px] font-semibold leading-tight ${isFeatured ? badge.color : 'text-gray-400'}`}>{badge.label}</p>
                    {isFeatured && <Check className="absolute top-1 right-1 w-3 h-3 text-green-600" />}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => { setFeatured(user?.featured_badges || []); setSelecting(false); }}>Cancel</Button>
              <Button size="sm" className="flex-1" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            </div>
          </div>
        ) : displayBadges.length > 0 ? (
          <div className="flex gap-4 flex-wrap">
            {displayBadges.map((badge, idx) => {
              const Icon = badge.icon;
              return (
                <motion.div
                  key={badge.id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`flex flex-col items-center p-4 rounded-xl ${badge.bg} border-2 border-current text-center min-w-[80px]`}
                >
                  <Icon className={`w-10 h-10 mb-1 ${badge.color}`} />
                  <p className={`text-xs font-bold ${badge.color}`}>{badge.label}</p>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">
            {earnedBadges.length === 0
              ? 'Earn badges by completing actions to feature them here!'
              : 'Click Customize to pick which badges to showcase.'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
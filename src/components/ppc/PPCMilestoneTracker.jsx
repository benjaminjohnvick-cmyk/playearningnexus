import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Star, Zap, TrendingUp, Lock, CheckCircle2, Gift, Crown, Sparkles } from 'lucide-react';
import canvas from 'canvas-confetti';

const MILESTONES = [
  { id: 'first_survey',   label: '1st Survey',       icon: '🎯', type: 'surveys',  target: 1,    reward: 'Unlock Daily Streak Bonus',         multiplier: null,   tier3: false },
  { id: 'surveys_10',     label: '10 Surveys',        icon: '⚡', type: 'surveys',  target: 10,   reward: '1.1x Earnings Multiplier',          multiplier: 1.1,    tier3: false },
  { id: 'surveys_50',     label: '50 Surveys',        icon: '🔥', type: 'surveys',  target: 50,   reward: '1.25x Earnings Multiplier',         multiplier: 1.25,   tier3: false },
  { id: 'surveys_100',    label: '100 Surveys',       icon: '💯', type: 'surveys',  target: 100,  reward: '1.5x Multiplier + Tier 2 Access',   multiplier: 1.5,    tier3: false },
  { id: 'surveys_500',    label: '500 Surveys',       icon: '🚀', type: 'surveys',  target: 500,  reward: '2x Multiplier + Priority Slots',    multiplier: 2.0,    tier3: false },
  { id: 'earned_10',      label: '$10 Earned',        icon: '💵', type: 'earnings', target: 10,   reward: 'Unlock Extended Sessions',          multiplier: null,   tier3: false },
  { id: 'earned_100',     label: '$100 Earned',       icon: '💰', type: 'earnings', target: 100,  reward: '1.2x Earnings Multiplier',          multiplier: 1.2,    tier3: false },
  { id: 'earned_500',     label: '$500 Earned',       icon: '🤑', type: 'earnings', target: 500,  reward: '1.75x Multiplier + Bonus Surveys',  multiplier: 1.75,   tier3: false },
  { id: 'earned_1000',    label: '$1,000 Earned',     icon: '👑', type: 'earnings', target: 1000, reward: '2.5x Multiplier + Tier 3 Preview',  multiplier: 2.5,    tier3: true  },
  { id: 'earned_5000',    label: '$5,000 Earned',     icon: '🏆', type: 'earnings', target: 5000, reward: 'Full Tier 3 Brand Partner Access',  multiplier: 3.0,    tier3: true  },
  { id: 'referrals_5',    label: '5 Referrals',       icon: '👥', type: 'referrals',target: 5,    reward: 'Referral Bonus Boost +10%',         multiplier: null,   tier3: false },
  { id: 'referrals_25',   label: '25 Referrals',      icon: '🌟', type: 'referrals',target: 25,   reward: 'Elite Referrer Status',             multiplier: null,   tier3: false },
];

function LevelUpOverlay({ milestone, onClose }) {
  const confettiRef = useRef(false);

  useEffect(() => {
    if (confettiRef.current) return;
    confettiRef.current = true;
    const end = Date.now() + 3000;
    const frame = () => {
      canvas.create(null, { resize: true })({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#FFD700', '#FF6B35', '#7C3AED'],
      });
      canvas.create(null, { resize: true })({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#FFD700', '#FF6B35', '#7C3AED'],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.5, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="bg-gradient-to-br from-yellow-400 via-orange-500 to-purple-600 rounded-3xl p-8 text-center text-white shadow-2xl max-w-sm mx-4"
        onClick={e => e.stopPropagation()}
      >
        <motion.div
          animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 0.6 }}
          className="text-6xl mb-3"
        >
          {milestone.icon}
        </motion.div>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Badge className="bg-white/20 text-white text-sm mb-3 px-4 py-1">
            <Sparkles className="w-3.5 h-3.5 inline mr-1" /> LEVEL UP!
          </Badge>
          <h2 className="text-3xl font-black mb-1">{milestone.label}</h2>
          <p className="text-white/90 text-sm mb-4">Milestone unlocked!</p>
          <div className="bg-white/20 rounded-2xl p-4 mb-4">
            <Gift className="w-6 h-6 mx-auto mb-1 text-yellow-200" />
            <p className="font-bold text-base">{milestone.reward}</p>
            {milestone.multiplier && (
              <p className="text-yellow-200 text-sm mt-1">{milestone.multiplier}x earnings multiplier activated!</p>
            )}
            {milestone.tier3 && (
              <Badge className="mt-2 bg-yellow-300 text-yellow-900 text-xs">
                <Crown className="w-3 h-3 inline mr-1" /> Tier 3 Brand Access
              </Badge>
            )}
          </div>
          <Button onClick={onClose} className="bg-white text-purple-700 hover:bg-yellow-50 font-bold">
            Claim Reward 🎉
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

export default function PPCMilestoneTracker({ user }) {
  const [levelUpMilestone, setLevelUpMilestone] = useState(null);
  const completedRef = useRef(new Set());

  const { data: responses = [] } = useQuery({
    queryKey: ['user-responses-milestones', user?.id],
    queryFn: () => base44.entities.PPCSurveyResponse.filter({ user_id: user.id }),
    enabled: !!user,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['user-tx-milestones', user?.id],
    queryFn: () => base44.entities.PPCTransaction.filter({ user_id: user.id }),
    enabled: !!user,
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ['user-referrals-milestones', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id }),
    enabled: !!user,
  });

  const surveysCompleted = responses.filter(r => r.completed).length;
  const totalEarned = transactions
    .filter(t => ['ppc_earning', 'survey_payout'].includes(t.transaction_type))
    .reduce((s, t) => s + (t.net_amount || t.amount || 0), 0);
  const referralCount = referrals.length;

  const getValue = (m) => {
    if (m.type === 'surveys') return surveysCompleted;
    if (m.type === 'earnings') return totalEarned;
    if (m.type === 'referrals') return referralCount;
    return 0;
  };

  // Load already-completed milestones from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`ppc_milestones_${user?.id}`) || '[]');
      saved.forEach(id => completedRef.current.add(id));
    } catch {}
  }, [user?.id]);

  // Fire Level Up when a new milestone crosses threshold
  useEffect(() => {
    if (!user) return;
    for (const m of MILESTONES) {
      const val = getValue(m);
      if (val >= m.target && !completedRef.current.has(m.id)) {
        completedRef.current.add(m.id);
        try {
          localStorage.setItem(`ppc_milestones_${user.id}`, JSON.stringify([...completedRef.current]));
        } catch {}
        setLevelUpMilestone(m);
        break; // show one at a time
      }
    }
  }, [surveysCompleted, totalEarned, referralCount]);

  const activeMultiplier = MILESTONES
    .filter(m => getValue(m) >= m.target && m.multiplier)
    .reduce((best, m) => Math.max(best, m.multiplier), 1.0);

  const hasTier3Preview = MILESTONES
    .filter(m => m.tier3)
    .some(m => getValue(m) >= m.target);

  return (
    <>
      <AnimatePresence>
        {levelUpMilestone && (
          <LevelUpOverlay
            milestone={levelUpMilestone}
            onClose={() => setLevelUpMilestone(null)}
          />
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {/* Active benefits banner */}
        {activeMultiplier > 1 && (
          <Card className="border-2 border-yellow-300 bg-gradient-to-r from-yellow-50 to-orange-50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900 text-sm">Active Multiplier: {activeMultiplier}x</p>
                <p className="text-xs text-gray-500">All survey earnings are boosted by your milestone multiplier</p>
              </div>
              {hasTier3Preview && (
                <Badge className="bg-yellow-100 text-yellow-800 text-xs flex-shrink-0">
                  <Crown className="w-3 h-3 inline mr-1" /> Tier 3 Access
                </Badge>
              )}
            </CardContent>
          </Card>
        )}

        {/* Progress header */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" /> Milestone Progress
          </h3>
          <div className="flex gap-3 text-xs text-gray-500">
            <span className="font-semibold text-gray-700">{surveysCompleted} surveys</span>
            <span>·</span>
            <span className="font-semibold text-green-600">${totalEarned.toFixed(2)} earned</span>
          </div>
        </div>

        {/* Category groups */}
        {[
          { label: '📋 Survey Milestones', filter: 'surveys' },
          { label: '💰 Earnings Milestones', filter: 'earnings' },
          { label: '👥 Referral Milestones', filter: 'referrals' },
        ].map(group => (
          <div key={group.filter}>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{group.label}</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {MILESTONES.filter(m => m.type === group.filter).map(m => {
                const val = getValue(m);
                const completed = val >= m.target;
                const pct = Math.min(100, (val / m.target) * 100);
                return (
                  <div
                    key={m.id}
                    className={`border-2 rounded-xl p-3 transition-all ${completed ? 'border-yellow-300 bg-yellow-50' : 'border-gray-100 bg-white'}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{m.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-bold text-gray-900">{m.label}</p>
                          {completed && <Badge className="bg-yellow-100 text-yellow-700 text-xs">✓ Unlocked</Badge>}
                          {m.tier3 && <Badge className="bg-purple-100 text-purple-700 text-xs">Tier 3</Badge>}
                        </div>
                        <p className="text-xs text-gray-500">{m.reward}</p>
                      </div>
                      {!completed && <Lock className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />}
                      {completed && <CheckCircle2 className="w-4 h-4 text-yellow-500 flex-shrink-0" />}
                    </div>
                    <div className="space-y-1">
                      <Progress value={pct} className="h-1.5" />
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>
                          {m.type === 'earnings' ? `$${val.toFixed(0)}` : val} / {m.type === 'earnings' ? `$${m.target.toLocaleString()}` : m.target}
                        </span>
                        <span>{Math.round(pct)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
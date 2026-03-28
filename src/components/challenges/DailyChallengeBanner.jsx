import React, { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Zap, Clock, Gift, CheckCircle2, Loader2 } from 'lucide-react';
import { format, differenceInHours, endOfDay } from 'date-fns';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

// Daily challenge definitions — rotates by day-of-week
const DAILY_TEMPLATES = [
  { id: 'daily_5_surveys',  title: 'Survey Sprint',       description: 'Complete 5 surveys today',            metric: 'surveys_today',  target: 5,  bonus: 2.00, color: 'from-blue-500 to-indigo-500' },
  { id: 'daily_quality_85', title: 'Quality Champion',    description: 'Avg quality score ≥ 85 today',        metric: 'quality_today',  target: 85, bonus: 1.50, color: 'from-amber-500 to-orange-500' },
  { id: 'daily_earn_5',     title: 'Earn $5 Today',       description: 'Earn at least $5 from surveys today', metric: 'earned_today',   target: 5,  bonus: 1.00, color: 'from-green-500 to-emerald-500' },
  { id: 'daily_3_surveys',  title: 'Quick Starter',       description: 'Complete 3 surveys before noon',      metric: 'surveys_today',  target: 3,  bonus: 0.75, color: 'from-purple-500 to-violet-500' },
  { id: 'daily_10_surveys', title: 'Power Surveyor',      description: 'Complete 10 surveys today',           metric: 'surveys_today',  target: 10, bonus: 5.00, color: 'from-red-500 to-rose-500' },
  { id: 'daily_earn_3',     title: 'Daily $3 Goal',       description: 'Earn $3 from surveys today',          metric: 'earned_today',   target: 3,  bonus: 0.50, color: 'from-teal-500 to-cyan-500' },
  { id: 'daily_no_flags',   title: 'Clean Sweep',         description: 'Complete 3 surveys with no flags',    metric: 'surveys_today',  target: 3,  bonus: 1.25, color: 'from-pink-500 to-fuchsia-500' },
];

export default function DailyChallengeBanner({ user }) {
  const qc = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const dayOfWeek = new Date().getDay();
  const challenge = DAILY_TEMPLATES[dayOfWeek % DAILY_TEMPLATES.length];
  const hoursLeft = differenceInHours(endOfDay(new Date()), new Date());

  const { data: todayEarnings } = useQuery({
    queryKey: ['daily-banner-earnings', user?.id, today],
    queryFn: () => base44.entities.DailyEarnings.filter({ user_id: user.id, date: today }).then(r => r[0] || null),
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  const { data: claimedPayouts = [] } = useQuery({
    queryKey: ['daily-claimed', user?.id, today],
    queryFn: () => base44.entities.Payout.filter({ user_id: user.id, payout_type: 'contest_win' }, '-created_date', 20),
    enabled: !!user?.id,
  });

  const isClaimed = claimedPayouts.some(p => p.description?.includes(`[${challenge.id}_${today}]`));

  const progress = useMemo(() => {
    if (!todayEarnings) return { value: 0, pct: 0, complete: false };
    let value = 0;
    if (challenge.metric === 'surveys_today') value = todayEarnings.total_surveys_completed || 0;
    if (challenge.metric === 'earned_today') value = todayEarnings.total_earned || 0;
    if (challenge.metric === 'quality_today') value = todayEarnings.avg_quality_score || 0;
    const pct = Math.min((value / challenge.target) * 100, 100);
    return { value, pct, complete: value >= challenge.target };
  }, [todayEarnings, challenge]);

  const claimMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Payout.create({
        user_id: user.id,
        recipient_type: 'user',
        recipient_id: user.id,
        recipient_email: user.email,
        amount: challenge.bonus,
        currency: 'USD',
        method: 'paypal',
        payout_type: 'contest_win',
        status: 'pending',
        description: `Daily challenge reward [${challenge.id}_${today}]: ${challenge.title} — $${challenge.bonus.toFixed(2)} bonus`,
      });
      await base44.entities.Notification.create({
        user_id: user.id,
        type: 'achievement_unlocked',
        title: `🎯 Daily Challenge Complete!`,
        message: `You completed "${challenge.title}" and earned a $${challenge.bonus.toFixed(2)} bonus!`,
        status: 'unread',
        delivery_method: ['in_app'],
      });
    },
    onSuccess: () => {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
      toast.success(`🎉 $${challenge.bonus.toFixed(2)} bonus earned!`);
      qc.invalidateQueries(['daily-claimed']);
    },
    onError: () => toast.error('Failed to claim. Please try again.'),
  });

  const metricLabel = challenge.metric === 'surveys_today'
    ? `${Math.min(progress.value, challenge.target)}/${challenge.target} surveys`
    : challenge.metric === 'earned_today'
      ? `$${Math.min(progress.value, challenge.target).toFixed(2)} / $${challenge.target}`
      : `${Math.min(progress.value, challenge.target)} / ${challenge.target}`;

  return (
    <Card className={`border-0 shadow-lg overflow-hidden bg-gradient-to-r ${challenge.color}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-white" />
              <span className="text-white font-bold text-sm">Daily Challenge</span>
              <Badge className="bg-white/20 text-white border-0 text-xs">
                <Clock className="w-3 h-3 mr-1" />{hoursLeft}h left
              </Badge>
            </div>
            <p className="text-white font-black text-lg leading-tight">{challenge.title}</p>
            <p className="text-white/80 text-xs mt-0.5">{challenge.description}</p>

            {/* Progress */}
            <div className="mt-3">
              <div className="flex justify-between text-white/80 text-xs mb-1">
                <span>{metricLabel}</span>
                <span>{Math.round(progress.pct)}%</span>
              </div>
              <div className="h-2 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-700"
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="text-right">
              <p className="text-white font-black text-xl">${challenge.bonus.toFixed(2)}</p>
              <p className="text-white/70 text-xs">bonus</p>
            </div>
            {isClaimed ? (
              <div className="flex items-center gap-1 bg-white/20 text-white text-xs px-3 py-1.5 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" /> Claimed
              </div>
            ) : progress.complete ? (
              <Button
                size="sm"
                onClick={() => claimMutation.mutate()}
                disabled={claimMutation.isPending}
                className="bg-white text-gray-900 hover:bg-white/90 font-bold text-xs h-8"
              >
                {claimMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Gift className="w-3.5 h-3.5 mr-1" />Claim!</>}
              </Button>
            ) : (
              <div className="text-white/60 text-xs text-right">
                {100 - Math.round(progress.pct)}% to go
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
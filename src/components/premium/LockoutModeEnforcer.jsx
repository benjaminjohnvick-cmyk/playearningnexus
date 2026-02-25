import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, DollarSign, Clock, TrendingUp } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import ScheduleNextSessionModal from './ScheduleNextSessionModal';

export default function LockoutModeEnforcer({ user }) {
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: membership } = useQuery({
    queryKey: ['premium-membership', user.id],
    queryFn: () => base44.entities.PremiumMembership.filter({ user_id: user.id }).then(m => m[0]),
    enabled: !!user
  });

  const { data: todaySession, isLoading } = useQuery({
    queryKey: ['lockout-session', user.id, today],
    queryFn: () => base44.entities.LockoutSession.filter({ 
      user_id: user.id, 
      session_date: today 
    }).then(s => s[0]),
    enabled: !!user && !!membership?.lockout_mode_enabled,
    refetchInterval: 5000
  });

  const { data: dailyEarnings } = useQuery({
    queryKey: ['daily-earnings', user.id, today],
    queryFn: () => base44.entities.DailyEarnings.filter({ 
      user_id: user.id, 
      date: today 
    }).then(e => e[0]),
    enabled: !!user,
    refetchInterval: 5000
  });

  useEffect(() => {
    if (membership?.lockout_mode_enabled && !todaySession) {
      createSession();
    }
  }, [membership, todaySession]);

  useEffect(() => {
    if (todaySession && dailyEarnings && !todaySession.goal_met) {
      const earned = dailyEarnings.total_earned || 0;
      if (earned >= todaySession.goal_amount) {
        markGoalMet();
      } else {
        updateSessionEarnings(earned);
      }
    }
  }, [dailyEarnings, todaySession]);

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      return base44.entities.LockoutSession.create({
        user_id: user.id,
        session_date: today,
        scheduled_start_time: membership.next_session_scheduled_time || new Date().toISOString(),
        actual_start_time: new Date().toISOString(),
        goal_amount: membership.daily_goal || 3,
        status: 'active',
        phone_locked: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['lockout-session']);
    }
  });

  const updateEarningsMutation = useMutation({
    mutationFn: (earned) => base44.entities.LockoutSession.update(todaySession.id, {
      amount_earned: earned
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['lockout-session']);
    }
  });

  const markGoalMetMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.LockoutSession.update(todaySession.id, {
        goal_met: true,
        status: 'goal_met',
        phone_locked: false
      });
      await base44.entities.PremiumMembership.update(membership.id, {
        days_completed: (membership.days_completed || 0) + 1
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['lockout-session']);
      queryClient.invalidateQueries(['premium-membership']);
      setShowScheduleModal(true);
    }
  });

  const createSession = () => createSessionMutation.mutate();
  const updateSessionEarnings = (earned) => {
    if (todaySession && todaySession.amount_earned !== earned) {
      updateEarningsMutation.mutate(earned);
    }
  };
  const markGoalMet = () => markGoalMetMutation.mutate();

  if (!membership?.lockout_mode_enabled) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="border-2 border-red-500">
        <CardContent className="p-6">
          <div className="animate-pulse">Loading lockout status...</div>
        </CardContent>
      </Card>
    );
  }

  const earned = todaySession?.amount_earned || 0;
  const goal = todaySession?.goal_amount || 3;
  const progress = (earned / goal) * 100;
  const isLocked = todaySession?.phone_locked && !todaySession?.goal_met;

  return (
    <>
      <Card className={`border-2 ${isLocked ? 'border-red-500 bg-red-50' : 'border-green-500 bg-green-50'}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isLocked ? (
              <>
                <Lock className="w-5 h-5 text-red-600" />
                <span className="text-red-600">Lockout Mode Active</span>
              </>
            ) : (
              <>
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span className="text-green-600">Goal Achieved!</span>
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLocked ? (
            <>
              <div className="bg-white rounded-lg p-4 border border-red-200">
                <p className="text-center text-red-600 font-semibold mb-2">
                  Phone will remain locked until you earn ${goal.toFixed(2)} today
                </p>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Progress</span>
                  <span className="text-sm font-semibold">${earned.toFixed(2)} / ${goal.toFixed(2)}</span>
                </div>
                <Progress value={progress} className="h-3" />
              </div>

              <div className="bg-white rounded-lg p-4 border">
                <p className="text-sm text-gray-600 mb-2">Complete surveys to unlock your phone:</p>
                <Button 
                  className="w-full bg-gradient-to-r from-red-600 to-red-700"
                  onClick={() => window.location.href = '/Surveys'}
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Start Earning Now
                </Button>
              </div>

              <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                <p className="text-xs text-gray-600">
                  <strong>Lockout Mode:</strong> Your premium membership requires earning ${goal} daily. 
                  Cycle ends: {new Date(membership.lockout_end_date).toLocaleDateString()}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-white rounded-lg p-4 border border-green-200">
                <p className="text-center text-green-600 font-semibold mb-2">
                  🎉 You've unlocked your phone for today!
                </p>
                <p className="text-sm text-gray-600 text-center">
                  You earned ${earned.toFixed(2)} today
                </p>
              </div>

              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <p className="text-sm font-semibold text-blue-900">Schedule Tomorrow's Session</p>
                </div>
                <p className="text-xs text-gray-600 mb-3">
                  Before you leave, pick a time to use the app tomorrow
                </p>
                <Button 
                  onClick={() => setShowScheduleModal(true)}
                  className="w-full bg-blue-600"
                >
                  Schedule Next Session
                </Button>
              </div>
            </>
          )}

          <div className="text-xs text-gray-500 text-center">
            Day {membership.days_completed || 0} of 365 • Cycle {membership.lockout_cycle_count || 1}
          </div>
        </CardContent>
      </Card>

      <ScheduleNextSessionModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        user={user}
        membership={membership}
        todaySession={todaySession}
      />
    </>
  );
}
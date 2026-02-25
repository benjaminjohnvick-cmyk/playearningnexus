import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Clock, CheckCircle2, ExternalLink, Zap } from "lucide-react";
import { toast } from "sonner";
import SurveyProgress from '../components/surveys/SurveyProgress';
import CPXResearchEmbed from '../components/surveys/CPXResearchEmbed';
import SurveyEarningsCard from '../components/surveys/SurveyEarningsCard';
import BitLabsEmbed from '../components/surveys/BitLabsEmbed';
import PollfishWebEmbed from '../components/surveys/PollfishWebEmbed';
import TheoremReachEmbed from '../components/surveys/TheoremReachEmbed';
import TolunaEmbed from '../components/surveys/TolunaEmbed';

export default function Surveys() {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  const { data: todaysSurveys = [] } = useQuery({
    queryKey: ['todays-surveys', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      return await base44.entities.Survey.filter({
        user_id: user.id,
        completion_date: { $gte: today }
      });
    },
    enabled: !!user
  });

  const completeSurveyMutation = useMutation({
    mutationFn: async ({ provider, earnings: surveyEarnings, duration, surveyId }) => {
      const survey = await base44.entities.Survey.create({
        user_id: user.id,
        survey_provider: provider || 'pollfish',
        survey_id: surveyId || `survey_${Date.now()}`,
        earnings: surveyEarnings,
        completion_date: new Date().toISOString(),
        status: 'completed',
        duration_minutes: duration || 5
      });

      const userShare = (surveyEarnings || 0) * 0.50; // 50/50 split
      const newEarnings = (user.total_earnings || 0) + userShare;
      
      // Track daily earnings for premium
      const today = new Date().toISOString().split('T')[0];
      const dailyEarningsRecords = await base44.entities.DailyEarnings.filter({
        user_id: user.id,
        date: today
      });
      
      const todaysEarnings = dailyEarningsRecords.length > 0 
        ? dailyEarningsRecords[0].total_earned + userShare
        : userShare;
      
      if (dailyEarningsRecords.length > 0) {
        await base44.entities.DailyEarnings.update(dailyEarningsRecords[0].id, {
          total_earned: todaysEarnings,
          goal_met: todaysEarnings >= 3
        });
      } else {
        await base44.entities.DailyEarnings.create({
          user_id: user.id,
          date: today,
          total_earned: todaysEarnings,
          goal_met: todaysEarnings >= 3
        });
      }
      
      // Check if user qualifies for premium
      if (todaysEarnings >= 3) {
        const premiumRecords = await base44.entities.PremiumMembership.filter({
          user_id: user.id
        });
        
        if (premiumRecords.length > 0) {
          const premium = premiumRecords[0];
          await base44.entities.PremiumMembership.update(premium.id, {
            days_completed: (premium.days_completed || 0) + 1
          });
          
          if ((premium.days_completed || 0) + 1 >= 365) {
            await base44.entities.Notification.create({
              user_id: user.id,
              type: 'achievement_unlocked',
              title: '🎉 Premium Year Complete!',
              message: 'Congratulations! You completed 365 days of premium membership!',
              action_url: '/UserDashboard'
            });
          }
        } else {
          await base44.entities.PremiumMembership.create({
            user_id: user.id,
            start_date: today,
            days_completed: 1,
            is_active: true
          });
          
          await base44.entities.Notification.create({
            user_id: user.id,
            type: 'achievement_unlocked',
            title: '⭐ Premium Member!',
            message: 'You hit your $3 daily goal! Keep it up for 365 days for premium benefits!',
            action_url: '/UserDashboard'
          });
        }
      }
      const currentPoints = user.points || 0;
      const pointsEarned = Math.floor(userShare * 10); // 10 points per dollar
      const newPoints = currentPoints + pointsEarned;
      const newLevel = Math.floor(newPoints / 1000) + 1;
      
      await base44.auth.updateMe({
        total_earnings: newEarnings,
        daily_survey_completed: newEarnings >= 3,
        last_survey_date: new Date().toISOString().split('T')[0],
        points: newPoints,
        level: newLevel
      });

      // Award achievement notification
      if (pointsEarned > 0) {
        await base44.entities.Notification.create({
          user_id: user.id,
          type: 'points_earned',
          title: 'Points Earned!',
          message: `You earned ${pointsEarned} points from completing a survey!`,
          action_url: '/Leaderboard'
        });
      }

      await base44.entities.Transaction.create({
        user_id: user.id,
        amount: userShare,
        transaction_type: 'survey_earning',
        status: 'completed',
        notes: `Survey ${surveyId} completed via ${provider || 'cpx_research'} (50/50 split)`
      });

      // Process referral rewards
      const referrals = await base44.entities.Referral.filter({
        referred_user_id: user.id
      });

      if (referrals.length > 0) {
        const referral = referrals[0];
        const referrer = await base44.entities.User.list();
        const referrerUser = referrer.find(u => u.id === referral.referrer_user_id);

        if (referrerUser) {
          const oldTotal = referral.total_earnings || 0;
          const newTotal = oldTotal + userShare;
          
          let bonusForReferrer = 0;
          let commissionForReferrer = 0;

          // Check if they crossed the $4 threshold
          if (oldTotal < 4 && newTotal >= 4 && !referral.milestone_4_paid) {
            bonusForReferrer += 1; // $1 bonus
            await base44.entities.Referral.update(referral.id, {
              milestone_4_paid: true,
              total_earnings: newTotal
            });

            await base44.entities.Notification.create({
              user_id: referral.referrer_user_id,
              type: 'referral_earnings',
              title: 'Referral Milestone Reached!',
              message: `Your referral earned $4! You received a $1 bonus.`,
              action_url: '/ReferralDashboard'
            });
          } else {
            await base44.entities.Referral.update(referral.id, {
              total_earnings: newTotal
            });
          }

          // Calculate commission: $0.25 for every dollar earned after $4
          if (newTotal > 4) {
            const earningsAboveFour = newTotal - 4;
            const lastTrackedAboveFour = Math.max(0, (referral.last_tracked_earning || 0) - 4);
            const newEarningsToCommission = earningsAboveFour - lastTrackedAboveFour;
            
            if (newEarningsToCommission > 0) {
              commissionForReferrer = newEarningsToCommission * 0.25; // 25% commission
              
              await base44.entities.Referral.update(referral.id, {
                commission_earned: (referral.commission_earned || 0) + commissionForReferrer,
                last_tracked_earning: newTotal
              });
            }
          }

          // Add rewards to referrer's balance
          const totalReward = bonusForReferrer + commissionForReferrer;
          if (totalReward > 0) {
            await base44.entities.User.update(referrerUser.id, {
              current_balance: (referrerUser.current_balance || 0) + totalReward,
              total_earnings: (referrerUser.total_earnings || 0) + totalReward
            });

            if (commissionForReferrer > 0) {
              await base44.entities.Notification.create({
                user_id: referral.referrer_user_id,
                type: 'referral_earnings',
                title: 'Referral Commission Earned!',
                message: `You earned $${commissionForReferrer.toFixed(2)} in commission from your referral's earnings.`,
                action_url: '/ReferralDashboard'
              });
            }
          }
        }
      }

      // Refresh user data
      const updatedUser = await base44.auth.me();
      setUser(updatedUser);

      return survey;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['todays-surveys']);
    }
  });

  const handleCPXComplete = async (earnings) => {
    await completeSurveyMutation.mutateAsync({
      provider: 'cpx_research',
      earnings: earnings,
      duration: 10,
      surveyId: `cpx_${Date.now()}`
    });
    toast.success(`Survey completed! You earned $${(earnings * 0.5).toFixed(2)}`);
  };

  const handleBitLabsComplete = async (earnings) => {
    await completeSurveyMutation.mutateAsync({
      provider: 'bitlabs',
      earnings: earnings,
      duration: 8,
      surveyId: `bitlabs_${Date.now()}`
    });
    toast.success(`BitLabs survey completed! You earned $${(earnings * 0.5).toFixed(2)}`);
  };

  const handlePollfishComplete = async (earnings) => {
    await completeSurveyMutation.mutateAsync({
      provider: 'pollfish',
      earnings: earnings,
      duration: 7,
      surveyId: `pollfish_${Date.now()}`
    });
    toast.success(`Pollfish survey completed! You earned $${(earnings * 0.5).toFixed(2)}`);
  };

  const handleTheoremReachComplete = async (earnings) => {
    await completeSurveyMutation.mutateAsync({
      provider: 'theoremreach',
      earnings: earnings,
      duration: 6,
      surveyId: `theoremreach_${Date.now()}`
    });
    toast.success(`TheoremReach completed! You earned $${(earnings * 0.5).toFixed(2)}`);
  };

  const handleTolunaComplete = async (earnings) => {
    await completeSurveyMutation.mutateAsync({
      provider: 'toluna',
      earnings: earnings,
      duration: 12,
      surveyId: `toluna_${Date.now()}`
    });
    toast.success(`Toluna survey completed! You earned $${(earnings * 0.5).toFixed(2)}`);
  };

  const availableSurveys = [
    { id: 1, provider: 'pollfish', title: 'Consumer Preferences Survey', earnings: 1.20, duration: 5, category: 'Shopping', url: 'https://www.pollfish.com/survey' },
    { id: 2, provider: 'pollfish', title: 'Mobile App Usage Study', earnings: 1.50, duration: 8, category: 'Technology', url: 'https://www.pollfish.com/survey' },
    { id: 3, provider: 'pollfish', title: 'Entertainment Habits', earnings: 0.90, duration: 6, category: 'Lifestyle', url: 'https://www.pollfish.com/survey' },
    { id: 4, provider: 'pollfish', title: 'Product Feedback Study', earnings: 0.80, duration: 4, category: 'Products', url: 'https://www.pollfish.com/survey' },
    { id: 5, provider: 'pollfish', title: 'Travel & Leisure Survey', earnings: 1.75, duration: 10, category: 'Travel', url: 'https://www.pollfish.com/survey' },
    { id: 6, provider: 'pollfish', title: 'Healthcare Opinion Survey', earnings: 2.50, duration: 15, category: 'Health', url: 'https://www.pollfish.com/survey' },
    { id: 7, provider: 'pollfish', title: 'Financial Services Survey', earnings: 3.00, duration: 12, category: 'Finance', url: 'https://www.pollfish.com/survey' },
    { id: 8, provider: 'pollfish', title: 'Gaming Habits Study', earnings: 1.10, duration: 7, category: 'Gaming', url: 'https://www.pollfish.com/survey' }
  ];

  const todaysEarnings = todaysSurveys.reduce((sum, survey) => sum + (survey.earnings || 0), 0);
  const dailyGoalMet = todaysEarnings >= 3;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Available Surveys</h1>
            <p className="text-gray-600">Complete surveys to earn rewards and unlock games</p>
          </div>
        </div>

        <div className="mb-8">
          <SurveyEarningsCard
            totalEarnings={user.total_earnings || 0}
            todayEarnings={todaysEarnings}
            surveysCompleted={todaysSurveys.length}
          />
        </div>

        <div className="mb-8">
          <SurveyProgress
            dailyGoal={3}
            currentEarnings={todaysEarnings}
            todayCompleted={dailyGoalMet}
          />
        </div>

        {/* Survey Provider Integrations */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Survey Providers</h2>
          <p className="text-gray-600 mb-6">
            We've integrated with multiple survey providers to maximize your earning opportunities
          </p>
        </div>

        <div className="grid gap-6 mb-8 md:grid-cols-2">
          <CPXResearchEmbed userId={user.id} onSurveyComplete={handleCPXComplete} />
          <BitLabsEmbed userId={user.id} onSurveyComplete={handleBitLabsComplete} />
          <PollfishWebEmbed userId={user.id} onSurveyComplete={handlePollfishComplete} />
          <TheoremReachEmbed userId={user.id} onSurveyComplete={handleTheoremReachComplete} />
          <TolunaEmbed userId={user.id} onSurveyComplete={handleTolunaComplete} />
        </div>

        {dailyGoalMet && (
          <Card className="p-6 mb-8 bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200">
            <div className="flex items-center gap-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              <div>
                <h3 className="text-xl font-bold text-gray-900">Daily Goal Complete!</h3>
                <p className="text-gray-600">You've unlocked access to all games for today</p>
              </div>
            </div>
          </Card>
        )}



        <Card className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white rounded-lg">
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-gray-900 mb-2">Multi-Provider Survey Network</h3>
              <p className="text-sm text-gray-600 mb-3">
                We've integrated with <span className="font-bold text-red-600">5 leading survey providers</span> including CPX Research, BitLabs, Pollfish, TheoremReach, and Toluna. This ensures you always have access to the highest-paying surveys available, with earnings ranging from <span className="font-bold text-green-600">$0.30 to $5.00 per survey</span>. All payments are processed instantly with our 50/50 revenue share.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge className="bg-green-100 text-green-700 border border-green-200">5 Survey Networks</Badge>
                <Badge className="bg-blue-100 text-blue-700 border border-blue-200">Instant Payments</Badge>
                <Badge className="bg-purple-100 text-purple-700 border border-purple-200">Quality Surveys</Badge>
                <Badge className="bg-red-100 text-red-700 border border-red-200">Fair 50/50 Split</Badge>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
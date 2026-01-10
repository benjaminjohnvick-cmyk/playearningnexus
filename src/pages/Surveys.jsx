import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Clock, CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import SurveyProgress from '../components/surveys/SurveyProgress';

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
    mutationFn: async ({ provider, earnings, duration }) => {
      await base44.entities.Survey.create({
        user_id: user.id,
        survey_provider: provider,
        survey_id: `survey_${Date.now()}`,
        earnings: earnings,
        completion_date: new Date().toISOString(),
        status: 'completed',
        duration_minutes: duration
      });

      await base44.auth.updateMe({
        total_earnings: (user.total_earnings || 0) + earnings,
        daily_survey_completed: true,
        last_survey_date: new Date().toISOString().split('T')[0]
      });

      await base44.entities.Transaction.create({
        user_id: user.id,
        amount: earnings,
        transaction_type: 'survey_earning',
        status: 'completed'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['todays-surveys']);
      toast.success('Survey completed! Earnings added to your account.');
    }
  });

  const availableSurveys = [
    { id: 1, provider: 'cint', title: 'Consumer Preferences Survey', earnings: 0.50, duration: 5, category: 'Shopping' },
    { id: 2, provider: 'pollfish', title: 'Mobile App Usage Study', earnings: 0.75, duration: 8, category: 'Technology' },
    { id: 3, provider: 'cint', title: 'Entertainment Habits', earnings: 0.60, duration: 6, category: 'Lifestyle' },
    { id: 4, provider: 'qualtrics', title: 'Product Feedback', earnings: 0.40, duration: 4, category: 'Products' },
    { id: 5, provider: 'pollfish', title: 'Travel Preferences', earnings: 0.85, duration: 10, category: 'Travel' }
  ];

  const todaysEarnings = todaysSurveys.reduce((sum, survey) => sum + (survey.earnings || 0), 0);
  const dailyGoalMet = todaysEarnings >= 2;

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
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Available Surveys</h1>
          <p className="text-gray-600">Complete surveys to earn rewards and unlock games</p>
        </div>

        <div className="mb-8">
          <SurveyProgress
            dailyGoal={2}
            currentEarnings={todaysEarnings}
            todayCompleted={dailyGoalMet}
          />
        </div>

        {dailyGoalMet && (
          <Card className="p-6 mb-8 bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200">
            <div className="flex items-center gap-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              <div>
                <h3 className="text-xl font-bold text-gray-900">Daily Goal Complete! 🎉</h3>
                <p className="text-gray-600">You've unlocked access to all games for today</p>
              </div>
            </div>
          </Card>
        )}

        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Today's Surveys</h2>
          <div className="grid gap-4">
            {availableSurveys.map((survey) => (
              <Card key={survey.id} className="p-6 border-0 shadow-lg hover:shadow-xl transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-bold text-gray-900">{survey.title}</h3>
                      <Badge variant="outline">{survey.category}</Badge>
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm text-gray-600 mb-4">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        <span className="font-medium text-emerald-600">${survey.earnings.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>{survey.duration} minutes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                          {survey.provider}
                        </span>
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => completeSurveyMutation.mutate({
                        provider: survey.provider,
                        earnings: survey.earnings,
                        duration: survey.duration
                      })}
                      disabled={completeSurveyMutation.isPending}
                      className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                    >
                      Start Survey
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <Card className="mt-8 p-6 bg-blue-50 border-blue-200">
          <h3 className="font-bold text-lg text-gray-900 mb-2">Survey Providers</h3>
          <p className="text-sm text-gray-600 mb-3">
            We partner with leading survey providers to ensure quality surveys and timely payments:
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-white text-blue-700 border border-blue-200">Cint</Badge>
            <Badge className="bg-white text-blue-700 border border-blue-200">Pollfish</Badge>
            <Badge className="bg-white text-blue-700 border border-blue-200">Qualtrics</Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}
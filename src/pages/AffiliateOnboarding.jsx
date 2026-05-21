import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Loader2, Target, Users, TrendingUp } from 'lucide-react';

export default function AffiliateOnboarding() {
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(1);
  const [socialReach, setSocialReach] = useState({
    twitter_followers: 0,
    instagram_followers: 0,
    tiktok_followers: 0,
    linkedin_followers: 0
  });
  const [pastPerformance, setPastPerformance] = useState({
    past_campaigns: 0,
    avg_conversion_rate: 0,
    engagement_score: 0,
    revenue_generated: 0
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  // Analyze and assign tier
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('analyzeAndAssignAffiliateTier', {
        affiliate_user_id: user.id,
        social_media_reach: socialReach,
        performance_metrics: pastPerformance
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['affiliateOnboarding'] });
      setStep(2);
    }
  });

  // Trigger email sequence
  const emailMutation = useMutation({
    mutationFn: async (onboardingId) => {
      const response = await base44.functions.invoke('triggerAffiliateOnboardingSequence', {
        onboarding_id: onboardingId
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliateOnboarding'] });
      setStep(3);
    }
  });

  // Fetch onboarding record
  const { data: onboarding } = useQuery({
    queryKey: ['affiliateOnboarding', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const data = await base44.entities.AffiliateOnboarding.filter(
        { affiliate_user_id: user.id },
        '-created_at',
        1
      );
      return data?.[0] || null;
    },
    enabled: !!user
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8 flex items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  const tierColors = {
    starter: 'bg-slate-100 border-slate-300',
    growth: 'bg-blue-100 border-blue-300',
    pro: 'bg-purple-100 border-purple-300',
    elite: 'bg-amber-100 border-amber-300'
  };

  const tierBadgeColors = {
    starter: 'bg-slate-500',
    growth: 'bg-blue-600',
    pro: 'bg-purple-600',
    elite: 'bg-amber-600'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Affiliate Onboarding</h1>
          <p className="text-slate-600">Complete your profile to unlock campaign opportunities</p>
        </div>

        {/* Progress Indicator */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map(stepNum => (
            <div
              key={stepNum}
              className={`flex-1 h-2 rounded-full ${
                step >= stepNum ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Social Media Reach */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Your Social Media Reach
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-slate-600">Tell us about your audience size across platforms</p>

              <div className="space-y-4">
                {[
                  { key: 'twitter_followers', label: '𝕏 Twitter Followers', icon: '𝕏' },
                  { key: 'instagram_followers', label: '📷 Instagram Followers', icon: '📷' },
                  { key: 'tiktok_followers', label: '🎵 TikTok Followers', icon: '🎵' },
                  { key: 'linkedin_followers', label: '💼 LinkedIn Followers', icon: '💼' }
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
                    <input
                      type="number"
                      value={socialReach[key]}
                      onChange={(e) => setSocialReach({ ...socialReach, [key]: Number(e.target.value) })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm font-semibold text-blue-900">
                  Total Reach: {(Object.values(socialReach).reduce((a, b) => a + b, 0)).toLocaleString()} followers
                </p>
              </div>

              <Button
                onClick={() => setStep(2)}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Next: Performance Metrics →
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Performance Metrics */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Your Past Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-slate-600">Help us understand your track record (optional)</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Past Campaigns Completed
                  </label>
                  <input
                    type="number"
                    value={pastPerformance.past_campaigns}
                    onChange={(e) => setPastPerformance({ ...pastPerformance, past_campaigns: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Average Conversion Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={pastPerformance.avg_conversion_rate}
                    onChange={(e) => setPastPerformance({ ...pastPerformance, avg_conversion_rate: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.0"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => setStep(1)} variant="outline" className="flex-1">
                  ← Back
                </Button>
                <Button
                  onClick={() => analyzeMutation.mutate()}
                  disabled={analyzeMutation.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {analyzeMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    'Analyze & Assign Tier'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Tier Assignment & Goals */}
        {step === 3 && onboarding && (
          <div className="space-y-6">
            {/* Tier Result */}
            <Card className={`border-2 ${tierColors[onboarding.assigned_tier]}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Your Tier Assignment
                  </CardTitle>
                  <Badge className={tierBadgeColors[onboarding.assigned_tier]}>
                    {onboarding.assigned_tier.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-700">
                  Based on your {onboarding.social_media_reach.total_reach.toLocaleString()} followers and performance history, you've been assigned to <strong>{onboarding.assigned_tier.charAt(0).toUpperCase() + onboarding.assigned_tier.slice(1)} Tier</strong>.
                </p>

                {/* Personalized Goals */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                  <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Your Personalized Goals
                  </h4>
                  <div className="space-y-2">
                    {onboarding.personalized_goals?.map((goal, idx) => (
                      <div key={idx} className="bg-white p-3 rounded border border-slate-200 text-sm">
                        <p className="font-semibold text-slate-900">{goal.goal_name}</p>
                        <p className="text-slate-600 text-xs mt-1">Target: {goal.target_value} {goal.metric_type}</p>
                        <p className="text-slate-500 text-xs mt-1">Due: {new Date(goal.deadline).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={() => emailMutation.mutate(onboarding.id)}
                  disabled={emailMutation.isPending || onboarding.onboarding_status === 'completed'}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {emailMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending Welcome Sequence...
                    </>
                  ) : onboarding.onboarding_status === 'completed' ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Onboarding Complete
                    </>
                  ) : (
                    'Start Your Journey'
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Completion Message */}
            {onboarding.onboarding_status === 'completed' && (
              <Card className="bg-green-50 border-green-300">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <div>
                      <p className="font-semibold text-green-900">Welcome to GamerGain!</p>
                      <p className="text-sm text-green-700">Check your email for your personalized onboarding sequence.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
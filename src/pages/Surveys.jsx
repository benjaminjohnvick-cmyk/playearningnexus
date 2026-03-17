import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  DollarSign, CheckCircle2, Clock, TrendingUp, 
  RefreshCw, ChevronRight, X, Loader2, Star, 
  Target, Trophy, Zap, Info, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import SurveyStatsBar from '@/components/surveys/SurveyStatsBar';
import TierInfoModal from '@/components/ppc/TierInfoModal';
import SurveyMap from '@/components/surveys/SurveyMap';
import SurveyHotspotHub from '@/components/surveys/SurveyHotspotHub';
import SurveyFilterBar from '@/components/surveys/SurveyFilterBar';
import SurveyDisputeModal from '@/components/surveys/SurveyDisputeModal';
import AISurveyMatcher from '@/components/surveys/AISurveyMatcher';
import PersonalizedSurveyCards from '@/components/surveys/PersonalizedSurveyCards';
import SelfServiceDisputeModule from '@/components/surveys/SelfServiceDisputeModule';

export default function Surveys() {
  const [user, setUser] = useState(null);
  const [activeSurvey, setActiveSurvey] = useState(null);
  const [showTierModal, setShowTierModal] = useState(null);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [surveyFilters, setSurveyFilters] = useState({ category: 'All', payoutIdx: 0, timeIdx: 0 });
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: dailyEarnings, refetch: refetchEarnings } = useQuery({
    queryKey: ['daily-earnings-surveys', user?.id, today],
    queryFn: async () => {
      const records = await base44.entities.DailyEarnings.filter({ user_id: user.id, date: today });
      return records[0] || { total_earned: 0, total_surveys_completed: 0, goal_met: false };
    },
    enabled: !!user,
    refetchInterval: 8000
  });

  const { data: recentTransactions = [] } = useQuery({
    queryKey: ['survey-transactions', user?.id],
    queryFn: async () => {
      return await base44.entities.Transaction.filter(
        { user_id: user.id, transaction_type: 'survey_completion' },
        '-created_date',
        10
      );
    },
    enabled: !!user
  });

  const handleSurveyComplete = async (earnings) => {
    await refetchEarnings();
    queryClient.invalidateQueries(['survey-transactions']);
    const updatedUser = await base44.auth.me();
    setUser(updatedUser);
  };

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
    </div>
  );

  const earned = dailyEarnings?.total_earned || 0;
  const surveysCompleted = dailyEarnings?.total_surveys_completed || 0;
  const dailyGoal = 3;
  const goalMet = earned >= dailyGoal;
  const progressPct = Math.min((earned / dailyGoal) * 100, 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
              <DollarSign className="w-9 h-9 text-blue-600" /> Surveys
            </h1>
            <p className="text-gray-500 mt-1">Complete surveys to earn money — 50% of every survey goes to you</p>
          </div>
          <Card className="px-5 py-3 border-2 border-green-400 bg-green-50 flex-shrink-0">
            <p className="text-xs text-gray-500">Your Balance</p>
            <p className="text-2xl font-bold text-green-600">${(user.current_balance || 0).toFixed(2)}</p>
          </Card>
        </div>

        {/* Stats Bar */}
        <SurveyStatsBar
          earned={earned}
          dailyGoal={dailyGoal}
          surveysCompleted={surveysCompleted}
          totalEarnings={user.total_earnings || 0}
          progressPct={progressPct}
          goalMet={goalMet}
        />

        {/* AI Survey Generator Button */}
        <button
          onClick={() => document.getElementById('ai-survey-matcher')?.scrollIntoView({ behavior: 'smooth' })}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:from-indigo-700 hover:to-purple-700 transition-all"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 flex-shrink-0" />
            <div className="text-left">
              <p className="font-bold text-base">AI Survey Generator</p>
              <p className="text-indigo-200 text-sm">Find your best-matched surveys with AI</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 flex-shrink-0" />
        </button>

        {/* Daily Goal Banner */}
        {goalMet ? (
          <Card className="border-2 border-green-400 bg-gradient-to-r from-green-50 to-emerald-50">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Trophy className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-green-800">🎉 Daily Goal Achieved!</h3>
                <p className="text-green-700 text-sm">You've earned ${earned.toFixed(2)} today. The game store is unlocked. Keep going for bonus earnings!</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-2 border-blue-200 bg-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-gray-800">Daily Goal: $3.00</span>
                </div>
                <span className="text-sm font-bold text-blue-600">${earned.toFixed(2)} / $3.00</span>
              </div>
              <Progress value={progressPct} className="h-4 mb-2" />
              <p className="text-xs text-gray-500">
                ${(dailyGoal - earned).toFixed(2)} more to unlock the Game Store
              </p>
            </CardContent>
          </Card>
        )}

        {/* PPC Marketplace Banner */}
        <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setShowTierModal(1)}>
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-gray-900">PPC Marketplace — 3 Tiers of Earning</p>
                <p className="text-sm text-gray-600">Tier 1 uses BitLabs surveys. Advance to unlock higher-paying tiers with referral income up to $58,400+/year.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Info className="w-4 h-4 text-purple-600" />
              <span className="text-purple-700 text-sm font-medium">Learn More</span>
            </div>
          </CardContent>
        </Card>

        {/* Personalized Survey Task Cards */}
        <PersonalizedSurveyCards user={user} onSurveyStart={() => {}} />

        {/* AI Survey Matcher */}
        <AISurveyMatcher user={user} />

        {/* Survey Filter Bar */}
        <SurveyFilterBar filters={surveyFilters} onChange={setSurveyFilters} />

        {/* Survey Hotspot Hub */}
        <SurveyHotspotHub user={user} />

        {/* Survey Map */}
        <SurveyMap user={user} />

        {/* Survey Wall */}
        <Card className="border-0 shadow-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-white">
                <Zap className="w-5 h-5" /> Available Surveys
              </CardTitle>
              <Badge className="bg-white/20 text-white border-white/30">Powered by BitLabs</Badge>
            </div>
            <p className="text-blue-100 text-sm mt-1">You earn 50% of every survey value. Earnings are credited automatically.</p>
          </CardHeader>
          <CardContent className="p-0">
            <SurveyWallEmbed
              user={user}
              onSurveyComplete={handleSurveyComplete}
            />
          </CardContent>
        </Card>

        {/* Recent Earnings */}
        {recentTransactions.length > 0 && (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-500" /> Recent Survey Earnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">Survey Completed</p>
                        <p className="text-xs text-gray-400">
                          {new Date(tx.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <span className="text-green-600 font-bold">+${(tx.amount || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Self-Service Dispute Module */}
        <SelfServiceDisputeModule user={user} />

        {/* How it works */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-white">
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: "1", color: "bg-blue-500", title: "Browse Surveys", desc: "View all available surveys below. Each shows estimated time and payout." },
                { icon: "2", color: "bg-purple-500", title: "Complete In-App", desc: "Take surveys directly here — no redirects, no new tabs. Fully integrated." },
                { icon: "3", color: "bg-green-500", title: "Earn Instantly", desc: "50% of every survey value is credited to your balance automatically." }
              ].map((step) => (
                <div key={step.icon} className="flex gap-4">
                  <div className={`w-10 h-10 ${step.color} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>
                    {step.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{step.title}</p>
                    <p className="text-sm text-gray-500 mt-1">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>

      {showTierModal && (
        <TierInfoModal tier={showTierModal} onClose={() => setShowTierModal(null)} />
      )}
      <SurveyDisputeModal user={user} isOpen={showDisputeModal} onClose={() => setShowDisputeModal(false)} />
    </div>
  );
}

// Inline Survey Wall Embed Component
function SurveyWallEmbed({ user, onSurveyComplete }) {
  const [surveyUrl, setSurveyUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadSurveys = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('getBitLabsSurveyUrl', {
        userId: user.id,
        userEmail: user.email
      });
      if (response.data?.url) {
        setSurveyUrl(response.data.url);
      } else {
        toast.error('Could not load surveys. Please try again.');
      }
    } catch {
      toast.error('Survey service temporarily unavailable');
    } finally {
      setLoading(false);
    }
  };

  // Listen for postMessage from BitLabs iframe
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'survey_completed' || event.data?.status === 'completed') {
        const reward = event.data.reward || 0;
        const userEarnings = reward / 2;
        toast.success(`🎉 Survey completed! +$${userEarnings.toFixed(2)} added to your balance`);
        if (onSurveyComplete) onSurveyComplete(userEarnings);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSurveyComplete]);

  if (!surveyUrl) {
    return (
      <div className="p-12 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-5">
          <DollarSign className="w-10 h-10 text-white" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Ready to Earn?</h3>
        <p className="text-gray-500 mb-6 max-w-sm mx-auto">
          Click below to load all available surveys for your profile. Earnings are applied automatically upon completion.
        </p>
        <Button
          onClick={loadSurveys}
          disabled={loading}
          size="lg"
          className="bg-gradient-to-r from-blue-600 to-purple-600 px-10 text-lg"
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading Surveys...</>
          ) : (
            <><Zap className="w-5 h-5 mr-2" /> Load Available Surveys</>
          )}
        </Button>
        <p className="text-xs text-gray-400 mt-4">Survey availability varies by region and profile</p>
      </div>
    );
  }

  return (
    <div>
      {!loaded && (
        <div className="flex items-center justify-center h-24 bg-gray-50">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
          <span className="text-gray-500">Loading surveys...</span>
        </div>
      )}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
        <span className="text-sm text-gray-500">Surveys are taken securely within this page</span>
        <Button variant="ghost" size="sm" onClick={loadSurveys}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>
      <iframe
        src={surveyUrl}
        className="w-full"
        style={{ height: '680px', border: 'none', display: loaded ? 'block' : 'none' }}
        onLoad={() => setLoaded(true)}
        title="Survey Wall"
        allow="camera; microphone"
      />
    </div>
  );
}
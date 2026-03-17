import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Sparkles, TrendingUp, DollarSign, Clock, ChevronRight, RefreshCw, Target } from 'lucide-react';
import { toast } from 'sonner';

export default function AISurveyMatcher({ user }) {
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(false);

  const { data: completedSurveys = [] } = useQuery({
    queryKey: ['completed-surveys', user?.id],
    queryFn: () => base44.entities.PPCSurveyResponse.filter({ user_id: user.id, completed: true }, '-created_date', 20),
    enabled: !!user?.id
  });

  const { data: activeSurveys = [] } = useQuery({
    queryKey: ['active-surveys-matcher'],
    queryFn: () => base44.entities.PPCSurvey.filter({ status: 'active' }, '-created_date', 50),
  });

  const runMatcher = async () => {
    if (activeSurveys.length === 0) {
      toast.error('No active surveys available to match');
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('aiSurveyMatcher', {
        user_id: user.id,
        user_profile: {
          email: user.email,
          total_earnings: user.total_earnings || 0,
          surveys_completed: completedSurveys.length,
          interests: user.interests || [],
          age_range: user.age_range || 'unknown',
          location: user.location || 'unknown',
        },
        completed_survey_ids: completedSurveys.map(r => r.survey_id),
        available_surveys: activeSurveys.map(s => ({
          id: s.id,
          title: s.title,
          survey_type: s.survey_type,
          questions: s.questions?.length || 10,
          cost_per_response: s.cost_per_response || 4,
          responses_count: s.responses_count || 0,
          sample_size: s.sample_size || 100,
        })),
      });
      if (res.data?.success) {
        setMatches(res.data.matches);
        toast.success('AI matched your best surveys!');
      } else {
        toast.error('Matching failed, please try again');
      }
    } catch {
      toast.error('AI Matcher unavailable');
    } finally {
      setLoading(false);
    }
  };

  const matchColor = (score) => {
    if (score >= 80) return { bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-500' };
    if (score >= 60) return { bg: 'bg-blue-100', text: 'text-blue-700', bar: 'bg-blue-500' };
    if (score >= 40) return { bg: 'bg-yellow-100', text: 'text-yellow-700', bar: 'bg-yellow-500' };
    return { bg: 'bg-gray-100', text: 'text-gray-600', bar: 'bg-gray-400' };
  };

  return (
    <Card className="border-0 shadow-xl overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
      <CardHeader className="bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" /> AI Survey Matcher
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-indigo-100 text-indigo-700">
              {activeSurveys.length} surveys available
            </Badge>
            <Badge className="bg-purple-100 text-purple-700">
              {completedSurveys.length} completed by you
            </Badge>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Our AI analyzes your profile and completion history to rank surveys by match probability and expected earnings.
        </p>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        <Button
          onClick={runMatcher}
          disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white h-11"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing your profile…</>
            : matches
            ? <><RefreshCw className="w-4 h-4 mr-2" /> Re-run AI Matching</>
            : <><Sparkles className="w-4 h-4 mr-2" /> Find My Best Surveys</>}
        </Button>

        {!matches && !loading && (
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { icon: Target, label: 'Profile Match', desc: 'Surveys that fit your demographics' },
              { icon: TrendingUp, label: 'Top Earners', desc: 'Ranked by expected payout' },
              { icon: Clock, label: 'Quick Wins', desc: 'Fastest completions first' },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="p-3 bg-gray-50 rounded-xl">
                  <Icon className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-gray-700">{item.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                </div>
              );
            })}
          </div>
        )}

        {matches && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              {matches.length} Matched Surveys — Ranked by Fit Score
            </p>
            {matches.map((match, i) => {
              const colors = matchColor(match.match_score);
              return (
                <div key={match.survey_id || i} className="border-2 border-gray-100 rounded-xl p-4 hover:border-indigo-200 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-semibold text-gray-900 text-sm">{match.title}</p>
                        <Badge className={`text-xs ${colors.bg} ${colors.text}`}>
                          {match.match_score}% Match
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{match.reason}</p>

                      <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1 text-green-600 font-semibold">
                          <DollarSign className="w-3 h-3" /> ~${match.expected_earnings?.toFixed(2) || '4.00'}
                        </span>
                        <span className="flex items-center gap-1 text-gray-500">
                          <Clock className="w-3 h-3" /> ~{match.est_minutes || 8} min
                        </span>
                        <span className="flex items-center gap-1 text-gray-500">
                          <TrendingUp className="w-3 h-3" /> {match.completion_likelihood}% completion rate
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1 flex-shrink-0">
                      <span className="text-xs font-bold text-gray-500">#{i + 1}</span>
                    </div>
                  </div>

                  {/* Match score bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">Likelihood to match</span>
                      <span className={`font-bold ${colors.text}`}>{match.match_score}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${colors.bar}`}
                        style={{ width: `${match.match_score}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, TrendingUp, Clock, DollarSign, ChevronRight, RefreshCw } from 'lucide-react';

export default function RankedSurveyList({ user, onTakeSurvey }) {
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('rankSurveysForUser', { limit: 20 });
      setSurveys(res.data?.surveys || []);
    } catch (e) {
      setError('Could not load personalized surveys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) load();
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Sparkles className="w-8 h-8 text-purple-500 animate-pulse" />
        <p className="text-sm text-gray-500">AI is personalizing your survey feed…</p>
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-400 text-sm mb-3">{error}</p>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry</Button>
      </div>
    );
  }

  if (surveys.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p>No available surveys right now — check back soon!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-semibold text-gray-700">AI-Ranked for You</span>
          <Badge variant="outline" className="text-xs border-purple-300 text-purple-600">{surveys.length} surveys</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={load} className="text-xs text-gray-400">
          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
        </Button>
      </div>

      {surveys.map((survey, idx) => {
        const isTopPick = idx < 3 && survey.match_score;
        const estimatedMinutes = Math.ceil((survey.avg_completion_time_seconds || 60) / 60);
        const earningPerMin = estimatedMinutes > 0 ? (survey.cost_per_response || 0) / estimatedMinutes : 0;

        return (
          <Card key={survey.id}
            className={`border transition-all hover:shadow-md cursor-pointer ${isTopPick ? 'border-purple-300 bg-purple-50/30' : 'border-gray-100'}`}
            onClick={() => onTakeSurvey?.(survey)}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {/* Rank indicator */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                  ${idx === 0 ? 'bg-yellow-400 text-yellow-900' : idx === 1 ? 'bg-gray-300 text-gray-700' : idx === 2 ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {idx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm leading-tight">{survey.title}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {isTopPick && (
                          <Badge className="bg-purple-100 text-purple-700 border-purple-300 text-xs">
                            <Sparkles className="w-2.5 h-2.5 mr-0.5" /> {survey.match_score}% match
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs capitalize">{survey.survey_type?.replace('_', ' ')}</Badge>
                        <span className="text-xs text-gray-400 flex items-center gap-0.5">
                          <Clock className="w-3 h-3" /> ~{estimatedMinutes}m
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-green-600">${(survey.cost_per_response || 0).toFixed(2)}</p>
                      {earningPerMin > 0 && (
                        <p className="text-xs text-gray-400">${earningPerMin.toFixed(2)}/min</p>
                      )}
                    </div>
                  </div>

                  {survey.match_reason && (
                    <p className="text-xs text-purple-600 mt-1.5 italic">{survey.match_reason}</p>
                  )}

                  {survey.earning_estimate && (
                    <p className="text-xs text-green-600 mt-0.5">{survey.earning_estimate}</p>
                  )}
                </div>

                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
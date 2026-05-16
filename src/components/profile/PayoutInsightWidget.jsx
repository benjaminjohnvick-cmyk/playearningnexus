import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Brain, Calendar, Bell, TrendingUp, Loader2, ChevronRight, CheckCircle2, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';

export default function PayoutInsightWidget({ user }) {
  const [notifyRequested, setNotifyRequested] = useState(!!user?.payout_insight_notify_enabled);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['payoutInsight', user?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('aiPayoutInsight', {});
      return res.data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 30, // cache 30 min
  });

  const notifyMutation = useMutation({
    mutationFn: () => base44.functions.invoke('aiPayoutInsight', { notify_me: true }),
    onSuccess: () => {
      setNotifyRequested(true);
      toast.success('Reminder set! We\'ll notify you by email on the recommended date.');
    }
  });

  const insight = data?.insight;
  const score = insight?.optimization_score || 0;
  const scoreColor = score >= 75 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600';
  const scoreBg = score >= 75 ? 'bg-green-50 border-green-200' : score >= 50 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-indigo-50 to-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="w-5 h-5 text-indigo-600" />
          AI Payout Insight
          <Badge className="ml-auto bg-indigo-100 text-indigo-700 text-xs">Powered by AI</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Analyzing your earning history…</span>
          </div>
        ) : !insight ? (
          <div className="text-center py-6">
            <p className="text-gray-400 text-sm mb-3">Click below to get your personalized payout forecast</p>
            <Button size="sm" onClick={() => refetch()} className="bg-indigo-600 hover:bg-indigo-700">
              <Brain className="w-4 h-4 mr-1" /> Generate Insight
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Optimization Score */}
            <div className={`rounded-xl border-2 p-3 flex items-center gap-3 ${scoreBg}`}>
              <div className="text-center min-w-[56px]">
                <p className={`text-2xl font-bold ${scoreColor}`}>{score}</p>
                <p className="text-xs text-gray-500">/ 100</p>
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-800">Payout Optimization Score</p>
                <p className="text-xs text-gray-500">{score >= 75 ? 'Well optimized' : score >= 50 ? 'Room for improvement' : 'Needs attention'}</p>
              </div>
            </div>

            {/* Recommended date */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <p className="font-semibold text-sm text-gray-800">Recommended Payout Date</p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold text-indigo-700">{insight.recommended_payout_date}</p>
                  <p className="text-xs text-gray-400">in {insight.days_until_recommended} days · arrives ~{insight.estimated_arrival_date}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">${insight.forecasted_balance_at_payout?.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">forecasted balance</p>
                </div>
              </div>
              {insight.best_payout_method && (
                <Badge variant="outline" className="capitalize text-xs">{insight.best_payout_method?.replace(/_/g, ' ')}</Badge>
              )}
            </div>

            {/* Reasoning */}
            <div className="bg-indigo-50 rounded-xl p-3 flex gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-indigo-800">{insight.reasoning}</p>
            </div>

            {/* Tips */}
            {insight.tips?.length > 0 && (
              <div className="space-y-1.5">
                {insight.tips.map((tip, i) => (
                  <div key={i} className="flex gap-2 items-start bg-gray-50 rounded-lg p-2.5">
                    <Lightbulb className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-700">{tip}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Notify Me */}
            <div className="flex gap-2 pt-1">
              {notifyRequested ? (
                <div className="flex-1 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700">
                  <CheckCircle2 className="w-4 h-4" />
                  Reminder set for {insight.recommended_payout_date}
                </div>
              ) : (
                <Button
                  size="sm"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => notifyMutation.mutate()}
                  disabled={notifyMutation.isPending}
                >
                  {notifyMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Bell className="w-4 h-4 mr-1" />}
                  Notify Me via Email
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
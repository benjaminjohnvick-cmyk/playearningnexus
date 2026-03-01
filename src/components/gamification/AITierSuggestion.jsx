import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, Loader2, ChevronRight, Target } from 'lucide-react';

export default function AITierSuggestion({ user }) {
  const [result, setResult] = useState(null);

  const mutation = useMutation({
    mutationFn: () => base44.functions.invoke('aiRewardsEngine', { action: 'suggest_tier', user_id: user.id }),
    onSuccess: (res) => setResult(res.data?.data || null),
  });

  const data = result;

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-purple-800">
          <Sparkles className="w-4 h-4 text-purple-500" />
          AI Tier Advisor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!data && !mutation.isPending && (
          <div className="text-center py-2">
            <p className="text-xs text-gray-500 mb-3">Get a personalized tier recommendation based on your activity</p>
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 gap-2"
              onClick={() => mutation.mutate()}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Analyze My Progress
            </Button>
          </div>
        )}

        {mutation.isPending && (
          <div className="flex items-center justify-center gap-2 py-4 text-purple-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Analyzing your activity...</span>
          </div>
        )}

        {data && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Your Position</p>
                <p className="font-bold text-purple-700">{data.current_position}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Suggested Multiplier</p>
                <p className="font-bold text-green-600 text-lg">{data.custom_multiplier}x</p>
              </div>
            </div>

            {data.next_tier && (
              <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-purple-100">
                <TrendingUp className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <div className="flex-1 text-xs">
                  <span className="text-gray-500">Next tier: </span>
                  <span className="font-semibold text-blue-700">{data.next_tier}</span>
                  {data.days_to_next_tier && (
                    <span className="text-gray-400 ml-1">~{data.days_to_next_tier} days at current pace</span>
                  )}
                </div>
              </div>
            )}

            {data.actions_to_level_up?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                  <Target className="w-3.5 h-3.5" /> Actions to level up:
                </p>
                <ul className="space-y-1">
                  {data.actions_to_level_up.slice(0, 3).map((action, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                      <ChevronRight className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.motivational_message && (
              <p className="text-xs text-purple-700 italic bg-purple-50 rounded-lg px-3 py-2 border border-purple-100">
                "{data.motivational_message}"
              </p>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-purple-600 hover:bg-purple-50 gap-1"
              onClick={() => { setResult(null); mutation.mutate(); }}
            >
              <Sparkles className="w-3 h-3" /> Refresh Analysis
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
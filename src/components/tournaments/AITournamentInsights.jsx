import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Brain, TrendingUp, Target, Users, Lightbulb, BarChart3 } from 'lucide-react';

export default function AITournamentInsights({ tournamentId }) {
  const { data: insights = [], isLoading } = useQuery({
    queryKey: ['tournament-insights', tournamentId],
    queryFn: () => base44.entities.TournamentAIInsight.filter({ 
      tournament_id: tournamentId,
      is_public: true
    }),
    enabled: !!tournamentId
  });

  const insightsByType = {
    matchmaking: insights.filter(i => i.insight_type === 'matchmaking'),
    strategy: insights.filter(i => i.insight_type === 'strategy'),
    balance: insights.filter(i => i.insight_type === 'balance'),
    player_feedback: insights.filter(i => i.insight_type === 'player_feedback')
  };

  const typeIcons = {
    matchmaking: Users,
    strategy: Target,
    balance: BarChart3,
    player_feedback: Lightbulb
  };

  const typeColors = {
    matchmaking: 'bg-blue-100 text-blue-800',
    strategy: 'bg-purple-100 text-purple-800',
    balance: 'bg-green-100 text-green-800',
    player_feedback: 'bg-yellow-100 text-yellow-800'
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (insights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />
            AI Tournament Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">AI insights will be available after the tournament begins.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-600" />
          AI Tournament Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="matchmaking">Matchmaking</TabsTrigger>
            <TabsTrigger value="strategy">Strategy</TabsTrigger>
            <TabsTrigger value="balance">Balance</TabsTrigger>
            <TabsTrigger value="player_feedback">Feedback</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-3">
            {insights.map(insight => {
              const Icon = typeIcons[insight.insight_type];
              return (
                <div key={insight.id} className="p-4 border rounded-lg bg-gradient-to-r from-purple-50 to-white">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {Icon && <Icon className="w-4 h-4 text-purple-600" />}
                      <h3 className="font-semibold text-gray-900">{insight.title}</h3>
                    </div>
                    <Badge className={typeColors[insight.insight_type]}>
                      {insight.insight_type.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-700 mb-3">{insight.content}</p>
                  
                  {insight.key_findings?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-gray-700 mb-1">Key Findings:</p>
                      <ul className="text-xs text-gray-600 space-y-1 ml-4">
                        {insight.key_findings.map((finding, idx) => (
                          <li key={idx} className="list-disc">{finding}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {insight.recommendations?.length > 0 && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-blue-900 mb-1 flex items-center gap-1">
                        <Lightbulb className="w-3 h-3" />
                        Recommendations:
                      </p>
                      <ul className="text-xs text-blue-800 space-y-1 ml-4">
                        {insight.recommendations.map((rec, idx) => (
                          <li key={idx} className="list-disc">{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {insight.confidence_score && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-gray-500">Confidence:</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[200px]">
                        <div 
                          className="bg-purple-600 h-2 rounded-full" 
                          style={{ width: `${insight.confidence_score}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600">{insight.confidence_score}%</span>
                    </div>
                  )}
                </div>
              );
            })}
          </TabsContent>

          {Object.keys(insightsByType).map(type => (
            <TabsContent key={type} value={type} className="space-y-3">
              {insightsByType[type].length === 0 ? (
                <p className="text-gray-600 text-sm">No {type.replace('_', ' ')} insights available yet.</p>
              ) : (
                insightsByType[type].map(insight => {
                  const Icon = typeIcons[insight.insight_type];
                  return (
                    <div key={insight.id} className="p-4 border rounded-lg bg-gradient-to-r from-purple-50 to-white">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {Icon && <Icon className="w-4 h-4 text-purple-600" />}
                          <h3 className="font-semibold text-gray-900">{insight.title}</h3>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 mb-3">{insight.content}</p>
                      
                      {insight.key_findings?.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-gray-700 mb-1">Key Findings:</p>
                          <ul className="text-xs text-gray-600 space-y-1 ml-4">
                            {insight.key_findings.map((finding, idx) => (
                              <li key={idx} className="list-disc">{finding}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {insight.recommendations?.length > 0 && (
                        <div className="bg-blue-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-blue-900 mb-1 flex items-center gap-1">
                            <Lightbulb className="w-3 h-3" />
                            Recommendations:
                          </p>
                          <ul className="text-xs text-blue-800 space-y-1 ml-4">
                            {insight.recommendations.map((rec, idx) => (
                              <li key={idx} className="list-disc">{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
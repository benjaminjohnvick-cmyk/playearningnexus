import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, AlertTriangle, Wrench, Sparkles, TrendingUp, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';

export default function GameImprovementAnalyzer({ businessClient, games }) {
  const [selectedGame, setSelectedGame] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [recommendations, setRecommendations] = useState(null);

  // Fetch game-specific data
  const { data: gameReviews = [] } = useQuery({
    queryKey: ['game-reviews', selectedGame],
    queryFn: async () => {
      if (!selectedGame) return [];
      return await base44.entities.GameReview.filter({ game_id: selectedGame });
    },
    enabled: !!selectedGame
  });

  const { data: bugReports = [] } = useQuery({
    queryKey: ['bug-reports', selectedGame],
    queryFn: async () => {
      if (!selectedGame) return [];
      return await base44.entities.BugReport.filter({ game_id: selectedGame });
    },
    enabled: !!selectedGame
  });

  const { data: engagement = [] } = useQuery({
    queryKey: ['game-engagement', selectedGame],
    queryFn: async () => {
      if (!selectedGame) return [];
      return await base44.entities.GameEngagement.filter({ game_id: selectedGame }, '-created_date', 100);
    },
    enabled: !!selectedGame
  });

  const { data: supportTickets = [] } = useQuery({
    queryKey: ['support-tickets', selectedGame],
    queryFn: async () => {
      if (!selectedGame) return [];
      return await base44.entities.SupportTicket.filter({ game_id: selectedGame });
    },
    enabled: !!selectedGame
  });

  // Analyze and generate recommendations
  const analyzeMutation = useMutation({
    mutationFn: async (gameId) => {
      setAnalyzing(true);

      const game = games.find(g => g.id === gameId);

      // Calculate engagement metrics
      const avgPlayTime = engagement.length > 0
        ? engagement.reduce((sum, e) => sum + (e.time_spent || 0), 0) / engagement.length
        : 0;

      const retentionRate = engagement.filter(e => e.session_count > 1).length / Math.max(engagement.length, 1) * 100;

      // Analyze reviews sentiment
      const positiveReviews = gameReviews.filter(r => r.rating >= 4).length;
      const negativeReviews = gameReviews.filter(r => r.rating <= 2).length;

      // Get common complaints
      const reviewTexts = gameReviews.map(r => r.review_text).filter(Boolean).join(' | ');
      const bugDescriptions = bugReports.map(b => b.description).join(' | ');
      const ticketDescriptions = supportTickets.map(t => t.description).join(' | ');

      // Call AI for comprehensive analysis
      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this game's performance and provide specific, actionable recommendations for improvement.

Game: ${game.title}
Category: ${game.category}

Performance Metrics:
- Average Rating: ${game.average_rating || 0}/5
- Total Reviews: ${gameReviews.length}
- Positive Reviews: ${positiveReviews} (${((positiveReviews/Math.max(gameReviews.length, 1))*100).toFixed(1)}%)
- Negative Reviews: ${negativeReviews}
- Average Play Time: ${avgPlayTime.toFixed(1)} minutes
- Retention Rate: ${retentionRate.toFixed(1)}%
- Total Installs: ${game.total_installs || 0}
- Bug Reports: ${bugReports.length}
- Support Tickets: ${supportTickets.length}

Player Feedback Summary:
Reviews: ${reviewTexts.slice(0, 1000) || 'No reviews yet'}
Bug Reports: ${bugDescriptions.slice(0, 500) || 'No bug reports'}
Support Issues: ${ticketDescriptions.slice(0, 500) || 'No support tickets'}

Based on this data, provide:
1. Critical issues that need immediate attention
2. Feature suggestions based on player feedback
3. Balancing adjustments (if applicable)
4. Bug fix priorities
5. Content update recommendations
6. Overall improvement strategy`,
        response_json_schema: {
          type: 'object',
          properties: {
            overall_health_score: { type: 'number' },
            critical_issues: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  issue: { type: 'string' },
                  priority: { type: 'string' },
                  impact: { type: 'string' }
                }
              }
            },
            feature_suggestions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  feature: { type: 'string' },
                  rationale: { type: 'string' },
                  effort: { type: 'string' }
                }
              }
            },
            balancing_adjustments: {
              type: 'array',
              items: { type: 'string' }
            },
            bug_fix_priorities: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  bug: { type: 'string' },
                  severity: { type: 'string' }
                }
              }
            },
            content_updates: {
              type: 'array',
              items: { type: 'string' }
            },
            improvement_strategy: { type: 'string' }
          }
        }
      });

      return {
        ...analysis,
        game_title: game.title,
        metrics: {
          avg_play_time: avgPlayTime,
          retention_rate: retentionRate,
          positive_review_rate: (positiveReviews/Math.max(gameReviews.length, 1))*100
        }
      };
    },
    onSuccess: (data) => {
      setRecommendations(data);
      setAnalyzing(false);
    },
    onError: () => {
      setAnalyzing(false);
    }
  });

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      default: return 'bg-blue-100 text-blue-700 border-blue-300';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-amber-500" />
            Game Improvement Analyzer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <Select value={selectedGame} onValueChange={setSelectedGame}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a game to analyze..." />
              </SelectTrigger>
              <SelectContent>
                {games.map(game => (
                  <SelectItem key={game.id} value={game.id}>
                    {game.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => analyzeMutation.mutate(selectedGame)}
              disabled={!selectedGame || analyzing}
              className="bg-gradient-to-r from-amber-600 to-orange-600"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {analyzing ? 'Analyzing...' : 'Analyze Game'}
            </Button>
          </div>

          {recommendations && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Health Score */}
              <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
                <CardContent className="p-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">Overall Health Score</p>
                    <div className="text-5xl font-bold text-blue-600 mb-2">
                      {recommendations.overall_health_score}/100
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div>
                        <p className="text-xs text-gray-500">Avg Play Time</p>
                        <p className="font-semibold">{recommendations.metrics.avg_play_time.toFixed(1)}m</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Retention</p>
                        <p className="font-semibold">{recommendations.metrics.retention_rate.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Positive Reviews</p>
                        <p className="font-semibold">{recommendations.metrics.positive_review_rate.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Critical Issues */}
              {recommendations.critical_issues?.length > 0 && (
                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      Critical Issues
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {recommendations.critical_issues.map((issue, idx) => (
                        <div key={idx} className="p-4 bg-red-50 rounded-lg border border-red-200">
                          <div className="flex items-start justify-between mb-2">
                            <p className="font-semibold">{issue.issue}</p>
                            <Badge className={getPriorityColor(issue.priority)}>
                              {issue.priority}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">{issue.impact}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Feature Suggestions */}
              {recommendations.feature_suggestions?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Sparkles className="w-5 h-5 text-purple-600" />
                      Feature Suggestions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {recommendations.feature_suggestions.map((feature, idx) => (
                        <div key={idx} className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                          <div className="flex items-start justify-between mb-2">
                            <p className="font-semibold">{feature.feature}</p>
                            <Badge variant="outline">{feature.effort} effort</Badge>
                          </div>
                          <p className="text-sm text-gray-600">{feature.rationale}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Bug Fix Priorities */}
              {recommendations.bug_fix_priorities?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Wrench className="w-5 h-5 text-orange-600" />
                      Bug Fix Priorities
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {recommendations.bug_fix_priorities.map((bug, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-orange-50 rounded border border-orange-200">
                          <span className="text-sm">{bug.bug}</span>
                          <Badge className={getPriorityColor(bug.severity)}>
                            {bug.severity}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Content Updates */}
              {recommendations.content_updates?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      Content Update Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {recommendations.content_updates.map((update, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-green-600 mt-1">→</span>
                          <span>{update}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Overall Strategy */}
              <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-indigo-600" />
                    Improvement Strategy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700">{recommendations.improvement_strategy}</p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
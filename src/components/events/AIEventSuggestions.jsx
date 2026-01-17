import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, Calendar, Trophy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function AIEventSuggestions({ gameId, onSelectSuggestion }) {
  const [suggestions, setSuggestions] = useState([]);

  const generateSuggestionsMutation = useMutation({
    mutationFn: async () => {
      // Get player engagement data
      const engagements = await base44.entities.GameEngagement.filter({ game_id: gameId }, '-updated_date', 100);
      const game = await base44.entities.Game.filter({ id: gameId });
      
      const avgPlaytime = engagements.reduce((sum, e) => sum + (e.time_spent || 0), 0) / engagements.length || 0;
      const activeUsers = new Set(engagements.map(e => e.user_id)).size;
      const peakActivity = engagements.filter(e => {
        const hour = new Date(e.updated_date).getHours();
        return hour >= 18 && hour <= 22;
      }).length;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze player engagement data and suggest 3 optimal in-game events.

Game: ${game[0]?.title}
Category: ${game[0]?.category}
Active Players: ${activeUsers}
Avg Session Length: ${Math.round(avgPlaytime)}m
Peak Activity: ${((peakActivity / engagements.length) * 100).toFixed(1)}% evening players

Generate 3 event suggestions that will:
1. Maximize player engagement based on current patterns
2. Re-engage dormant players
3. Incentivize spending and retention
4. Match the game's category and style

Consider current date/season and trending gaming events.`,
        response_json_schema: {
          type: 'object',
          properties: {
            suggestions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  event_type: { type: 'string' },
                  description: { type: 'string' },
                  duration_hours: { type: 'number' },
                  expected_engagement: { type: 'string' },
                  reward_multiplier: { type: 'number' },
                  reward_credits: { type: 'number' },
                  optimal_start_time: { type: 'string' },
                  rationale: { type: 'string' }
                }
              }
            }
          }
        }
      });

      return result.suggestions;
    },
    onSuccess: (data) => {
      setSuggestions(data);
      toast.success('AI suggestions generated!');
    }
  });

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          AI Event Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <div className="text-center py-8">
            <TrendingUp className="w-16 h-16 text-purple-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">
              Get AI-powered event suggestions based on your player engagement data
            </p>
            <Button
              onClick={() => generateSuggestionsMutation.mutate()}
              disabled={generateSuggestionsMutation.isPending}
              className="bg-gradient-to-r from-purple-600 to-pink-600"
            >
              {generateSuggestionsMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Suggestions
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {suggestions.map((suggestion, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <div className="bg-white rounded-lg p-4 border-2 border-purple-200">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-bold text-lg">{suggestion.title}</h4>
                      <Badge className="mt-1 capitalize">{suggestion.event_type.replace(/_/g, ' ')}</Badge>
                    </div>
                    <Badge variant="outline" className="text-green-600">
                      {suggestion.expected_engagement}
                    </Badge>
                  </div>

                  <p className="text-sm text-gray-600 mb-3">{suggestion.description}</p>

                  <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span>{suggestion.duration_hours}h duration</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-yellow-600" />
                      <span>{suggestion.reward_multiplier}x rewards</span>
                    </div>
                  </div>

                  <div className="bg-purple-50 rounded p-3 mb-3">
                    <p className="text-xs text-gray-600">
                      <strong>AI Insight:</strong> {suggestion.rationale}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => onSelectSuggestion(suggestion)}
                    className="w-full"
                  >
                    Use This Event
                  </Button>
                </div>
              </motion.div>
            ))}

            <Button
              variant="outline"
              size="sm"
              onClick={() => generateSuggestionsMutation.mutate()}
              className="w-full"
            >
              Generate New Suggestions
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Target, Users, MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AIOptimizationTools({ game }) {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState(null);

  const { data: gameData } = useQuery({
    queryKey: ['game-ai-data', game?.id],
    queryFn: async () => {
      const engagement = await base44.entities.GameEngagement.filter({ game_id: game.id }, '-created_date', 100);
      const reviews = await base44.entities.GameReview.filter({ game_id: game.id });
      const bugs = await base44.entities.BugReport.filter({ game_id: game.id });
      
      return { engagement, reviews, bugs };
    },
    enabled: !!game
  });

  const generateRecommendations = async () => {
    setLoading(true);
    try {
      const avgSession = gameData.engagement.reduce((sum, e) => sum + (e.session_duration || 0), 0) / gameData.engagement.length || 0;
      const negativeReviews = gameData.reviews.filter(r => r.rating <= 2);
      const commonIssues = gameData.bugs.reduce((acc, bug) => {
        acc[bug.category] = (acc[bug.category] || 0) + 1;
        return acc;
      }, {});

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this game data and provide optimization recommendations:

Game: ${game.title}
Category: ${game.category}
Average Session: ${Math.floor(avgSession / 60)} minutes
Total Players: ${gameData.engagement.length}
Negative Reviews: ${negativeReviews.length}
Common Issues: ${JSON.stringify(commonIssues)}

Provide:
1. Game Design Improvements (difficulty, pacing, features)
2. Marketing Strategy (target demographics, channels, messaging)
3. Community Engagement (content ideas, social media strategy)
4. Monetization Optimization`,
        response_json_schema: {
          type: "object",
          properties: {
            design_improvements: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  area: { type: "string" },
                  recommendation: { type: "string" },
                  priority: { type: "string" }
                }
              }
            },
            marketing_strategy: {
              type: "object",
              properties: {
                target_demographics: { type: "array", items: { type: "string" } },
                channels: { type: "array", items: { type: "string" } },
                key_messaging: { type: "string" }
              }
            },
            community_engagement: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  platform: { type: "string" },
                  content_idea: { type: "string" }
                }
              }
            },
            monetization: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      setRecommendations(result);
    } catch (error) {
      toast.error('Failed to generate recommendations');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-6 h-6" />
            AI Optimization Engine
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <Button
            onClick={generateRecommendations}
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Analyzing Game Data...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Generate AI Recommendations
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {recommendations && (
        <div className="space-y-6">
          {/* Design Improvements */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Game Design Improvements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recommendations.design_improvements.map((item, idx) => (
                  <div key={idx} className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-blue-900">{item.area}</span>
                      <Badge className={item.priority === 'high' ? 'bg-red-500' : item.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}>
                        {item.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-blue-800">{item.recommendation}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Marketing Strategy */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Marketing Strategy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Target Demographics</h4>
                  <div className="flex flex-wrap gap-2">
                    {recommendations.marketing_strategy.target_demographics.map((demo, idx) => (
                      <Badge key={idx} className="bg-purple-100 text-purple-700">{demo}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Recommended Channels</h4>
                  <div className="flex flex-wrap gap-2">
                    {recommendations.marketing_strategy.channels.map((channel, idx) => (
                      <Badge key={idx} className="bg-blue-100 text-blue-700">{channel}</Badge>
                    ))}
                  </div>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-semibold mb-2">Key Messaging</h4>
                  <p className="text-sm text-gray-700">{recommendations.marketing_strategy.key_messaging}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Community Engagement */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Community Engagement Ideas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recommendations.community_engagement.map((item, idx) => (
                  <div key={idx} className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-green-600">{item.platform}</Badge>
                    </div>
                    <p className="text-sm text-gray-700">{item.content_idea}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Monetization */}
          <Card>
            <CardHeader>
              <CardTitle>Monetization Strategies</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {recommendations.monetization.map((strategy, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">•</span>
                    <span className="text-sm text-gray-700">{strategy}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
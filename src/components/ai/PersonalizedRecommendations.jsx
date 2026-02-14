import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Gamepad2, FileText, TrendingUp, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function PersonalizedRecommendations({ user }) {
  const [surveyRecs, setSurveyRecs] = React.useState([]);
  const [generating, setGenerating] = useState(false);

  // Fetch user activity data
  const { data: userActivities = [] } = useQuery({
    queryKey: ['user-activities', user?.id],
    queryFn: async () => {
      return await base44.entities.UserActivity.filter(
        { user_id: user.id },
        '-created_date',
        50
      );
    },
    enabled: !!user
  });

  const { data: completedSurveys = [] } = useQuery({
    queryKey: ['completed-surveys', user?.id],
    queryFn: async () => {
      return await base44.entities.Survey.filter(
        { user_id: user.id },
        '-completion_date',
        20
      );
    },
    enabled: !!user
  });

  const { data: gameLibrary = [] } = useQuery({
    queryKey: ['game-library-recs', user?.id],
    queryFn: async () => {
      if (!user?.game_library?.length) return [];
      return await base44.entities.Game.filter({
        id: { $in: user.game_library }
      });
    },
    enabled: !!user
  });

  const generateRecommendationsMutation = useMutation({
    mutationFn: async () => {
      setGenerating(true);
      
      // Build context for AI
      const context = {
        playing_history: gameLibrary.map(g => ({
          title: g.title,
          category: g.category
        })),
        survey_count: completedSurveys.length,
        recent_activities: userActivities.slice(0, 10).map(a => a.activity_type),
        referral_activity: userActivities.filter(a => a.activity_type === 'friend_referred').length,
        user_level: user.level,
        total_points: user.total_points
      };

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an AI recommendation engine for a gaming platform. Based on the user's profile, recommend:
        
1. 3 game recommendations with specific reasons
2. 3 survey topics that align with their interests

User Context:
- Playing History: ${JSON.stringify(context.playing_history)}
- Surveys Completed: ${context.survey_count}
- Recent Activities: ${context.recent_activities.join(', ')}
- User Level: ${context.user_level}
- Referral Activity: ${context.referral_activity} referrals

Provide personalized, specific recommendations with clear reasoning.`,
        response_json_schema: {
          type: 'object',
          properties: {
            game_recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  category: { type: 'string' },
                  reason: { type: 'string' },
                  appeal: { type: 'string' }
                }
              }
            },
            survey_recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  topic: { type: 'string' },
                  reason: { type: 'string' }
                }
              }
            },
            personalized_message: { type: 'string' }
          }
        }
      });

      setGenerating(false);
      return response;
    },
    onSuccess: () => {
      toast.success('AI recommendations generated!');
    }
  });

  const recommendations = generateRecommendationsMutation.data;

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-600" />
            <span>AI-Powered Recommendations</span>
          </div>
          <Button
            size="sm"
            onClick={() => generateRecommendationsMutation.mutate()}
            disabled={generating}
            className="bg-gradient-to-r from-purple-600 to-pink-600"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate
              </>
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!recommendations ? (
          <div className="text-center py-8">
            <Sparkles className="w-12 h-12 text-purple-300 mx-auto mb-3" />
            <p className="text-gray-600 mb-4">Get personalized game and survey recommendations</p>
            <p className="text-sm text-gray-500">Based on your playing history and preferences</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Personalized Message */}
            {recommendations.personalized_message && (
              <div className="p-4 bg-purple-100 rounded-lg border border-purple-200">
                <p className="text-sm text-purple-900">{recommendations.personalized_message}</p>
              </div>
            )}

            {/* Game Recommendations */}
            <div>
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Gamepad2 className="w-5 h-5 text-blue-600" />
                Recommended Games for You
              </h3>
              <div className="space-y-3">
                {recommendations.game_recommendations?.map((rec, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-4 bg-white rounded-lg border border-blue-200"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <Badge className="bg-blue-100 text-blue-700">{rec.category}</Badge>
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{rec.reason}</p>
                    <p className="text-xs text-gray-500 italic">{rec.appeal}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Survey Recommendations */}
            <div>
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-600" />
                Surveys You'll Enjoy
              </h3>
              <div className="space-y-3">
                {recommendations.survey_recommendations?.map((rec, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-4 bg-white rounded-lg border border-green-200"
                  >
                    <p className="font-semibold text-gray-900 mb-1">{rec.topic}</p>
                    <p className="text-sm text-gray-600">{rec.reason}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
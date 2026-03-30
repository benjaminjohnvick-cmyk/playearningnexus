import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Brain, TrendingUp, Zap, Target, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PersonalizedSurveyRecommendations({ user }) {
  const { data: recommendations = [], isLoading, refetch } = useQuery({
    queryKey: ['surveyRecommendations', user?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('recommendSurveys', {});
      return res.data?.recommendations || [];
    },
    enabled: !!user,
  });

  const reasonIcons = {
    interest_match: Target,
    earning_pattern: TrendingUp,
    completion_history: Zap,
    high_payout: TrendingUp,
    trending_popular: Brain,
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 },
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <p>Analyzing your interests...</p>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-gray-500">
          No high-match surveys available yet. Complete more surveys to get better recommendations!
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-indigo-600" />
          AI-Picked for You
        </CardTitle>
        <p className="text-xs text-gray-600 mt-1">Based on your interests & earning patterns</p>
      </CardHeader>
      <CardContent>
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-3"
        >
          {recommendations.slice(0, 5).map((rec, idx) => {
            const ReasonIcon = reasonIcons[rec.match_reason] || Brain;
            return (
              <motion.div key={rec.survey_id} variants={item}>
                <div className="bg-white rounded-lg p-3 border border-indigo-200 hover:border-indigo-400 transition">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm line-clamp-2">{rec.survey_title}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{rec.ai_rationale}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-green-600">${rec.survey_reward.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">{rec.recommendation_score}% match</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <Badge className="text-xs bg-indigo-100 text-indigo-700 border-indigo-200">
                      <ReasonIcon className="w-2.5 h-2.5 mr-1 inline" />
                      {rec.match_reason.replace(/_/g, ' ')}
                    </Badge>
                    <Badge className="text-xs bg-green-100 text-green-700">
                      {rec.probability_to_complete.toFixed(0)}% likely to complete
                    </Badge>
                  </div>

                  {/* Confidence meter */}
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-indigo-400 to-purple-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${rec.recommendation_score}%` }}
                      transition={{ delay: 0.2 }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        <Button
          onClick={() => refetch()}
          variant="outline"
          size="sm"
          className="w-full mt-4"
        >
          Refresh Recommendations
        </Button>
      </CardContent>
    </Card>
  );
}
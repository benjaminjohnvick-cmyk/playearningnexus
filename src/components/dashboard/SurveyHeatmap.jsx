import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Flame, DollarSign, Target } from 'lucide-react';
import { motion } from 'framer-motion';

const SAMPLE_HEATMAP = [
  { topic: 'Technology', region: 'US', trending: 92, reward: 2.50, completion: 78, active: 15 },
  { topic: 'Retail', region: 'CA', trending: 88, reward: 2.20, completion: 81, active: 12 },
  { topic: 'Finance', region: 'NY', trending: 85, reward: 3.10, completion: 72, active: 9 },
  { topic: 'Health & Wellness', region: 'TX', trending: 82, reward: 1.90, completion: 74, active: 8 },
  { topic: 'Travel', region: 'FL', trending: 79, reward: 2.40, completion: 69, active: 7 },
  { topic: 'Food & Beverage', region: 'IL', touring: 76, reward: 1.70, completion: 80, active: 10 },
];

export default function SurveyHeatmap() {
  const { data: heatmapData = [] } = useQuery({
    queryKey: ['survey-heatmap'],
    queryFn: async () => {
      try {
        return await base44.entities.SurveyHeatmapData.list('-trending_score', 20);
      } catch {
        return SAMPLE_HEATMAP;
      }
    },
    refetchInterval: 60000,
  });

  const topTrending = heatmapData.slice(0, 6);
  const maxTrending = Math.max(...topTrending.map(h => h.trending_score || h.trending || 0));

  return (
    <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="relative">
            <Flame className="w-5 h-5 text-orange-600" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
          </div>
          Survey Heatmap — Live Trends
          <Badge className="ml-auto bg-orange-100 text-orange-700 text-xs border-0">Real-time</Badge>
        </CardTitle>
        <p className="text-xs text-gray-500">Trending topics & high-reward regions — complete surveys where demand is highest</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {topTrending.map((item, i) => {
            const score = item.trending_score || item.trending || 0;
            const fillPct = (score / maxTrending) * 100;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-3 rounded-lg bg-white border border-amber-100 hover:border-amber-300 transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900">
                      {item.survey_topic || item.topic}
                      <span className="ml-2 text-xs text-gray-500">• {item.region}</span>
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1 text-xs">
                        <Flame className="w-3 h-3 text-orange-500" />
                        <span className="text-gray-600">{score.toFixed(0)}% trending</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <DollarSign className="w-3 h-3 text-green-600" />
                        <span className="text-gray-600">${(item.avg_reward || 0).toFixed(2)} avg</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <Target className="w-3 h-3 text-blue-600" />
                        <span className="text-gray-600">{item.active_surveys || item.active || 0} active</span>
                      </div>
                    </div>
                  </div>
                  <Badge className="bg-gradient-to-r from-orange-400 to-red-500 text-white text-xs border-0 font-bold flex-shrink-0">
                    {item.completion_rate || 75}% complete
                  </Badge>
                </div>

                {/* Trending bar */}
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="bg-gradient-to-r from-orange-400 to-red-500 h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${fillPct}%` }}
                    transition={{ duration: 0.6, delay: i * 0.05 + 0.2 }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-4 p-3 bg-orange-100/50 border border-orange-200 rounded-lg text-xs text-gray-700">
          <p className="font-semibold mb-1">💡 Pro Tip:</p>
          <p>Complete surveys in trending regions to maximize earnings. High completion rates = higher approval odds.</p>
        </div>
      </CardContent>
    </Card>
  );
}
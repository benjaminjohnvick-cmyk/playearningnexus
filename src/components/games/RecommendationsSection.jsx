import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import GameCard from './GameCard';

export default function RecommendationsSection({ userId }) {
  const { data: recommendations = [], isLoading } = useQuery({
    queryKey: ['recommendations', userId],
    queryFn: () => base44.entities.UserRecommendation.filter({ user_id: userId }, '-relevance_score', 10),
    enabled: !!userId
  });

  const { data: games = [] } = useQuery({
    queryKey: ['allGames'],
    queryFn: () => base44.entities.Game.list()
  });

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-gray-100 rounded-lg" />;
  }

  const recommendedGames = recommendations
    .map(rec => games.find(g => g.id === rec.game_id))
    .filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="w-6 h-6 text-purple-600" />
        <h2 className="text-2xl font-bold">AI Recommendations For You</h2>
        <Badge className="bg-gradient-to-r from-purple-600 to-pink-600">Powered by AI</Badge>
      </div>

      {recommendedGames.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">Play more games to get personalized recommendations!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recommendedGames.map((game, index) => {
            const rec = recommendations.find(r => r.game_id === game.id);
            return (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <GameCard game={game} showRecommendationBadge>
                  <div className="mt-2 flex items-center gap-2 text-xs text-purple-600">
                    <TrendingUp className="w-3 h-3" />
                    <span>{rec?.reason || 'Recommended for you'}</span>
                  </div>
                  {rec?.relevance_score && (
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs font-medium">{(rec.relevance_score * 100).toFixed(0)}% match</span>
                    </div>
                  )}
                </GameCard>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
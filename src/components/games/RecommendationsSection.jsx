import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import GameCard from './GameCard';

export default function RecommendationsSection({ userId, currentGame }) {
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: games = [] } = useQuery({
    queryKey: ['allGames'],
    queryFn: () => base44.entities.Game.filter({ marketplace_approved: true })
  });

  const { data: engagements = [] } = useQuery({
    queryKey: ['userEngagements', userId],
    queryFn: () => base44.entities.GameEngagement.filter({ user_id: userId }),
    enabled: !!userId
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['userReviews', userId],
    queryFn: () => base44.entities.GameReview.filter({ user_id: userId }),
    enabled: !!userId
  });

  useEffect(() => {
    if (currentGame && games.length > 0) {
      generateRecommendations();
    }
  }, [currentGame, games]);

  const generateRecommendations = async () => {
    setIsGenerating(true);
    try {
      // Filter games by same genre and exclude current game
      const sameGenreGames = games.filter(
        g => g.category === currentGame?.category && g.id !== currentGame?.id && g.status === 'approved'
      );

      // Get user's favorite games from engagement data
      const topPlayedGameIds = engagements
        .sort((a, b) => (b.duration_minutes || 0) - (a.duration_minutes || 0))
        .slice(0, 5)
        .map(e => e.game_id);

      const topPlayedGames = games.filter(g => topPlayedGameIds.includes(g.id));

      // Get highly rated games from user reviews
      const likedGames = reviews.filter(r => r.rating >= 4).map(r => r.game_id);

      const prompt = currentGame 
        ? `Based on the current game "${currentGame.title}" (${currentGame.category}) and the user's gaming history, recommend 4 similar games.

Current Game: ${currentGame.title}
Genre: ${currentGame.category}
Description: ${currentGame.description?.substring(0, 200)}

User's Top Played Games: ${topPlayedGames.map(g => g.title).join(', ') || 'None yet'}
User's Highly Rated Games: ${likedGames.length} games rated 4+ stars

Available Similar Games:
${sameGenreGames.slice(0, 30).map(g => `- ${g.title}: ${g.description?.substring(0, 100)}...`).join('\n')}

Return 4 game recommendations with reasoning based on similarity to current game and user preferences.`
        : `Recommend 4 games for this user based on their gaming history.

User's Top Played Games: ${topPlayedGames.map(g => `${g.title} (${g.category})`).join(', ') || 'None yet'}
User's Highly Rated Games: ${likedGames.length} games rated 4+ stars

Available Games:
${games.slice(0, 50).map(g => `- ${g.title} (${g.category})`).join('\n')}`;

      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  game_title: { type: 'string' },
                  reason: { type: 'string' },
                  match_score: { type: 'number' }
                }
              }
            }
          }
        }
      });

      const matchedGames = aiResponse.recommendations
        .map(rec => {
          const game = games.find(g => 
            g.title.toLowerCase() === rec.game_title.toLowerCase() ||
            g.title.toLowerCase().includes(rec.game_title.toLowerCase())
          );
          return game ? { ...game, reason: rec.reason, match_score: rec.match_score } : null;
        })
        .filter(Boolean)
        .slice(0, 4);

      setAiRecommendations(matchedGames);
    } catch (error) {
      console.error('Error generating recommendations:', error);
      // Fallback to simple genre-based recommendations
      const fallback = games
        .filter(g => g.category === currentGame?.category && g.id !== currentGame?.id)
        .sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0))
        .slice(0, 4)
        .map(g => ({ ...g, reason: 'Similar genre and highly rated', match_score: 75 }));
      setAiRecommendations(fallback);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isGenerating) {
    return <div className="animate-pulse h-64 bg-gray-100 rounded-lg" />;
  }

  const title = currentGame ? "You Might Also Like" : "Recommended For You";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="w-6 h-6 text-purple-600" />
        <h2 className="text-2xl font-bold">{title}</h2>
        <Badge className="bg-gradient-to-r from-purple-600 to-pink-600">AI Powered</Badge>
      </div>

      {aiRecommendations.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">Loading personalized recommendations...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {aiRecommendations.map((game, index) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="hover:shadow-lg transition-all cursor-pointer">
                <CardContent className="p-4">
                  {game.icon_url && (
                    <img 
                      src={game.icon_url} 
                      alt={game.title} 
                      className="w-full h-32 rounded-lg object-cover mb-3" 
                    />
                  )}
                  <h3 className="font-bold mb-1 line-clamp-1">{game.title}</h3>
                  <Badge className="capitalize text-xs mb-2">{game.category}</Badge>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-3 h-3 text-purple-600" />
                    <span className="text-xs font-medium text-purple-600">
                      {game.match_score || 75}% Match
                    </span>
                  </div>
                  
                  <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                    {game.reason}
                  </p>
                  
                  {game.average_rating > 0 && (
                    <div className="flex items-center gap-1 mt-2">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs font-medium">{game.average_rating.toFixed(1)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
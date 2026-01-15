import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AIRecommendations({ user }) {
  const [recommendations, setRecommendations] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch user's transaction history
  const { data: transactions = [] } = useQuery({
    queryKey: ['userTransactions', user.id],
    queryFn: () => base44.entities.Transaction.filter({ user_id: user.id, status: 'completed' }),
    enabled: !!user
  });

  // Fetch user's engagement data
  const { data: engagements = [] } = useQuery({
    queryKey: ['userEngagements', user.id],
    queryFn: () => base44.entities.GameEngagement.filter({ user_id: user.id }),
    enabled: !!user
  });

  // Fetch all available games
  const { data: allGames = [] } = useQuery({
    queryKey: ['allGames'],
    queryFn: () => base44.entities.Game.filter({ marketplace_approved: true })
  });

  const generateRecommendations = async () => {
    setIsGenerating(true);
    
    try {
      // Get purchased game IDs
      const purchasedGameIds = transactions
        .filter(t => t.game_id)
        .map(t => t.game_id);
      
      const purchasedGames = allGames.filter(g => purchasedGameIds.includes(g.id));
      
      // Calculate playtime per game
      const playtimeByGame = engagements.reduce((acc, e) => {
        acc[e.game_id] = (acc[e.game_id] || 0) + (e.duration_minutes || 0);
        return acc;
      }, {});

      // Get top played games
      const topPlayedGames = purchasedGames
        .map(g => ({ ...g, playtime: playtimeByGame[g.id] || 0 }))
        .sort((a, b) => b.playtime - a.playtime)
        .slice(0, 5);

      // Get favorite genres
      const genreCounts = purchasedGames.reduce((acc, g) => {
        acc[g.category] = (acc[g.category] || 0) + 1;
        return acc;
      }, {});

      const favoriteGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([genre]) => genre)
        .slice(0, 3);

      // Get games user hasn't purchased
      const availableGames = allGames.filter(g => !purchasedGameIds.includes(g.id));

      // Use AI to generate recommendations
      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a game recommendation AI. Based on the user's gaming history, recommend 4 games from the available list.

User's Gaming Profile:
- Top Played Games: ${topPlayedGames.map(g => `${g.title} (${g.category}, ${g.playtime} min)`).join(', ') || 'None yet'}
- Favorite Genres: ${favoriteGenres.join(', ') || 'None yet'}
- Total Games Owned: ${purchasedGames.length}
- Total Playtime: ${Object.values(playtimeByGame).reduce((sum, t) => sum + t, 0)} minutes

Available Games to Recommend From:
${availableGames.slice(0, 50).map(g => `- ${g.title} (${g.category}) - ${g.description?.substring(0, 100)}...`).join('\n')}

Return exactly 4 game recommendations with reasoning. Focus on variety and user preferences.`,
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

      // Match AI recommendations with actual game objects
      const recommendedGames = aiResponse.recommendations
        .map(rec => {
          const game = availableGames.find(g => 
            g.title.toLowerCase() === rec.game_title.toLowerCase() ||
            g.title.toLowerCase().includes(rec.game_title.toLowerCase())
          );
          return game ? { ...game, reason: rec.reason, match_score: rec.match_score } : null;
        })
        .filter(Boolean)
        .slice(0, 4);

      setRecommendations(recommendedGames);
    } catch (error) {
      console.error('Error generating recommendations:', error);
      // Fallback to simple recommendations
      const fallback = allGames
        .filter(g => !transactions.some(t => t.game_id === g.id))
        .sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0))
        .slice(0, 4)
        .map(g => ({ ...g, reason: 'Top rated game you haven\'t tried yet', match_score: 85 }));
      
      setRecommendations(fallback);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            AI Recommendations For You
          </CardTitle>
          <Button
            onClick={generateRecommendations}
            disabled={isGenerating}
            variant="outline"
            size="sm"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Get Recommendations
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!recommendations && !isGenerating && (
          <div className="text-center py-8 text-gray-500">
            <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Click "Get Recommendations" to discover games personalized for you!</p>
          </div>
        )}

        {isGenerating && (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 mx-auto mb-3 text-purple-600 animate-spin" />
            <p className="text-gray-600">Analyzing your gaming preferences...</p>
          </div>
        )}

        {recommendations && recommendations.length > 0 && (
          <div className="grid md:grid-cols-2 gap-4">
            {recommendations.map((game, idx) => (
              <Link key={game.id} to={createPageUrl('GameDetail') + `?id=${game.id}`}>
                <Card className="hover:shadow-lg transition-all cursor-pointer h-full">
                  <CardContent className="p-4">
                    <div className="flex gap-3 mb-3">
                      {game.icon_url && (
                        <img 
                          src={game.icon_url} 
                          alt={game.title} 
                          className="w-16 h-16 rounded-lg object-cover" 
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="font-bold mb-1">{game.title}</h3>
                        <Badge className="capitalize text-xs">{game.category}</Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-600">
                        {game.match_score || 85}% Match
                      </span>
                    </div>
                    
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {game.reason}
                    </p>
                    
                    {game.price > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <span className="text-sm font-bold text-green-700">
                          ${game.price.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {recommendations && recommendations.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No new recommendations available at the moment.</p>
            <p className="text-sm mt-2">Try playing more games to improve our suggestions!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
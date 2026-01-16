import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart, Star, Gamepad2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

export default function FavoriteGames({ userId, isOwnProfile }) {
  const { data: user } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => base44.entities.User.filter({ id: userId }).then(u => u[0])
  });

  const { data: favoriteGames = [] } = useQuery({
    queryKey: ['favoriteGames', user?.favorite_games],
    queryFn: () => {
      if (!user?.favorite_games?.length) return [];
      return base44.entities.Game.filter({ id: { $in: user.favorite_games } });
    },
    enabled: !!user?.favorite_games?.length
  });

  const { data: ratings = [] } = useQuery({
    queryKey: ['gameRatings', userId],
    queryFn: () => base44.entities.GameRating.filter({ user_id: userId }),
    enabled: !!userId
  });

  const toggleFavorite = async (gameId) => {
    try {
      const currentFavorites = user.favorite_games || [];
      const newFavorites = currentFavorites.includes(gameId)
        ? currentFavorites.filter(id => id !== gameId)
        : [...currentFavorites, gameId];
      
      await base44.auth.updateMe({ favorite_games: newFavorites });
      toast.success(currentFavorites.includes(gameId) ? 'Removed from favorites' : 'Added to favorites');
    } catch (error) {
      toast.error('Failed to update favorites');
    }
  };

  if (!favoriteGames.length && !isOwnProfile) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          <Heart className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No favorite games yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-red-500" />
          Favorite Games
        </CardTitle>
      </CardHeader>
      <CardContent>
        {favoriteGames.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-4">
            {favoriteGames.map(game => {
              const userRating = ratings.find(r => r.game_id === game.id);
              return (
                <div key={game.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:shadow-md transition-shadow">
                  <img 
                    src={game.icon_url} 
                    alt={game.title}
                    className="w-16 h-16 rounded-lg shadow-sm"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 truncate">{game.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      {userRating && (
                        <div className="flex items-center gap-1 text-sm">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-gray-600">{userRating.rating}/5</span>
                        </div>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {game.category}
                      </Badge>
                    </div>
                  </div>
                  {isOwnProfile && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleFavorite(game.id)}
                    >
                      <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Gamepad2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No favorite games selected</p>
            {isOwnProfile && (
              <Link to={createPageUrl('GameStore')}>
                <button className="mt-2 text-blue-600 hover:underline text-sm">
                  Browse Games →
                </button>
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
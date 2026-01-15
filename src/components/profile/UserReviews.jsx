import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import moment from 'moment';

export default function UserReviews({ userId, ratings }) {
  const { data: games = [] } = useQuery({
    queryKey: ['allGames'],
    queryFn: () => base44.entities.Game.list()
  });

  if (ratings.length === 0) {
    return (
      <Card className="p-12 text-center">
        <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500 text-lg">No reviews yet</p>
        <p className="text-sm text-gray-400 mt-2">Start playing games and share your thoughts!</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {ratings.map((rating) => {
        const game = games.find(g => g.id === rating.game_id);
        if (!game) return null;

        return (
          <Card key={rating.id}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                {game.icon_url && (
                  <img 
                    src={game.icon_url} 
                    alt={game.title}
                    className="w-20 h-20 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <Link to={createPageUrl('GameDetail') + `?id=${game.id}`}>
                        <h4 className="font-bold text-lg hover:text-blue-600">{game.title}</h4>
                      </Link>
                      <Badge variant="outline" className="capitalize">{game.category}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-5 h-5 ${
                            i < rating.rating
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {rating.review && (
                    <p className="text-gray-700 mb-2">{rating.review}</p>
                  )}
                  
                  <p className="text-xs text-gray-500">
                    Reviewed {moment(rating.created_date).fromNow()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
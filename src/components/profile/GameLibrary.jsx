import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Gamepad2, Star, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import moment from 'moment';

export default function GameLibrary({ userId, transactions }) {
  const gamePurchases = transactions.filter(t => 
    t.transaction_type === 'game_purchase' && 
    (t.status === 'completed' || t.status === 'pending_survey')
  );

  const { data: games = [] } = useQuery({
    queryKey: ['libraryGames', userId],
    queryFn: async () => {
      const gameIds = [...new Set(gamePurchases.map(t => t.game_id))];
      if (gameIds.length === 0) return [];
      
      const allGames = await base44.entities.Game.list();
      return allGames.filter(g => gameIds.includes(g.id));
    },
    enabled: gamePurchases.length > 0
  });

  const { data: ratings = [] } = useQuery({
    queryKey: ['gameRatings'],
    queryFn: () => base44.entities.GameRating.list()
  });

  if (games.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Gamepad2 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500 text-lg">No games in library yet</p>
        <p className="text-sm text-gray-400 mt-2">Start exploring the game store!</p>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {games.map((game, index) => {
        const purchase = gamePurchases.find(t => t.game_id === game.id);
        const gameRatings = ratings.filter(r => r.game_id === game.id);
        const avgRating = gameRatings.length > 0
          ? gameRatings.reduce((sum, r) => sum + r.rating, 0) / gameRatings.length
          : 0;

        return (
          <motion.div
            key={game.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Link to={createPageUrl('GameDetail') + `?id=${game.id}`}>
              <Card className="cursor-pointer hover:shadow-xl transition-all h-full">
                {game.icon_url && (
                  <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
                    <img src={game.icon_url} alt={game.title} className="w-full h-full object-cover" />
                    {purchase?.status === 'pending_survey' && (
                      <Badge className="absolute top-2 right-2 bg-orange-600">
                        Pending Survey
                      </Badge>
                    )}
                  </div>
                )}
                <CardContent className="p-4">
                  <h3 className="font-bold text-lg mb-2 line-clamp-1">{game.title}</h3>
                  <Badge variant="outline" className="mb-3 capitalize">{game.category}</Badge>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm font-medium">{avgRating.toFixed(1)}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    Added {moment(purchase?.created_date).fromNow()}
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, ShoppingCart, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function WishlistDisplay({ userId, isOwnProfile }) {
  const queryClient = useQueryClient();

  const { data: wishlistGames = [] } = useQuery({
    queryKey: ['wishlist', userId],
    queryFn: async () => {
      const user = await base44.entities.User.filter({ id: userId });
      const wishlist = user[0]?.wishlist || [];
      if (wishlist.length === 0) return [];
      return await base44.entities.Game.filter({ id: { $in: wishlist } });
    },
    enabled: !!userId
  });

  const removeFromWishlistMutation = useMutation({
    mutationFn: async (gameId) => {
      const user = await base44.auth.me();
      const updatedWishlist = (user.wishlist || []).filter(id => id !== gameId);
      await base44.auth.updateMe({ wishlist: updatedWishlist });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['wishlist']);
      toast.success('Removed from wishlist');
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-red-500" />
          Wishlist ({wishlistGames.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {wishlistGames.length === 0 ? (
          <div className="text-center py-8">
            <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No games in wishlist</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {wishlistGames.map((game, idx) => (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1 }}
              >
                <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border-2 border-gray-200">
                  {isOwnProfile && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={() => removeFromWishlistMutation.mutate(game.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                  <Link to={createPageUrl('GameDetail') + `?id=${game.id}`}>
                    <div className="flex gap-3">
                      {game.icon_url && (
                        <img src={game.icon_url} alt={game.title} className="w-16 h-16 rounded object-cover" />
                      )}
                      <div className="flex-1">
                        <p className="font-semibold mb-1">{game.title}</p>
                        <p className="text-2xl font-bold text-green-600">
                          {game.price ? `$${game.price.toFixed(2)}` : 'FREE'}
                        </p>
                        <Badge variant="outline" className="mt-2 capitalize">
                          {game.category}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
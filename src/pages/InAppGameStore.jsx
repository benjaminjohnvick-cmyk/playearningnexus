import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  ShoppingCart, 
  Star, 
  DollarSign,
  Filter,
  Check,
  CreditCard,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

export default function InAppGameStore() {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [checkoutGame, setCheckoutGame] = useState(null);
  const [processingPurchase, setProcessingPurchase] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  const { data: games = [], isLoading } = useQuery({
    queryKey: ['store-games', selectedCategory, searchQuery],
    queryFn: async () => {
      let filter = { marketplace_approved: true };
      if (selectedCategory !== 'all') {
        filter.category = selectedCategory;
      }
      const allGames = await base44.entities.Game.filter(filter);
      
      if (searchQuery) {
        return allGames.filter(g => 
          g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          g.description?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      return allGames;
    }
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['game-reviews', checkoutGame?.id],
    queryFn: async () => {
      if (!checkoutGame) return [];
      return await base44.entities.GameReview.filter({ game_id: checkoutGame.id });
    },
    enabled: !!checkoutGame
  });

  const purchaseGameMutation = useMutation({
    mutationFn: async (game) => {
      setProcessingPurchase(true);
      
      // Check balance
      if (user.current_balance < game.price) {
        throw new Error('Insufficient balance');
      }

      // Deduct from balance
      await base44.auth.updateMe({
        current_balance: user.current_balance - game.price,
        game_library: [...(user.game_library || []), game.id]
      });

      // Create transaction
      await base44.entities.Transaction.create({
        user_id: user.id,
        game_id: game.id,
        business_client_id: game.developer_id,
        amount: game.price,
        transaction_type: 'game_purchase',
        status: 'completed'
      });

      // Update game revenue
      await base44.entities.Game.update(game.id, {
        total_revenue: (game.total_revenue || 0) + game.price,
        total_installs: (game.total_installs || 0) + 1
      });

      // Log activity
      await base44.entities.UserActivity.create({
        user_id: user.id,
        activity_type: 'game_installed',
        points_earned: 50,
        description: `Purchased ${game.title}`,
        related_entity_id: game.id
      });

      setProcessingPurchase(false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      setCheckoutGame(null);
      toast.success('Game purchased successfully!');
      window.location.reload();
    },
    onError: (error) => {
      setProcessingPurchase(false);
      toast.error(error.message || 'Purchase failed');
    }
  });

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  const categories = ['all', 'puzzle', 'action', 'strategy', 'casual', 'rpg', 'simulation', 'sports', 'racing', 'adventure'];

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <ShoppingCart className="w-10 h-10 text-blue-600" />
                Game Store
              </h1>
              <p className="text-gray-600">Browse and purchase games with your balance</p>
            </div>
            <Card className="p-4 border-2 border-green-500">
              <div className="text-center">
                <p className="text-sm text-gray-600">Your Balance</p>
                <p className="text-2xl font-bold text-green-600">
                  ${(user.current_balance || 0).toFixed(2)}
                </p>
              </div>
            </Card>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search games..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <Filter className="w-5 h-5 text-gray-500 flex-shrink-0" />
            {categories.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={selectedCategory === cat ? "default" : "outline"}
                onClick={() => setSelectedCategory(cat)}
                className="capitalize flex-shrink-0"
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {/* Games Grid */}
        {isLoading ? (
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-96 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        ) : games.length === 0 ? (
          <Card className="p-12 text-center">
            <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No games found</p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {games.map((game) => {
              const owned = user.game_library?.includes(game.id);
              
              return (
                <Card key={game.id} className="border-0 shadow-lg hover:shadow-xl transition-all">
                  <CardHeader className="p-0">
                    {game.icon_url ? (
                      <img
                        src={game.icon_url}
                        alt={game.title}
                        className="w-full h-48 object-cover rounded-t-xl"
                      />
                    ) : (
                      <div className="w-full h-48 bg-gradient-to-br from-blue-400 to-purple-600 rounded-t-xl" />
                    )}
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-lg text-gray-900">{game.title}</h3>
                      <Badge className="bg-blue-100 text-blue-700 capitalize">
                        {game.category}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {game.description}
                    </p>

                    <div className="flex items-center gap-2 mb-3">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span className="text-sm font-medium">
                        {(game.average_rating || 0).toFixed(1)}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({game.total_ratings || 0} reviews)
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t">
                      <div>
                        <p className="text-2xl font-bold text-green-600">
                          ${game.price.toFixed(2)}
                        </p>
                      </div>
                      {owned ? (
                        <Badge className="bg-green-100 text-green-700">
                          <Check className="w-4 h-4 mr-1" />
                          Owned
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => setCheckoutGame(game)}
                          className="bg-blue-600"
                        >
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          Buy
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Checkout Dialog */}
      {checkoutGame && (
        <Dialog open={!!checkoutGame} onOpenChange={() => setCheckoutGame(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Purchase Game</DialogTitle>
            </DialogHeader>
            
            <Tabs defaultValue="details">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                {checkoutGame.icon_url && (
                  <img
                    src={checkoutGame.icon_url}
                    alt={checkoutGame.title}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                )}
                
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {checkoutGame.title}
                  </h3>
                  <p className="text-gray-600">{checkoutGame.description}</p>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <Badge className="capitalize">{checkoutGame.category}</Badge>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span>{avgRating.toFixed(1)}</span>
                  </div>
                  <span>{checkoutGame.total_installs || 0} installs</span>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-700">Game Price:</span>
                    <span className="text-2xl font-bold text-blue-600">
                      ${checkoutGame.price.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Your Balance:</span>
                    <span className="font-semibold">
                      ${(user.current_balance || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-2 border-t mt-2">
                    <span className="text-gray-600">After Purchase:</span>
                    <span className="font-semibold text-green-600">
                      ${((user.current_balance || 0) - checkoutGame.price).toFixed(2)}
                    </span>
                  </div>
                </div>

                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => purchaseGameMutation.mutate(checkoutGame)}
                  disabled={processingPurchase || (user.current_balance || 0) < checkoutGame.price}
                >
                  {processingPurchase ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Complete Purchase
                    </>
                  )}
                </Button>

                {(user.current_balance || 0) < checkoutGame.price && (
                  <p className="text-sm text-red-600 text-center">
                    Insufficient balance. Complete more surveys to earn credits!
                  </p>
                )}
              </TabsContent>

              <TabsContent value="reviews">
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {reviews.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No reviews yet</p>
                  ) : (
                    reviews.map((review) => (
                      <div key={review.id} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-4 h-4 ${
                                  i < review.rating
                                    ? 'text-yellow-500 fill-yellow-500'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(review.created_date).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{review.review_text}</p>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
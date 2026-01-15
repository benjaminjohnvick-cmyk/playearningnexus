import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Store, Search, Star, TrendingUp, Sparkles, ShoppingCart, Filter, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import GamePurchaseModal from '../components/payments/GamePurchaseModal';

export default function GameStore() {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('trending');
  const [selectedGame, setSelectedGame] = useState(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Not authenticated');
      }
    };
    fetchUser();
  }, []);

  const { data: games = [] } = useQuery({
    queryKey: ['storeGames'],
    queryFn: () => base44.entities.Game.filter({ marketplace_approved: true })
  });

  const { data: recommendations = [] } = useQuery({
    queryKey: ['recommendations', user?.id],
    queryFn: () => base44.entities.UserRecommendation.filter({ user_id: user.id }, '-relevance_score', 6),
    enabled: !!user
  });

  const { data: ratings = [] } = useQuery({
    queryKey: ['gameRatings'],
    queryFn: () => base44.entities.GameRating.list()
  });

  const handlePurchase = (game, paymentMethod = 'credit_card') => {
    if (!user) {
      base44.auth.redirectToLogin();
      return;
    }

    // If game is free, purchase directly
    if (!game.price || game.price === 0) {
      purchaseGameMutation.mutate(game);
    } else if (paymentMethod === 'survey') {
      // Handle survey payment directly
      handleSurveyPurchase(game);
    } else {
      // Show payment modal for paid games
      setSelectedGame(game);
      setShowPurchaseModal(true);
    }
  };

  const handleSurveyPurchase = async (game) => {
    try {
      await base44.entities.Transaction.create({
        user_id: user.id,
        game_id: game.id,
        transaction_type: 'game_purchase',
        amount: game.price || 0,
        status: 'pending_survey',
        payment_method: 'survey'
      });

      await base44.analytics.track({
        eventName: 'game_purchased_survey',
        properties: {
          game_id: game.id,
          game_title: game.title,
          amount: game.price || 0
        }
      });

      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Survey payment initiated! Complete surveys to unlock your game.');
    } catch (error) {
      toast.error('Failed to initiate survey payment');
    }
  };

  const purchaseGameMutation = useMutation({
    mutationFn: async (game) => {
      // Create transaction for free games
      await base44.entities.Transaction.create({
        user_id: user.id,
        game_id: game.id,
        transaction_type: 'game_purchase',
        amount: 0,
        status: 'completed'
      });

      // Track analytics
      await base44.analytics.track({
        eventName: 'game_purchased_free',
        properties: {
          game_id: game.id,
          game_title: game.title,
          category: game.category
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Game added to your library!');
    }
  });

  // Filter and sort games
  let filteredGames = games.filter(game => {
    const matchesSearch = game.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || game.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (sortBy === 'trending') {
    filteredGames = filteredGames.sort((a, b) => (b.total_installs || 0) - (a.total_installs || 0));
  } else if (sortBy === 'rating') {
    filteredGames = filteredGames.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
  } else if (sortBy === 'new') {
    filteredGames = filteredGames.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  }

  const recommendedGames = recommendations
    .map(rec => games.find(g => g.id === rec.game_id))
    .filter(Boolean);

  const trendingGames = [...games]
    .sort((a, b) => (b.total_installs || 0) - (a.total_installs || 0))
    .slice(0, 4);

  const categories = ['puzzle', 'action', 'strategy', 'casual', 'rpg', 'simulation', 'sports', 'racing', 'adventure'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Store className="w-10 h-10 text-red-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
              Game Store
            </h1>
          </div>
          <p className="text-gray-600 text-lg">Discover amazing games and earn rewards</p>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search games..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trending">Trending</SelectItem>
                  <SelectItem value="rating">Top Rated</SelectItem>
                  <SelectItem value="new">New Releases</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="all" className="space-y-6">
          <TabsList>
            <TabsTrigger value="all">All Games</TabsTrigger>
            <TabsTrigger value="recommended">
              <Sparkles className="w-4 h-4 mr-2" />
              For You
            </TabsTrigger>
            <TabsTrigger value="trending">
              <TrendingUp className="w-4 h-4 mr-2" />
              Trending
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredGames.map((game, index) => (
                <GameStoreCard
                  key={game.id}
                  game={game}
                  index={index}
                  user={user}
                  ratings={ratings}
                  onPurchase={(paymentMethod) => handlePurchase(game, paymentMethod)}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="recommended">
            {!user ? (
              <Card className="p-12 text-center">
                <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 mb-4">Sign in to get AI-powered game recommendations</p>
                <Button onClick={() => base44.auth.redirectToLogin()}>Sign In</Button>
              </Card>
            ) : recommendedGames.length === 0 ? (
              <Card className="p-12 text-center">
                <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">Play more games to get personalized recommendations!</p>
              </Card>
            ) : (
              <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
                {recommendedGames.map((game, index) => (
                  <GameStoreCard
                    key={game.id}
                    game={game}
                    index={index}
                    user={user}
                    ratings={ratings}
                    isRecommended
                    onPurchase={(paymentMethod) => handlePurchase(game, paymentMethod)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="trending">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {trendingGames.map((game, index) => (
                <GameStoreCard
                  key={game.id}
                  game={game}
                  index={index}
                  user={user}
                  ratings={ratings}
                  onPurchase={(paymentMethod) => handlePurchase(game, paymentMethod)}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Purchase Modal */}
        {selectedGame && (
          <GamePurchaseModal
            game={selectedGame}
            open={showPurchaseModal}
            onClose={() => {
              setShowPurchaseModal(false);
              setSelectedGame(null);
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['transactions'] });
            }}
          />
        )}
      </div>
    </div>
  );
}

function GameStoreCard({ game, index, user, ratings, isRecommended, onPurchase }) {
  const gameRatings = ratings.filter(r => r.game_id === game.id);
  const avgRating = gameRatings.length > 0
    ? gameRatings.reduce((sum, r) => sum + r.rating, 0) / gameRatings.length
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ scale: 1.05 }}
    >
      <Link to={createPageUrl('GameDetail') + `?id=${game.id}`}>
        <Card className={`cursor-pointer hover:shadow-xl transition-all ${isRecommended ? 'border-2 border-purple-300' : ''}`}>
          {game.icon_url && (
            <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
              <img src={game.icon_url} alt={game.title} className="w-full h-full object-cover" />
              {isRecommended && (
                <Badge className="absolute top-2 right-2 bg-purple-600">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Recommended
                </Badge>
              )}
            </div>
          )}
          <CardContent className="p-4">
            <h3 className="font-bold text-lg mb-1 line-clamp-1">{game.title}</h3>
            <Badge variant="outline" className="mb-2 capitalize">{game.category}</Badge>
            <div className="flex items-center gap-1 mb-3">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-medium">{avgRating.toFixed(1)}</span>
              <span className="text-xs text-gray-500">({gameRatings.length})</span>
            </div>
            <p className="text-xs text-gray-600 line-clamp-2 mb-3">{game.description}</p>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">Price:</span>
              <span className="text-lg font-bold text-green-600">
                {!game.price || game.price === 0 ? 'FREE' : `$${game.price.toFixed(2)}`}
              </span>
            </div>
            <div className="space-y-2">
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  onPurchase('credit_card');
                }}
                className="w-full bg-gradient-to-r from-red-600 to-red-700"
                size="sm"
              >
                <ShoppingCart className="w-3 h-3 mr-2" />
                {!game.price || game.price === 0 ? 'Get Free' : 'Buy Now'}
              </Button>
              {game.price > 0 && (
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    onPurchase('survey');
                  }}
                  variant="outline"
                  className="w-full border-purple-600 text-purple-600 hover:bg-purple-50"
                  size="sm"
                >
                  <FileText className="w-3 h-3 mr-2" />
                  Pay with Surveys
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, ShoppingCart, Star, DollarSign, Filter, Check, Heart, Package, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import ProductSearchBar from '@/components/store/ProductSearchBar';
import ProductSearchResults from '@/components/store/ProductSearchResults';
import ProductRecommendations from '@/components/products/ProductRecommendations';
import DailyEarningsMeter from '@/components/premium/DailyEarningsMeter';
import LockoutModeEnforcer from '@/components/premium/LockoutModeEnforcer';
import SurveyGate, { isSurveyGoalMet } from '@/components/surveys/SurveyGate';
import BitLabsSurveys from '@/components/surveys/BitLabsSurveys';
import GameCheckoutModal from '@/components/store/GameCheckoutModal';

const CATEGORIES = ['all', 'puzzle', 'action', 'strategy', 'casual', 'rpg', 'simulation', 'sports', 'racing', 'adventure'];

export default function InAppGameStore() {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('popular');
  const [priceRange, setPriceRange] = useState('all');
  const [checkoutGame, setCheckoutGame] = useState(null);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productSearchResults, setProductSearchResults] = useState(null);
  const [activeTab, setActiveTab] = useState('games');
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: games = [], isLoading } = useQuery({
    queryKey: ['store-games', selectedCategory, searchQuery, sortBy, priceRange],
    queryFn: async () => {
      let filter = { marketplace_approved: true };
      if (selectedCategory !== 'all') filter.category = selectedCategory;
      let allGames = await base44.entities.Game.filter(filter);

      if (searchQuery) {
        allGames = allGames.filter(g =>
          g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          g.description?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      if (priceRange === 'free') allGames = allGames.filter(g => g.price === 0);
      else if (priceRange === 'under5') allGames = allGames.filter(g => g.price > 0 && g.price < 5);
      else if (priceRange === '5to10') allGames = allGames.filter(g => g.price >= 5 && g.price <= 10);
      else if (priceRange === 'over10') allGames = allGames.filter(g => g.price > 10);

      if (sortBy === 'price_low') allGames.sort((a, b) => a.price - b.price);
      else if (sortBy === 'price_high') allGames.sort((a, b) => b.price - a.price);
      else if (sortBy === 'rating') allGames.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
      else if (sortBy === 'popular') allGames.sort((a, b) => (b.total_installs || 0) - (a.total_installs || 0));
      else if (sortBy === 'new') allGames.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

      return allGames;
    }
  });

  const { data: dailyEarnings } = useQuery({
    queryKey: ['daily-earnings', user?.id, today],
    queryFn: async () => {
      const earnings = await base44.entities.DailyEarnings.filter({ user_id: user.id, date: today });
      return earnings[0];
    },
    enabled: !!user,
    refetchInterval: 5000
  });

  const { data: premiumMembership } = useQuery({
    queryKey: ['premium-membership', user?.id],
    queryFn: async () => {
      const m = await base44.entities.PremiumMembership.filter({ user_id: user.id });
      return m[0];
    },
    enabled: !!user
  });

  const toggleWishlist = async (game) => {
    const wishlist = user.wishlist || [];
    const isWishlisted = wishlist.some(item => item.id === game.id && item.type === 'game');
    const updatedWishlist = isWishlisted
      ? wishlist.filter(item => !(item.id === game.id && item.type === 'game'))
      : [...wishlist, { id: game.id, type: 'game', added_date: new Date().toISOString() }];
    await base44.auth.updateMe({ wishlist: updatedWishlist });
    const updatedUser = await base44.auth.me();
    setUser(updatedUser);
    toast.success(isWishlisted ? 'Removed from wishlist' : 'Added to wishlist');
  };

  const handlePurchaseComplete = async () => {
    const updatedUser = await base44.auth.me();
    setUser(updatedUser);
    setCheckoutGame(null);
  };

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-1 flex items-center gap-3">
              <ShoppingCart className="w-9 h-9 text-red-600" /> Game Store
            </h1>
            <p className="text-gray-500">Browse and purchase games with your survey balance or PayPal</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setShowProductSearch(true)} className="bg-purple-600 hover:bg-purple-700">
              <Package className="w-4 h-4 mr-2" /> Search Products
            </Button>
            <Card className="px-4 py-2 border-2 border-green-500 bg-green-50">
              <p className="text-xs text-gray-500">Balance</p>
              <p className="text-xl font-bold text-green-600">${(user.current_balance || 0).toFixed(2)}</p>
            </Card>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="games" className="text-base">
              <ShoppingCart className="w-4 h-4 mr-2" /> Browse Games
            </TabsTrigger>
            <TabsTrigger value="surveys" className="text-base">
              <DollarSign className="w-4 h-4 mr-2" /> Complete Surveys
            </TabsTrigger>
          </TabsList>

          {/* Surveys Tab */}
          <TabsContent value="surveys" className="space-y-6">
            <DailyEarningsMeter
              todaysEarnings={dailyEarnings?.total_earned || 0}
              dailyGoal={premiumMembership?.daily_goal || 3}
            />
            {premiumMembership && <LockoutModeEnforcer user={user} />}
            <BitLabsSurveys user={user} onEarningsUpdate={() => queryClient.invalidateQueries(['daily-earnings'])} />
          </TabsContent>

          {/* Games Tab */}
          <TabsContent value="games" className="space-y-6">
            {!isSurveyGoalMet(dailyEarnings?.total_earned || 0) ? (
              <SurveyGate
                todaysEarnings={dailyEarnings?.total_earned || 0}
                dailyGoal={3}
                onGoToSurveys={() => setActiveTab('surveys')}
              />
            ) : (
              <>
                <ProductRecommendations user={user} />

                {/* Search & Filters */}
                <div className="space-y-4">
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
                    <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    {CATEGORIES.map(cat => (
                      <Button key={cat} size="sm" variant={selectedCategory === cat ? 'default' : 'outline'}
                        onClick={() => setSelectedCategory(cat)}
                        className={`capitalize flex-shrink-0 ${selectedCategory === cat ? 'bg-red-600 hover:bg-red-700' : ''}`}>
                        {cat}
                      </Button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">Sort:</span>
                      <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm">
                        <option value="popular">Most Popular</option>
                        <option value="new">Newest</option>
                        <option value="rating">Highest Rated</option>
                        <option value="price_low">Price: Low → High</option>
                        <option value="price_high">Price: High → Low</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Price:</span>
                      <select value={priceRange} onChange={e => setPriceRange(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm">
                        <option value="all">All Prices</option>
                        <option value="free">Free</option>
                        <option value="under5">Under $5</option>
                        <option value="5to10">$5 – $10</option>
                        <option value="over10">Over $10</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Games Grid */}
                {isLoading ? (
                  <div className="grid md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => <div key={i} className="h-96 bg-white rounded-xl animate-pulse" />)}
                  </div>
                ) : games.length === 0 ? (
                  <Card className="p-12 text-center border-0 shadow-lg">
                    <ShoppingCart className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                    <p className="text-gray-400">No games found matching your filters</p>
                  </Card>
                ) : (
                  <div className="grid md:grid-cols-3 gap-6">
                    {games.map(game => {
                      const owned = user.game_library?.includes(game.id);
                      const isWishlisted = user.wishlist?.some(item => item.id === game.id && item.type === 'game');
                      return (
                        <Card key={game.id} className="border-0 shadow-lg hover:shadow-xl transition-all group">
                          <div className="relative overflow-hidden rounded-t-xl">
                            {game.icon_url
                              ? <img src={game.icon_url} alt={game.title} className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300" />
                              : <div className="w-full h-48 bg-gradient-to-br from-red-400 to-rose-600" />}
                            {owned && (
                              <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                <Check className="w-3 h-3" /> Owned
                              </div>
                            )}
                          </div>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-1">
                              <h3 className="font-bold text-gray-900 leading-tight">{game.title}</h3>
                              <Badge className="bg-red-100 text-red-700 capitalize text-xs ml-2 flex-shrink-0">{game.category}</Badge>
                            </div>
                            <p className="text-xs text-gray-500 mb-3 line-clamp-2">{game.description}</p>
                            <div className="flex items-center gap-1 mb-3">
                              <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                              <span className="text-sm font-medium">{(game.average_rating || 0).toFixed(1)}</span>
                              <span className="text-xs text-gray-400">({game.total_ratings || 0})</span>
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t gap-2">
                              <p className="text-xl font-bold text-green-600">${game.price.toFixed(2)}</p>
                              {owned ? (
                                <Badge className="bg-green-100 text-green-700 text-xs">In Library</Badge>
                              ) : (
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline"
                                    onClick={() => toggleWishlist(game)}
                                    className={isWishlisted ? 'border-red-400 text-red-600 bg-red-50' : ''}>
                                    <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-red-500 text-red-500' : ''}`} />
                                  </Button>
                                  <Button size="sm" className="bg-red-600 hover:bg-red-700"
                                    onClick={() => setCheckoutGame(game)}>
                                    <ShoppingCart className="w-4 h-4 mr-1" /> Buy
                                  </Button>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Checkout Modal */}
      <GameCheckoutModal
        game={checkoutGame}
        user={user}
        onClose={() => setCheckoutGame(null)}
        onPurchaseComplete={handlePurchaseComplete}
      />

      {/* Product Search */}
      {showProductSearch && (
        <ProductSearchBar
          onSearchResults={(products, sq, si) => { setProductSearchResults({ products, searchQuery: sq, searchImage: si }); setShowProductSearch(false); }}
          onClose={() => setShowProductSearch(false)}
        />
      )}
      {productSearchResults && (
        <ProductSearchResults
          products={productSearchResults.products}
          searchQuery={productSearchResults.searchQuery}
          searchImage={productSearchResults.searchImage}
          user={user}
          onClose={() => setProductSearchResults(null)}
        />
      )}
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "pk_test_YOUR_KEY");
import { 
  Search, 
  ShoppingCart, 
  Star, 
  DollarSign,
  Filter,
  Check,
  CreditCard,
  Loader2,
  FileText,
  Heart,
  Package,
  SlidersHorizontal
} from "lucide-react";
import { toast } from "sonner";
import ProductSearchBar from '../components/store/ProductSearchBar';
import ProductSearchResults from '../components/store/ProductSearchResults';
import ProductRecommendations from '../components/products/ProductRecommendations';
import DailyEarningsMeter from '../components/premium/DailyEarningsMeter';
import LockoutModeEnforcer from '../components/premium/LockoutModeEnforcer';

function StripeCheckoutForm({ game, user, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);

    try {
      const { data: intentData } = await base44.functions.invoke('createStripePaymentIntent', {
        gameId: game.id,
        amount: Math.round(game.price * 100)
      });

      if (intentData.error) {
        throw new Error(intentData.error);
      }

      const { error, paymentIntent } = await stripe.confirmCardPayment(intentData.clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (paymentIntent.status === 'succeeded') {
        const { data: result } = await base44.functions.invoke('completeStripePayment', {
          paymentIntentId: paymentIntent.id,
          gameId: game.id
        });

        if (result.error) {
          throw new Error(result.error);
        }

        toast.success('Game purchased successfully!');
        onSuccess();
      }
    } catch (error) {
      toast.error(error.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border rounded-lg">
        <CardElement options={{
          style: {
            base: {
              fontSize: '16px',
              color: '#424770',
              '::placeholder': { color: '#aab7c4' },
            },
            invalid: { color: '#9e2146' },
          },
        }} />
      </div>
      <Button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-blue-600 hover:bg-blue-700"
      >
        {processing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4 mr-2" />
            Pay ${game.price.toFixed(2)}
          </>
        )}
      </Button>
      <p className="text-xs text-center text-gray-500">
        Secure payment powered by Stripe
      </p>
    </form>
  );
}

export default function InAppGameStore() {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('popular');
  const [priceRange, setPriceRange] = useState('all');
  const [checkoutGame, setCheckoutGame] = useState(null);
  const [processingPurchase, setProcessingPurchase] = useState(false);
  const [showStripeCheckout, setShowStripeCheckout] = useState(false);
  const [showPayPalCheckout, setShowPayPalCheckout] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productSearchResults, setProductSearchResults] = useState(null);
  const [activeTab, setActiveTab] = useState('games');
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

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
    queryKey: ['store-games', selectedCategory, searchQuery, sortBy, priceRange],
    queryFn: async () => {
      let filter = { marketplace_approved: true };
      if (selectedCategory !== 'all') {
        filter.category = selectedCategory;
      }
      let allGames = await base44.entities.Game.filter(filter);
      
      // Search filtering
      if (searchQuery) {
        allGames = allGames.filter(g => 
          g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          g.description?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      // Price range filtering
      if (priceRange !== 'all') {
        if (priceRange === 'free') {
          allGames = allGames.filter(g => g.price === 0);
        } else if (priceRange === 'under5') {
          allGames = allGames.filter(g => g.price > 0 && g.price < 5);
        } else if (priceRange === '5to10') {
          allGames = allGames.filter(g => g.price >= 5 && g.price <= 10);
        } else if (priceRange === 'over10') {
          allGames = allGames.filter(g => g.price > 10);
        }
      }

      // Sorting
      if (sortBy === 'price_low') {
        allGames.sort((a, b) => a.price - b.price);
      } else if (sortBy === 'price_high') {
        allGames.sort((a, b) => b.price - a.price);
      } else if (sortBy === 'rating') {
        allGames.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
      } else if (sortBy === 'popular') {
        allGames.sort((a, b) => (b.total_installs || 0) - (a.total_installs || 0));
      } else if (sortBy === 'new') {
        allGames.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
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

  const { data: dailyEarnings } = useQuery({
    queryKey: ['daily-earnings', user?.id, today],
    queryFn: async () => {
      const earnings = await base44.entities.DailyEarnings.filter({ 
        user_id: user.id, 
        date: today 
      });
      return earnings[0];
    },
    enabled: !!user,
    refetchInterval: 5000
  });

  const { data: premiumMembership } = useQuery({
    queryKey: ['premium-membership', user?.id],
    queryFn: async () => {
      const memberships = await base44.entities.PremiumMembership.filter({ user_id: user.id });
      return memberships[0];
    },
    enabled: !!user
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

  const toggleWishlist = async (game) => {
    try {
      const wishlist = user.wishlist || [];
      const isWishlisted = wishlist.some(item => item.id === game.id && item.type === 'game');
      
      const updatedWishlist = isWishlisted
        ? wishlist.filter(item => !(item.id === game.id && item.type === 'game'))
        : [...wishlist, { id: game.id, type: 'game', added_date: new Date().toISOString() }];
      
      await base44.auth.updateMe({ wishlist: updatedWishlist });
      const updatedUser = await base44.auth.me();
      setUser(updatedUser);
      
      toast.success(isWishlisted ? 'Removed from wishlist' : 'Added to wishlist');
    } catch (error) {
      toast.error('Failed to update wishlist');
    }
  };

  const handleProductSearchResults = (products, searchQuery, searchImage) => {
    setProductSearchResults({ products, searchQuery, searchImage });
    setShowProductSearch(false);
  };

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
            <div className="flex gap-3">
              <Button
                onClick={() => setShowProductSearch(true)}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Package className="w-4 h-4 mr-2" />
                Search online for any products you want and pay with surveys
              </Button>
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
        </div>

        {/* Tabs for Games vs Surveys */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="games" className="text-lg">
              <ShoppingCart className="w-5 h-5 mr-2" />
              Browse Games
            </TabsTrigger>
            <TabsTrigger value="surveys" className="text-lg">
              <DollarSign className="w-5 h-5 mr-2" />
              Complete Surveys
            </TabsTrigger>
          </TabsList>

          <TabsContent value="surveys" className="space-y-6">
            {/* Daily Earnings Meter */}
            <DailyEarningsMeter 
              todaysEarnings={dailyEarnings?.total_earned || 0}
              dailyGoal={premiumMembership?.daily_goal || 3}
            />

            {/* Lockout Mode (if premium member) */}
            {premiumMembership && (
              <LockoutModeEnforcer user={user} />
            )}

            {/* Survey Placeholder */}
            <Card className="p-8 text-center border-2 border-blue-200">
              <DollarSign className="w-16 h-16 text-blue-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Complete Surveys to Earn</h3>
              <p className="text-gray-600 mb-4">
                Earn money by completing surveys. Your earnings go towards your daily goal and can be used to purchase games.
              </p>
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600">
                Start Survey
              </Button>
              <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-sm text-gray-700">
                  <strong>Note:</strong> 50/50 revenue split applies. Complete $6 in surveys to earn $3.
                </p>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="games" className="space-y-6">
            {/* AI Recommendations */}
            <ProductRecommendations user={user} />

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

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-gray-500" />
              <span className="text-sm text-gray-600">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border rounded px-3 py-1 text-sm"
              >
                <option value="popular">Most Popular</option>
                <option value="new">Newest</option>
                <option value="rating">Highest Rated</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Price:</span>
              <select
                value={priceRange}
                onChange={(e) => setPriceRange(e.target.value)}
                className="border rounded px-3 py-1 text-sm"
              >
                <option value="all">All Prices</option>
                <option value="free">Free</option>
                <option value="under5">Under $5</option>
                <option value="5to10">$5 - $10</option>
                <option value="over10">Over $10</option>
              </select>
            </div>
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
              const isWishlisted = user.wishlist?.some(item => item.id === game.id && item.type === 'game');
              
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
                        <div className="flex flex-col gap-2 w-full">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => setCheckoutGame(game)}
                              className="bg-blue-600 flex-1"
                            >
                              <ShoppingCart className="w-4 h-4 mr-2" />
                              Buy
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleWishlist(game);
                              }}
                              className={isWishlisted ? "bg-red-50 border-red-500 text-red-600" : "border-gray-300"}
                            >
                              <Heart className={`w-4 h-4 mr-1 ${isWishlisted ? 'fill-red-500' : ''}`} />
                              Wishlist
                            </Button>
                          </div>
                          <Button
                           size="sm"
                           variant="outline"
                           onClick={() => {
                             setCheckoutGame(game);
                             setShowStripeCheckout(true);
                           }}
                           className="border-blue-600 text-blue-600 hover:bg-blue-50 w-full"
                          >
                           <CreditCard className="w-4 h-4 mr-1" />
                           Pay with Card
                          </Button>
                          <Button
                           size="sm"
                           variant="outline"
                           onClick={() => {
                             setCheckoutGame(game);
                             setShowPayPalCheckout(true);
                           }}
                           className="border-[#0070ba] text-[#0070ba] hover:bg-blue-50 w-full"
                          >
                           <DollarSign className="w-4 h-4 mr-1" />
                           Pay with PayPal
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
          </TabsContent>
        </Tabs>
      </div>

      {/* Checkout Dialog */}
      {checkoutGame && (
        <Dialog open={!!checkoutGame} onOpenChange={() => {
          setCheckoutGame(null);
          setShowStripeCheckout(false);
          setShowPayPalCheckout(false);
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Purchase Game</DialogTitle>
            </DialogHeader>
            
            <Tabs defaultValue={showStripeCheckout ? "stripe" : showPayPalCheckout ? "paypal" : "details"}>
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="stripe">Credit Card</TabsTrigger>
                <TabsTrigger value="paypal">PayPal</TabsTrigger>
                <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="stripe" className="space-y-4">
                {checkoutGame.icon_url && (
                  <img
                    src={checkoutGame.icon_url}
                    alt={checkoutGame.title}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                )}
                
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    {checkoutGame.title}
                  </h3>
                  <p className="text-2xl font-bold text-blue-600">
                    ${checkoutGame.price.toFixed(2)}
                  </p>
                </div>

                <Elements stripe={stripePromise}>
                  <StripeCheckoutForm
                    game={checkoutGame}
                    user={user}
                    onSuccess={() => {
                      queryClient.invalidateQueries();
                      setCheckoutGame(null);
                      setShowStripeCheckout(false);
                      window.location.reload();
                    }}
                  />
                </Elements>
              </TabsContent>

              <TabsContent value="paypal" className="space-y-4">
                {checkoutGame.icon_url && (
                  <img
                    src={checkoutGame.icon_url}
                    alt={checkoutGame.title}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                )}
                
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    {checkoutGame.title}
                  </h3>
                  <p className="text-2xl font-bold text-[#0070ba]">
                    ${checkoutGame.price.toFixed(2)}
                  </p>
                </div>

                <PayPalScriptProvider options={{ 
                  "client-id": import.meta.env.VITE_PAYPAL_CLIENT_ID || "test",
                  currency: "USD"
                }}>
                  <PayPalButtons
                    style={{ layout: "vertical" }}
                    createOrder={(data, actions) => {
                      return actions.order.create({
                        purchase_units: [{
                          amount: {
                            value: checkoutGame.price.toFixed(2),
                          },
                          description: checkoutGame.title,
                        }],
                      });
                    }}
                    onApprove={async (data, actions) => {
                      const order = await actions.order.capture();
                      
                      // Process purchase
                      try {
                        await base44.auth.updateMe({
                          game_library: [...(user.game_library || []), checkoutGame.id]
                        });

                        await base44.entities.Transaction.create({
                          user_id: user.id,
                          game_id: checkoutGame.id,
                          business_client_id: checkoutGame.developer_id,
                          amount: checkoutGame.price,
                          transaction_type: 'game_purchase',
                          status: 'completed',
                          payment_method: 'paypal',
                          payment_intent_id: order.id
                        });

                        await base44.entities.Game.update(checkoutGame.id, {
                          total_revenue: (checkoutGame.total_revenue || 0) + checkoutGame.price,
                          total_installs: (checkoutGame.total_installs || 0) + 1
                        });

                        await base44.entities.UserActivity.create({
                          user_id: user.id,
                          activity_type: 'game_installed',
                          points_earned: 50,
                          description: `Purchased ${checkoutGame.title}`,
                          related_entity_id: checkoutGame.id
                        });

                        toast.success('Game purchased successfully with PayPal!');
                        queryClient.invalidateQueries();
                        setCheckoutGame(null);
                        setShowPayPalCheckout(false);
                        window.location.reload();
                      } catch (error) {
                        toast.error('Purchase processing failed');
                      }
                    }}
                    onError={(err) => {
                      toast.error('PayPal payment failed');
                      console.error(err);
                    }}
                  />
                </PayPalScriptProvider>

                <p className="text-xs text-center text-gray-500">
                  Secure payment powered by PayPal
                </p>
              </TabsContent>

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

      {/* Product Search Bar */}
      {showProductSearch && (
        <ProductSearchBar
          onSearchResults={handleProductSearchResults}
          onClose={() => setShowProductSearch(false)}
        />
      )}

      {/* Product Search Results Sidebar */}
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
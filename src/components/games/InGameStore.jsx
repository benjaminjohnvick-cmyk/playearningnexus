import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ShoppingCart, 
  Coins, 
  Sparkles, 
  Zap,
  Lock,
  Star,
  DollarSign,
  Gem
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function InGameStore({ game, user }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const queryClient = useQueryClient();

  // Fetch store products
  const { data: products = [] } = useQuery({
    queryKey: ['products', game?.id],
    queryFn: () => base44.entities.Product.filter({
      game_id: game.id,
      is_active: true
    }),
    enabled: !!game
  });

  // Get user's credit balance from earnings
  const userCredits = user?.total_earnings || 0;

  // Fetch user's virtual currencies
  const { data: currencies = [] } = useQuery({
    queryKey: ['virtualCurrency', user?.id],
    queryFn: () => base44.entities.VirtualCurrency.filter({ user_id: user.id }),
    enabled: !!user
  });

  const getCurrencyBalance = (type) => {
    const currency = currencies.find(c => c.currency_type === type);
    return currency?.balance || 0;
  };

  // Purchase mutation
  const purchaseMutation = useMutation({
    mutationFn: async ({ product, paymentMethod, currencyType }) => {
      let currencyUsed = paymentMethod === 'credits' ? 'CREDITS' : currencyType?.toUpperCase();
      let amountCharged = product.price_credits;

      // Handle virtual currency payment
      if (paymentMethod === 'virtual' && currencyType) {
        const currency = currencies.find(c => c.currency_type === currencyType);
        if (!currency || currency.balance < product.price_credits) {
          throw new Error(`Insufficient ${currencyType}`);
        }
        
        // Deduct virtual currency
        await base44.entities.VirtualCurrency.update(currency.id, {
          balance: currency.balance - product.price_credits,
          total_spent: currency.total_spent + product.price_credits
        });
        currencyUsed = currencyType.toUpperCase();
      } else if (paymentMethod === 'credits') {
        // Check survey credits
        if (userCredits < product.price_credits) {
          throw new Error('Insufficient credits');
        }
        
        // Deduct survey credits
        await base44.auth.updateMe({
          total_earnings: userCredits - product.price_credits
        });
      }

      // Create transaction
      const transaction = await base44.entities.Transaction.create({
        user_id: user.id,
        game_id: game.id,
        product_id: product.id,
        amount: amountCharged,
        currency: currencyUsed,
        transaction_type: 'in_game_purchase',
        status: 'completed'
      });

      // Update product sales
      await base44.entities.Product.update(product.id, {
        total_sales: (product.total_sales || 0) + 1,
        stock_quantity: product.stock_quantity ? product.stock_quantity - 1 : null
      });

      // Add to user inventory
      await base44.entities.UserInventory.create({
        user_id: user.id,
        product_id: product.id,
        game_id: game.id,
        quantity: 1,
        acquired_date: new Date().toISOString()
      });

      return transaction;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['products']);
      toast.success(`${variables.product.name} purchased!`, {
        description: `Enjoy your new ${variables.product.product_type}!`
      });
      
      // Track analytics
      base44.analytics.track({
        eventName: 'in_game_purchase',
        properties: {
          game_id: game.id,
          product_id: variables.product.id,
          amount: variables.product.price_credits,
          payment_method: variables.paymentMethod
        }
      });
    },
    onError: (error) => {
      toast.error('Purchase failed', {
        description: error.message
      });
    }
  });

  const handlePurchase = (product, paymentMethod = 'credits', currencyType = null) => {
    purchaseMutation.mutate({ product, paymentMethod, currencyType });
  };

  const categoryIcons = {
    cosmetic: Sparkles,
    powerup: Zap,
    currency: Coins,
    unlock: Lock,
    consumable: Star
  };

  const filteredProducts = selectedCategory === 'all' 
    ? products 
    : products.filter(p => p.product_type === selectedCategory);

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-purple-600 to-blue-600 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-6 h-6" />
            <h3 className="text-xl font-bold">In-Game Store</h3>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 bg-black/30 px-3 py-1 rounded-full">
              <Coins className="w-4 h-4 text-green-400" />
              <span className="font-bold text-sm">{userCredits.toFixed(2)}</span>
              <span className="text-xs text-gray-300">Survey Credits</span>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-1 bg-black/30 px-2 py-1 rounded-full text-xs">
                <Coins className="w-3 h-3 text-yellow-400" />
                <span className="font-bold">{getCurrencyBalance('coins')}</span>
              </div>
              <div className="flex items-center gap-1 bg-black/30 px-2 py-1 rounded-full text-xs">
                <Gem className="w-3 h-3 text-purple-400" />
                <span className="font-bold">{getCurrencyBalance('gems')}</span>
              </div>
              <div className="flex items-center gap-1 bg-black/30 px-2 py-1 rounded-full text-xs">
                <Zap className="w-3 h-3 text-blue-400" />
                <span className="font-bold">{getCurrencyBalance('tokens')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="flex-1 flex flex-col">
        <TabsList className="bg-gray-800 border-b border-gray-700 rounded-none">
          <TabsTrigger value="all" className="data-[state=active]:bg-gray-700">All Items</TabsTrigger>
          <TabsTrigger value="cosmetic" className="data-[state=active]:bg-gray-700">Cosmetics</TabsTrigger>
          <TabsTrigger value="powerup" className="data-[state=active]:bg-gray-700">Power-ups</TabsTrigger>
          <TabsTrigger value="currency" className="data-[state=active]:bg-gray-700">Currency</TabsTrigger>
          <TabsTrigger value="unlock" className="data-[state=active]:bg-gray-700">Unlocks</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedCategory} className="flex-1 overflow-y-auto p-4">
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProducts.map(product => {
                const Icon = categoryIcons[product.product_type] || Star;
                const canAfford = userCredits >= product.price_credits;
                
                return (
                  <Card key={product.id} className="bg-gray-800 border-gray-700 overflow-hidden hover:border-purple-500 transition-colors">
                    <div className="p-4">
                      <div className="flex gap-4">
                        {/* Product Icon */}
                        <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          {product.icon_url ? (
                            <img src={product.icon_url} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <Icon className="w-10 h-10 text-white" />
                          )}
                        </div>

                        {/* Product Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-bold text-white mb-1">{product.name}</h4>
                              <Badge variant="outline" className="text-xs">
                                {product.product_type}
                              </Badge>
                            </div>
                          </div>
                          
                          <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                            {product.description}
                          </p>

                          {product.currency_amount && (
                            <div className="flex items-center gap-1 text-sm text-yellow-400 mb-3">
                              <Coins className="w-4 h-4" />
                              <span>+{product.currency_amount} coins</span>
                            </div>
                          )}

                          {/* Price & Purchase */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 font-bold text-lg">
                                <Coins className="w-5 h-5 text-yellow-400" />
                                {product.price_credits}
                              </div>
                            </div>

                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                onClick={() => handlePurchase(product, 'credits')}
                                disabled={!canAfford || purchaseMutation.isPending}
                                className={cn(
                                  "flex-1 text-xs bg-green-600 hover:bg-green-700",
                                  !canAfford && "opacity-50 cursor-not-allowed"
                                )}
                              >
                                Survey Credits
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handlePurchase(product, 'virtual', 'coins')}
                                disabled={getCurrencyBalance('coins') < product.price_credits || purchaseMutation.isPending}
                                className="flex-1 text-xs bg-yellow-600 hover:bg-yellow-700"
                              >
                                Coins
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handlePurchase(product, 'virtual', 'gems')}
                                disabled={getCurrencyBalance('gems') < product.price_credits || purchaseMutation.isPending}
                                className="flex-1 text-xs bg-purple-600 hover:bg-purple-700"
                              >
                                Gems
                              </Button>
                            </div>
                          </div>

                          {product.stock_quantity !== null && (
                            <p className="text-xs text-gray-500 mt-2">
                              {product.stock_quantity} left in stock
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400">No items available in this category</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="p-3 bg-gray-800 border-t border-gray-700 text-center">
        <p className="text-xs text-gray-400">
          Earn more credits by completing surveys and playing games!
        </p>
      </div>
    </div>
  );
}
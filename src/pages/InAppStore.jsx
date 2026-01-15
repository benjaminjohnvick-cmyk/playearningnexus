import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, Coins, Zap, Sparkles, Crown } from 'lucide-react';
import { motion } from 'framer-motion';
import InAppPurchaseModal from '../components/payments/InAppPurchaseModal';

export default function InAppStore() {
  const [user, setUser] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const urlParams = new URLSearchParams(window.location.search);
  const gameId = urlParams.get('game_id');

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

  const { data: game } = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => base44.entities.Game.filter({ id: gameId }).then(res => res[0]),
    enabled: !!gameId
  });

  const { data: items = [] } = useQuery({
    queryKey: ['inAppPurchases', gameId],
    queryFn: () => base44.entities.InAppPurchase.filter({ game_id: gameId, is_active: true }),
    enabled: !!gameId
  });

  const handlePurchase = (item) => {
    setSelectedItem(item);
    setShowPurchaseModal(true);
  };

  const getItemIcon = (type) => {
    switch (type) {
      case 'currency': return Coins;
      case 'powerup': return Zap;
      case 'cosmetic': return Sparkles;
      case 'subscription': return Crown;
      default: return ShoppingBag;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingBag className="w-10 h-10 text-purple-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              In-App Store
            </h1>
          </div>
          <p className="text-gray-600 text-lg">
            {game?.title || 'Loading...'} - Enhance your gaming experience
          </p>
          {user && (
            <div className="mt-4 p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg border border-yellow-200">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-yellow-600" />
                <span className="font-semibold">Your Balance:</span>
                <span className="text-xl font-bold text-yellow-600">
                  {user.virtual_currency || 0} coins
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Items Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, index) => {
            const ItemIcon = getItemIcon(item.item_type);
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="hover:shadow-xl transition-all cursor-pointer h-full">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl">
                        <ItemIcon className="w-8 h-8 text-purple-600" />
                      </div>
                      <Badge className="capitalize">{item.item_type}</Badge>
                    </div>
                    
                    <h3 className="font-bold text-xl mb-2">{item.item_name}</h3>
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {item.description}
                    </p>

                    {item.item_type === 'currency' && (
                      <div className="flex items-center gap-2 mb-4 p-2 bg-yellow-50 rounded-lg">
                        <Coins className="w-4 h-4 text-yellow-600" />
                        <span className="text-sm font-medium">
                          Get {item.currency_amount} coins
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-4">
                      <span className="text-3xl font-bold text-purple-600">
                        ${item.price.toFixed(2)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {item.total_purchases || 0} purchases
                      </span>
                    </div>

                    <Button
                      onClick={() => handlePurchase(item)}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                    >
                      <ShoppingBag className="w-4 h-4 mr-2" />
                      Purchase
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {items.length === 0 && (
          <Card className="p-12 text-center">
            <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 text-lg">No items available in this store yet</p>
          </Card>
        )}

        {/* Purchase Modal */}
        {selectedItem && game && (
          <InAppPurchaseModal
            item={selectedItem}
            game={game}
            open={showPurchaseModal}
            onClose={() => {
              setShowPurchaseModal(false);
              setSelectedItem(null);
            }}
            onSuccess={() => {
              // Refresh user data to update virtual currency
              base44.auth.me().then(setUser);
            }}
          />
        )}
      </div>
    </div>
  );
}
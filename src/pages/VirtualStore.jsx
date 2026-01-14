import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingBag, Coins, Gem, Sparkles, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function VirtualStorePage() {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    fetchUser();
  }, []);

  const { data: currency } = useQuery({
    queryKey: ['virtualCurrency', user?.id],
    queryFn: () => base44.entities.VirtualCurrency.filter({ user_id: user?.id }),
    enabled: !!user
  });

  const { data: items = [] } = useQuery({
    queryKey: ['cosmeticItems'],
    queryFn: () => base44.entities.CosmeticItem.filter({ is_available: true })
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['userInventory', user?.id],
    queryFn: () => base44.entities.UserInventory.filter({ user_id: user?.id }),
    enabled: !!user
  });

  const purchaseItemMutation = useMutation({
    mutationFn: async ({ item }) => {
      const userCurrency = currency?.[0] || { balance: 0 };
      if (userCurrency.balance < item.price_coins) {
        throw new Error('Insufficient coins');
      }
      
      await base44.entities.VirtualCurrency.update(userCurrency.id, {
        balance: userCurrency.balance - item.price_coins,
        total_spent: (userCurrency.total_spent || 0) + item.price_coins
      });
      
      await base44.entities.UserInventory.create({
        user_id: user.id,
        cosmetic_item_id: item.id,
        acquired_date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtualCurrency'] });
      queryClient.invalidateQueries({ queryKey: ['userInventory'] });
      toast.success('Item purchased!');
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const rarityColors = {
    common: 'from-gray-400 to-gray-500',
    rare: 'from-blue-400 to-blue-600',
    epic: 'from-purple-500 to-purple-700',
    legendary: 'from-yellow-400 to-orange-600'
  };

  const userCoins = currency?.[0]?.balance || 0;
  const ownedItemIds = inventory.map(i => i.cosmetic_item_id);

  const groupedItems = {
    avatar: items.filter(i => i.item_type === 'avatar'),
    banner: items.filter(i => i.item_type === 'banner'),
    badge: items.filter(i => i.item_type === 'badge'),
    theme: items.filter(i => i.item_type === 'theme')
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent mb-2">
              Virtual Store
            </h1>
            <p className="text-gray-600">Customize your profile with exclusive items</p>
          </div>
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Coins className="w-6 h-6 text-yellow-600" />
                <div>
                  <p className="text-sm text-gray-600">Coins</p>
                  <p className="text-xl font-bold">{userCoins}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Tabs defaultValue="avatar" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="avatar">Avatars</TabsTrigger>
            <TabsTrigger value="banner">Banners</TabsTrigger>
            <TabsTrigger value="badge">Badges</TabsTrigger>
            <TabsTrigger value="theme">Themes</TabsTrigger>
          </TabsList>

          {Object.entries(groupedItems).map(([type, typeItems]) => (
            <TabsContent key={type} value={type}>
              <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
                {typeItems.map((item) => {
                  const owned = ownedItemIds.includes(item.id);
                  const canAfford = userCoins >= item.price_coins;

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.05 }}
                    >
                      <Card className="overflow-hidden hover:shadow-xl transition-shadow">
                        <div className={`h-40 bg-gradient-to-br ${rarityColors[item.rarity]} flex items-center justify-center relative`}>
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.item_name} className="w-full h-full object-cover" />
                          ) : (
                            <Sparkles className="w-16 h-16 text-white" />
                          )}
                          <Badge className="absolute top-2 right-2 bg-black/50 backdrop-blur">
                            {item.rarity}
                          </Badge>
                        </div>
                        <CardContent className="p-4">
                          <h3 className="font-bold text-lg mb-1">{item.item_name}</h3>
                          <p className="text-sm text-gray-600 mb-4">{item.description}</p>
                          
                          {owned ? (
                            <Button disabled className="w-full" variant="outline">
                              <Lock className="w-4 h-4 mr-2" />
                              Owned
                            </Button>
                          ) : (
                            <Button
                              onClick={() => purchaseItemMutation.mutate({ item })}
                              disabled={!canAfford || purchaseItemMutation.isPending}
                              className={`w-full ${canAfford ? 'bg-gradient-to-r from-red-600 to-red-700' : ''}`}
                              variant={canAfford ? 'default' : 'outline'}
                            >
                              <Coins className="w-4 h-4 mr-2" />
                              {item.price_coins} Coins
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
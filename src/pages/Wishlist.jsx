import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, Trash2, Bell, BellOff, ShoppingBag, ShoppingCart, Tag, CreditCard } from 'lucide-react';
import BNPLModal from '@/components/store/BNPLModal';
import BNPLBanner from '@/components/store/BNPLBanner';
import OrderViasite from '@/components/store/OrderViaSite';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function Wishlist() {
  const [user, setUser] = useState(null);
  const [showBNPL, setShowBNPL] = useState(false);
  const [orderItem, setOrderItem] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: wishlistItems = [], isLoading } = useQuery({
    queryKey: ['wishlist', user?.id],
    queryFn: () => base44.entities.ProductWishlistItem.filter({ user_id: user.id, status: 'active' }, '-created_date', 50),
    enabled: !!user,
  });

  const removeMutation = useMutation({
    mutationFn: (id) => base44.entities.ProductWishlistItem.update(id, { status: 'archived' }),
    onSuccess: () => { queryClient.invalidateQueries(['wishlist', user?.id]); toast.success('Removed from wishlist'); }
  });

  const toggleNotifMutation = useMutation({
    mutationFn: ({ id, current }) => base44.entities.ProductWishlistItem.update(id, { price_alert_enabled: !current }),
    onSuccess: (_, { current }) => {
      queryClient.invalidateQueries(['wishlist', user?.id]);
      toast.success(current ? 'Price alerts disabled' : 'Price alerts enabled!');
    }
  });

  if (!user) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" /></div>;

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Heart className="w-8 h-8 text-red-500 fill-red-500" />
              My Wishlist
            </h1>
            <p className="text-gray-500 mt-1">Save items and order through GamerGain — prices include 10% platform fee</p>
          </div>
          <div className="w-full mt-4">
            <BNPLBanner
              onActivate={() => setShowBNPL(true)}
              isActive={user?.bnpl_active}
              creditLimit={user?.bnpl_credit_limit}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" /></div>
        ) : wishlistItems.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-20 text-center">
              <Heart className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-500 mb-2">Your wishlist is empty</h3>
              <p className="text-gray-400 text-sm mb-6">Browse games and products and click the ❤️ button to save them here</p>
              <Button onClick={() => window.location.href = '/InAppGameStore'} className="bg-red-600 hover:bg-red-700">
                Browse Store
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {wishlistItems.map((item, idx) => (
                <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ delay: idx * 0.05 }}>
                  <Card className="h-full flex flex-col border shadow-md hover:shadow-lg transition-shadow">
                    {item.product_image_url ? (
                      <div className="relative">
                        <img src={item.product_image_url} alt={item.product_name} className="w-full h-40 object-cover rounded-t-xl" />
                        <button
                          onClick={() => removeMutation.mutate(item.id)}
                          className="absolute top-2 right-2 bg-white/80 hover:bg-white rounded-full p-1.5 shadow transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-full h-40 bg-gradient-to-br from-red-200 to-rose-300 rounded-t-xl flex items-center justify-center">
                        <ShoppingCart className="w-12 h-12 text-white/60" />
                      </div>
                    )}
                    <CardContent className="flex-1 flex flex-col pt-4">
                      <h3 className="font-bold text-gray-900 mb-1 line-clamp-2">{item.product_name}</h3>
                      {item.product_description && (
                        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{item.product_description}</p>
                      )}

                      <div className="mt-auto space-y-3">
                        {/* Pricing */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.price_with_markup && (
                            <span className="text-xl font-bold text-green-600">${item.price_with_markup.toFixed(2)}</span>
                          )}
                          {item.best_price && item.best_price < item.price_with_markup && (
                            <span className="text-sm text-gray-400 line-through">${item.best_price.toFixed(2)}</span>
                          )}
                          {item.vendor_name && (
                            <Badge variant="outline" className="text-xs"><Tag className="w-3 h-3 mr-1" />{item.vendor_name}</Badge>
                          )}
                        </div>

                        {/* Earnings progress */}
                        {item.amount_earned > 0 && (
                          <div className="bg-green-50 rounded-lg p-2">
                            <p className="text-xs text-green-700 font-medium">
                              💰 ${item.amount_earned.toFixed(2)} earned toward this item
                            </p>
                            {item.price_with_markup > 0 && (
                              <div className="mt-1 bg-green-200 rounded-full h-1.5">
                                <div
                                  className="bg-green-500 h-1.5 rounded-full"
                                  style={{ width: `${Math.min(100, (item.amount_earned / item.price_with_markup) * 100)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className={`flex-1 ${item.price_alert_enabled ? 'text-yellow-600 border-yellow-300' : ''}`}
                            onClick={() => toggleNotifMutation.mutate({ id: item.id, current: item.price_alert_enabled })}
                          >
                            {item.price_alert_enabled ? <Bell className="w-3 h-3 mr-1 fill-yellow-400" /> : <BellOff className="w-3 h-3 mr-1" />}
                            {item.price_alert_enabled ? 'Alert On' : 'Alert Off'}
                          </Button>
                          <Button size="sm" className="flex-1 bg-red-600 hover:bg-red-700" onClick={() => setOrderItem(item)}>
                            <ShoppingBag className="w-3 h-3 mr-1" /> Order via Site
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>

      <BNPLModal isOpen={showBNPL} onClose={() => setShowBNPL(false)} user={user} />
      <OrderViasite isOpen={!!orderItem} onClose={() => setOrderItem(null)} user={user} product={orderItem} />
    </>
  );
}
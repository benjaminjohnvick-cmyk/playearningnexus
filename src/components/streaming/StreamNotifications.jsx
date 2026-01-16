import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Heart, Crown, DollarSign } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function StreamNotifications({ streamerId }) {
  const [notifications, setNotifications] = useState([]);

  // Subscribe to tips
  useEffect(() => {
    const unsubscribeTips = base44.entities.StreamerTip.subscribe((event) => {
      if (event.type === 'create' && event.data.streamer_user_id === streamerId && event.data.display_on_stream) {
        addNotification({
          type: 'tip',
          data: event.data,
          icon: event.data.currency === 'USD' ? DollarSign : Heart
        });
        confetti({ particleCount: 50, spread: 60 });
      }
    });

    const unsubscribeGifts = base44.entities.GiftTransaction.subscribe((event) => {
      if (event.type === 'create' && event.data.recipient_id === streamerId) {
        addNotification({
          type: 'gift',
          data: event.data,
          icon: Gift
        });
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
    });

    const unsubscribeSubs = base44.entities.StreamerSubscription.subscribe((event) => {
      if (event.type === 'create' && event.data.streamer_user_id === streamerId) {
        addNotification({
          type: 'subscription',
          data: event.data,
          icon: Crown
        });
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 } });
      }
    });

    return () => {
      unsubscribeTips();
      unsubscribeGifts();
      unsubscribeSubs();
    };
  }, [streamerId]);

  const addNotification = (notification) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { ...notification, id }]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const { data: users = {} } = useQuery({
    queryKey: ['notification-users', notifications],
    queryFn: async () => {
      const userIds = notifications
        .map(n => n.data.tipper_user_id || n.data.sender_id || n.data.subscriber_user_id)
        .filter(Boolean);
      
      if (userIds.length === 0) return {};
      
      const users = await base44.entities.User.filter({ id: { $in: userIds } });
      return users.reduce((acc, user) => ({ ...acc, [user.id]: user }), {});
    },
    enabled: notifications.length > 0
  });

  return (
    <div className="fixed top-20 right-6 z-50 space-y-3 pointer-events-none">
      <AnimatePresence>
        {notifications.map((notification) => {
          const Icon = notification.icon;
          const user = users[notification.data.tipper_user_id || notification.data.sender_id || notification.data.subscriber_user_id];
          
          return (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: 100, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.8 }}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 rounded-lg shadow-2xl max-w-sm pointer-events-auto"
            >
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-full">
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  {notification.type === 'tip' && (
                    <>
                      <p className="font-bold">
                        {notification.data.is_anonymous ? 'Anonymous' : user?.full_name || 'Someone'} sent a tip!
                      </p>
                      <p className="text-sm opacity-90">
                        {notification.data.amount} {notification.data.currency}
                        {notification.data.message && ` - "${notification.data.message}"`}
                      </p>
                    </>
                  )}
                  
                  {notification.type === 'gift' && (
                    <>
                      <p className="font-bold">{user?.full_name || 'Someone'} sent a gift!</p>
                      <p className="text-sm opacity-90">
                        {notification.data.gift_name} ({notification.data.cost} credits)
                      </p>
                    </>
                  )}
                  
                  {notification.type === 'subscription' && (
                    <>
                      <p className="font-bold">{user?.full_name || 'Someone'} subscribed!</p>
                      <p className="text-sm opacity-90">
                        {notification.data.tier} tier - ${notification.data.price_monthly}/month
                      </p>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
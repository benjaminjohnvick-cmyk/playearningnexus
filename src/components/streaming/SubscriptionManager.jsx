import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown, Star, Sparkles, Zap, Check } from 'lucide-react';
import { toast } from 'sonner';

const SUBSCRIPTION_TIERS = {
  bronze: {
    name: 'Bronze',
    price: 4.99,
    icon: Zap,
    color: 'from-orange-400 to-orange-600',
    perks: ['Access to subscriber-only chat', 'Custom badge', 'Priority support']
  },
  silver: {
    name: 'Silver',
    price: 9.99,
    icon: Star,
    color: 'from-gray-300 to-gray-500',
    perks: ['All Bronze perks', 'Exclusive emotes', 'Ad-free viewing', 'Monthly subscriber game']
  },
  gold: {
    name: 'Gold',
    price: 19.99,
    icon: Crown,
    color: 'from-yellow-400 to-yellow-600',
    perks: ['All Silver perks', 'VIP badge', 'Early access to content', 'Monthly 1-on-1 session']
  },
  platinum: {
    name: 'Platinum',
    price: 49.99,
    icon: Sparkles,
    color: 'from-purple-400 to-purple-600',
    perks: ['All Gold perks', 'Platinum badge', 'Custom emotes', 'Influence stream content', 'Private Discord access']
  }
};

export default function SubscriptionManager({ streamer, viewer }) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: activeSubscription } = useQuery({
    queryKey: ['subscription', viewer?.id, streamer?.id],
    queryFn: () => base44.entities.StreamerSubscription.filter({
      subscriber_user_id: viewer.id,
      streamer_user_id: streamer.id,
      is_active: true
    }).then(subs => subs[0]),
    enabled: !!viewer && !!streamer
  });

  const subscribeMutation = useMutation({
    mutationFn: async (tier) => {
      const tierData = SUBSCRIPTION_TIERS[tier];
      
      // Check if user has enough credits
      const creditsNeeded = tierData.price * 100; // Convert to credits
      if (viewer.virtual_currency < creditsNeeded) {
        throw new Error('Insufficient credits. Please purchase more credits.');
      }

      // Cancel existing subscription if any
      if (activeSubscription) {
        await base44.entities.StreamerSubscription.update(activeSubscription.id, {
          is_active: false,
          end_date: new Date().toISOString()
        });
      }

      // Create new subscription
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      await base44.entities.StreamerSubscription.create({
        subscriber_user_id: viewer.id,
        streamer_user_id: streamer.id,
        tier,
        price_monthly: tierData.price,
        perks: tierData.perks,
        start_date: new Date().toISOString(),
        end_date: endDate.toISOString(),
        is_active: true,
        auto_renew: true
      });

      // Deduct credits
      await base44.auth.updateMe({
        virtual_currency: viewer.virtual_currency - creditsNeeded
      });

      // Add revenue to streamer
      await base44.entities.Transaction.create({
        user_id: streamer.id,
        amount: tierData.price,
        currency: 'USD',
        transaction_type: 'subscription',
        status: 'completed'
      });

      // Notify streamer
      await base44.entities.Notification.create({
        user_id: streamer.id,
        title: `New ${tierData.name} Subscriber!`,
        message: `${viewer.full_name} subscribed to your ${tier} tier`,
        notification_type: 'new_subscriber',
        related_entity_id: viewer.id
      });

      // Track analytics
      await base44.analytics.track({
        eventName: 'streamer_subscription',
        properties: { tier, price: tierData.price }
      });
    },
    onSuccess: () => {
      toast.success('Successfully subscribed! 🎉');
      setIsOpen(false);
      queryClient.invalidateQueries(['subscription']);
      queryClient.invalidateQueries(['user']);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to subscribe');
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.StreamerSubscription.update(activeSubscription.id, {
        auto_renew: false
      });
    },
    onSuccess: () => {
      toast.info('Auto-renewal disabled. Subscription will end on ' + 
        new Date(activeSubscription.end_date).toLocaleDateString());
      queryClient.invalidateQueries(['subscription']);
    }
  });

  return (
    <>
      {activeSubscription ? (
        <Badge className={`bg-gradient-to-r ${SUBSCRIPTION_TIERS[activeSubscription.tier].color}`}>
          {SUBSCRIPTION_TIERS[activeSubscription.tier].name} Subscriber
        </Badge>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsOpen(true)}
          className="border-purple-300 text-purple-600 hover:bg-purple-50"
        >
          <Crown className="w-4 h-4 mr-2" />
          Subscribe
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              Subscribe to {streamer.full_name}
            </DialogTitle>
            <p className="text-sm text-gray-600">
              Choose a tier to unlock exclusive perks and support your favorite streamer
            </p>
          </DialogHeader>

          <div className="grid md:grid-cols-2 gap-4 mt-6">
            {Object.entries(SUBSCRIPTION_TIERS).map(([tier, data]) => {
              const Icon = data.icon;
              const isCurrentTier = activeSubscription?.tier === tier;
              
              return (
                <Card 
                  key={tier}
                  className={isCurrentTier ? 'border-2 border-purple-500' : ''}
                >
                  <CardContent className="p-6">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r ${data.color} text-white mb-4`}>
                      <Icon className="w-4 h-4" />
                      <span className="font-bold">{data.name}</span>
                    </div>

                    <div className="mb-4">
                      <span className="text-3xl font-bold">${data.price}</span>
                      <span className="text-gray-600">/month</span>
                    </div>

                    <ul className="space-y-2 mb-6">
                      {data.perks.map((perk, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>{perk}</span>
                        </li>
                      ))}
                    </ul>

                    {isCurrentTier ? (
                      <div className="space-y-2">
                        <Badge className="w-full justify-center py-2">Current Subscription</Badge>
                        {activeSubscription.auto_renew ? (
                          <Button
                            variant="outline"
                            onClick={() => cancelMutation.mutate()}
                            disabled={cancelMutation.isPending}
                            className="w-full"
                          >
                            Cancel Auto-Renewal
                          </Button>
                        ) : (
                          <p className="text-xs text-center text-gray-600">
                            Ends {new Date(activeSubscription.end_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    ) : (
                      <Button
                        onClick={() => subscribeMutation.mutate(tier)}
                        disabled={subscribeMutation.isPending}
                        className={`w-full bg-gradient-to-r ${data.color}`}
                      >
                        {subscribeMutation.isPending ? 'Processing...' : `Subscribe for ${data.price * 100} Credits`}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {activeSubscription && (
            <p className="text-xs text-center text-gray-500 mt-4">
              Upgrading will adjust your billing immediately
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
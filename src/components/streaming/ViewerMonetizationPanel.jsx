import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gift, Heart, Crown } from 'lucide-react';
import SupportStreamerButton from './SupportStreamerButton';
import SubscriptionManager from './SubscriptionManager';
import VirtualGiftsPanel from './VirtualGiftsPanel';

export default function ViewerMonetizationPanel({ streamer, viewer, game }) {
  if (!streamer || !viewer || streamer.id === viewer.id) return null;

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Heart className="w-5 h-5 text-pink-500" />
          Support {streamer.full_name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <SupportStreamerButton streamer={streamer} game={game} viewer={viewer} />
          <SubscriptionManager streamer={streamer} viewer={viewer} />
          <VirtualGiftsPanel streamer={streamer} viewer={viewer} game={game} />
        </div>
        
        <div className="pt-3 border-t border-purple-200">
          <p className="text-xs text-gray-600">
            💝 Show appreciation with tips, subscriptions, or virtual gifts
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
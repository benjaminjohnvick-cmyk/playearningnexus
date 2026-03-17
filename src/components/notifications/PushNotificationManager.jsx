import React, { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notificationService } from '@/lib/notificationService';
import { toast } from 'sonner';

export default function PushNotificationManager() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkSubscriptionStatus();
  }, []);

  const checkSubscriptionStatus = async () => {
    const subscribed = await notificationService.isSubscribed();
    setIsSubscribed(subscribed);
    setIsLoading(false);
  };

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      if (isSubscribed) {
        await notificationService.unsubscribe();
        setIsSubscribed(false);
        toast.success('Notifications disabled');
      } else {
        const subscription = await notificationService.requestPermission();
        if (subscription) {
          setIsSubscribed(true);
          toast.success('Notifications enabled!');
        } else {
          toast.error('Failed to enable notifications');
        }
      }
    } catch (error) {
      toast.error('Error updating notification settings');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      title={isSubscribed ? 'Notifications on' : 'Enable notifications'}
      className={isSubscribed ? 'text-green-600' : 'text-gray-400'}
    >
      {isSubscribed ? (
        <Bell className="w-4 h-4" />
      ) : (
        <BellOff className="w-4 h-4" />
      )}
    </Button>
  );
}
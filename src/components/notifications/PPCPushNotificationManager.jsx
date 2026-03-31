import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell, CheckCircle } from 'lucide-react';

export default function PPCPushNotificationManager() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    // Check if browser supports notifications and service workers
    const supported = 'serviceWorker' in navigator && 'Notification' in window;
    setIsSupported(supported);

    if (supported) {
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);

      // If subscribed, store it on the backend
      if (subscription) {
        const user = await base44.auth.me();
        await base44.entities.PushSubscription.create({
          user_id: user.id,
          subscription_data: JSON.stringify(subscription),
          is_active: true
        }).catch(() => {});
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const handleSubscribe = async () => {
    try {
      // Request notification permission
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      if (Notification.permission !== 'granted') {
        alert('Please enable notifications in your browser settings');
        return;
      }

      // Register service worker if not already registered
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.register('/sw.js').catch(() => {
          return navigator.serviceWorker.ready;
        });

        // Subscribe to push notifications
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY
        });

        // Save subscription to backend
        const user = await base44.auth.me();
        await base44.entities.PushSubscription.create({
          user_id: user.id,
          subscription_data: JSON.stringify(subscription),
          is_active: true
        });

        setIsSubscribed(true);
      }
    } catch (error) {
      console.error('Error subscribing to notifications:', error);
      alert('Failed to enable notifications');
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-40">
      {!isSubscribed && (
        <button
          onClick={handleSubscribe}
          className="bg-gradient-to-r from-orange-500 to-pink-500 text-white px-4 py-2 rounded-full shadow-lg hover:shadow-xl transition-shadow flex items-center gap-2 animate-bounce"
        >
          <Bell className="w-4 h-4" />
          Enable PPC Alerts
        </button>
      )}
      {isSubscribed && (
        <div className="bg-green-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          Alerts Enabled
        </div>
      )}
    </div>
  );
}
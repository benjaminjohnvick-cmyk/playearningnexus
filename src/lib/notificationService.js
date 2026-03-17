// Notification service for managing push subscriptions and permissions
import { base44 } from '@/api/base44Client';

const VAPID_PUBLIC_KEY = 'PLACEHOLDER_VAPID_KEY'; // Will be set from environment

export const notificationService = {
  // Request permission and subscribe user to push notifications
  async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('Browser does not support notifications');
      return null;
    }

    if (Notification.permission === 'granted') {
      return await this.subscribe();
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        return await this.subscribe();
      }
    }
    return null;
  },

  // Subscribe to push notifications
  async subscribe() {
    try {
      if (!('serviceWorker' in navigator)) {
        console.warn('Service workers not supported');
        return null;
      }

      const registration = await navigator.serviceWorker.ready;
      
      // Check if already subscribed
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Create new subscription
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      // Store subscription in database
      const user = await base44.auth.me();
      if (user && subscription) {
        await base44.entities.PushSubscription.bulkCreate([{
          user_id: user.id,
          endpoint: subscription.endpoint,
          auth: subscription.getKey('auth') ? btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth')))) : '',
          p256dh: subscription.getKey('p256dh') ? btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')))) : '',
          user_agent: navigator.userAgent,
          is_active: true
        }]);
      }

      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  },

  // Unsubscribe from push notifications
  async unsubscribe() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        
        // Mark as inactive in database
        const user = await base44.auth.me();
        if (user) {
          await base44.entities.PushSubscription.filter({
            user_id: user.id,
            endpoint: subscription.endpoint
          }).then(subs => {
            subs.forEach(sub => base44.entities.PushSubscription.update(sub.id, { is_active: false }));
          });
        }
      }
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
    }
  },

  // Check if user is subscribed
  async isSubscribed() {
    try {
      if (!('serviceWorker' in navigator)) return false;
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      return subscription !== null;
    } catch {
      return false;
    }
  },

  // Helper: Convert VAPID key from base64 to Uint8Array
  urlBase64ToUint8Array(base64String) {
    try {
      const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      return new Uint8Array(rawData.split('').map(char => char.charCodeAt(0)));
    } catch (error) {
      console.error('Failed to convert VAPID key:', error);
      return new Uint8Array();
    }
  }
};
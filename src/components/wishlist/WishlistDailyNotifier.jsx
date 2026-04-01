import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const STORAGE_KEY = 'gg_wishlist_notif_date';

/**
 * Fires once per day (on mount, if not already fired today):
 * - A toast nudging the user to buy an item from their wishlist
 * - A web-push notification if permission granted
 */
export default function WishlistDailyNotifier({ user }) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!user?.id || firedRef.current) return;

    const today = new Date().toISOString().split('T')[0];
    const lastFired = localStorage.getItem(STORAGE_KEY);
    if (lastFired === today) return; // already shown today

    firedRef.current = true;

    const run = async () => {
      try {
        const items = await base44.entities.ProductWishlistItem.filter(
          { user_id: user.id, status: 'active' },
          '-created_date',
          10
        );
        if (!items || items.length === 0) return;

        // Pick item with most earnings progress (or first)
        const sorted = [...items].sort((a, b) => (b.amount_earned || 0) - (a.amount_earned || 0));
        const featured = sorted[0];
        const totalValue = items.reduce((s, i) => s + (i.price_with_markup || i.best_price || 0), 0);
        const pct = featured.price_with_markup > 0
          ? Math.min(100, Math.round(((featured.amount_earned || 0) / featured.price_with_markup) * 100))
          : 0;

        const title = `🛒 Don't forget your wishlist!`;
        const body = `"${featured.product_name}" — $${(featured.price_with_markup || 0).toFixed(2)} · You're ${pct}% of the way there. Total wishlist value: $${totalValue.toFixed(2)}.`;

        // In-app toast
        toast(title, {
          description: body,
          action: { label: 'View Wishlist', onClick: () => window.location.href = '/Wishlist' },
          duration: 10000,
        });

        // Web push (if granted)
        if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(title, {
              body,
              icon: 'https://img.icons8.com/color/96/000000/shopping-cart.png',
              tag: 'wishlist-daily',
              data: { url: '/Wishlist' },
            });
          }).catch(() => {});
        }

        localStorage.setItem(STORAGE_KEY, today);
      } catch {
        // Silently fail
      }
    };

    // Short delay so app is fully loaded
    const t = setTimeout(run, 8000);
    return () => clearTimeout(t);
  }, [user?.id]);

  return null;
}
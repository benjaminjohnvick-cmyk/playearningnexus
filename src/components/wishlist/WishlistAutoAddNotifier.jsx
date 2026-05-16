/**
 * WishlistAutoAddNotifier
 * On login, checks for locally tracked product views since the last sync,
 * auto-adds them to the user's wishlist, and shows a notification banner.
 * Renders nothing visible — side-effect only.
 */
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { getNewTrackedProductsSince, clearTrackedProducts } from '@/hooks/useProductViewTracker';
import { toast } from 'sonner';

const LAST_SYNC_KEY = 'gg_wishlist_last_sync';

export default function WishlistAutoAddNotifier({ user }) {
  const [ran, setRan] = useState(false);

  useEffect(() => {
    if (!user?.id || ran) return;
    setRan(true);

    const lastSync = parseInt(localStorage.getItem(LAST_SYNC_KEY) || '0', 10);
    const newProducts = getNewTrackedProductsSince(lastSync);

    if (newProducts.length === 0) return;

    (async () => {
      try {
        // Fetch existing wishlist to avoid duplicates
        const existing = await base44.entities.ProductWishlistItem.filter({ user_id: user.id, status: 'active' });
        const existingNames = new Set(existing.map(w => w.product_name));

        const toAdd = newProducts.filter(p => !existingNames.has(p.name));
        if (toAdd.length === 0) {
          localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
          clearTrackedProducts();
          return;
        }

        // Auto-add each new product
        await Promise.all(toAdd.map(p =>
          base44.entities.ProductWishlistItem.create({
            user_id: user.id,
            product_name: p.name,
            product_description: p.description,
            product_image_url: p.imageUrl,
            price_with_markup: p.price,
            best_price: p.price,
            vendor_url: p.vendorUrl,
            vendor_name: p.vendorName,
            status: 'active',
            amount_earned: 0,
            auto_added: true,
          })
        ));

        // Update sync timestamp and clear cache
        localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
        clearTrackedProducts();

        // Show notification
        toast(
          `💖 ${toAdd.length} item${toAdd.length > 1 ? 's' : ''} you browsed ${toAdd.length > 1 ? 'were' : 'was'} auto-added to your Wishlist!`,
          {
            description: toAdd.map(p => p.name).join(', '),
            action: {
              label: 'View Wishlist',
              onClick: () => { window.location.href = '/Wishlist'; }
            },
            duration: 8000,
          }
        );
      } catch (e) {
        // Fail silently — this is a background convenience feature
      }
    })();
  }, [user?.id]);

  return null;
}
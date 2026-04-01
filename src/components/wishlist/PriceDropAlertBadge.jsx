import React, { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { TrendingDown } from 'lucide-react';

const CHECK_INTERVAL = 6 * 60 * 60 * 1000; // every 6 hours
const STORAGE_KEY = 'gg_price_check_ts';

/**
 * Silently re-checks prices for all wishlist items and fires alerts on drops.
 * Renders nothing — purely a side-effect component.
 */
export default function PriceDropAlertBadge({ user }) {
  const ranRef = useRef(false);

  useEffect(() => {
    if (!user?.id || ranRef.current) return;

    const lastCheck = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
    if (Date.now() - lastCheck < CHECK_INTERVAL) return;

    ranRef.current = true;

    const check = async () => {
      try {
        const items = await base44.entities.ProductWishlistItem.filter(
          { user_id: user.id, status: 'active' },
          '-created_date',
          20
        );
        if (!items?.length) return;

        // For each item that has a vendor URL, ask LLM for current price
        for (const item of items.slice(0, 5)) {
          if (!item.product_name || !(item.vendor_url || item.search_query)) continue;
          try {
            const result = await base44.integrations.Core.InvokeLLM({
              prompt: `Find the current lowest price for: "${item.product_name}". 
Search the web and return just the lowest numeric price you can find in USD. 
Return only a JSON object with: { "price": <number>, "vendor": "<string>" }`,
              model: 'gemini_3_flash',
              add_context_from_internet: true,
              response_json_schema: {
                type: 'object',
                properties: {
                  price: { type: 'number' },
                  vendor: { type: 'string' },
                },
              },
            });

            if (result?.price > 0) {
              const res = await base44.functions.invoke('priceDropMonitor', {
                wishlistItemId: item.id,
                currentPrice: result.price,
              });

              if (res?.data?.price_dropped) {
                const { old_price, new_price, savings, savings_pct } = res.data;
                toast(
                  <div className="flex items-start gap-2">
                    <TrendingDown className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-gray-900">Price Drop! {savings_pct}% off</p>
                      <p className="text-sm text-gray-600">"{item.product_name}" dropped from ${old_price.toFixed(2)} → <span className="text-green-600 font-bold">${new_price.toFixed(2)}</span></p>
                    </div>
                  </div>,
                  {
                    duration: 12000,
                    action: {
                      label: '🛒 Buy Now',
                      onClick: () => {
                        if (item.vendor_url) window.open(item.vendor_url, '_blank');
                        else window.location.href = '/Wishlist';
                      },
                    },
                  }
                );

                // Web push
                if ('serviceWorker' in navigator && Notification.permission === 'granted') {
                  navigator.serviceWorker.ready.then(reg => {
                    reg.showNotification(`🔥 Price Drop: ${item.product_name}`, {
                      body: `Now $${new_price.toFixed(2)} — save $${savings.toFixed(2)} (${savings_pct}% off!)`,
                      icon: item.product_image_url || 'https://img.icons8.com/color/96/000000/price-tag.png',
                      tag: `price-drop-${item.id}`,
                      data: { url: item.vendor_url || '/Wishlist' },
                    });
                  }).catch(() => {});
                }
              }
            }
          } catch {
            // Silently skip this item
          }
        }

        localStorage.setItem(STORAGE_KEY, Date.now().toString());
      } catch {
        // Silently fail
      }
    };

    const t = setTimeout(check, 15000);
    return () => clearTimeout(t);
  }, [user?.id]);

  return null;
}
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Heart, Coins, CreditCard } from 'lucide-react';

/**
 * MarketplaceProductCard — a shared, Amazon-style product card for every marketplace section: image, title,
 * star rating + review count, price (points and/or $), a "Sponsored" tag, a wishlist heart, and buy actions.
 * Uniform look across Physical / Digital / Services / App Store so every section behaves the same.
 *
 * Props: listing {id,title,image_url|images,price_points,price_usd,rating,review_count,sponsored,source_label,condition}
 *        onBuyPoints(listing), onBuyCard(listing), onWishlist(listing), formatPrice(usd), markupPct
 */
function Stars({ rating = 0, count = 0 }) {
  const r = Math.max(0, Math.min(5, Number(rating) || 0));
  return (
    <div className="flex items-center gap-1 text-amber-500">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} className={`w-3.5 h-3.5 ${i < Math.round(r) ? 'fill-amber-500' : 'fill-none text-slate-300'}`} />
      ))}
      <span className="text-xs text-slate-500 ml-1">{r ? r.toFixed(1) : 'New'}{count ? ` (${count})` : ''}</span>
    </div>
  );
}

export default function MarketplaceProductCard({ listing: l, onBuyPoints, onBuyCard, onWishlist, formatPrice, markupPct = 0, busyKey }) {
  const img = l.image_url || (Array.isArray(l.images) ? l.images[0] : null);
  const pts = l.price_points > 0 ? Math.round(l.price_points * (1 + (markupPct || 0) / 100)) : 0;
  const fmt = formatPrice || ((u) => `$${Number(u || 0).toFixed(2)}`);

  return (
    <Card className="overflow-hidden group">
      <div className="relative">
        <div className="h-40 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden">
          {img ? <img src={img} alt={l.title} className="w-full h-full object-cover group-hover:scale-105 transition" /> : <span className="text-4xl">🛍️</span>}
        </div>
        {l.sponsored && <Badge className="absolute top-2 left-2 bg-amber-500 text-white">Sponsored</Badge>}
        {onWishlist && (
          <button onClick={() => onWishlist(l)} aria-label="Add to wishlist"
            className="absolute top-2 right-2 rounded-full bg-white/90 p-1.5 text-rose-500 hover:bg-white shadow">
            <Heart className="w-4 h-4" />
          </button>
        )}
      </div>
      <CardContent className="p-3">
        <div className="font-semibold text-sm truncate">{l.title}</div>
        <div className="my-1"><Stars rating={l.rating} count={l.review_count} /></div>
        {l.source_label && <Badge variant="outline" className="text-[10px] mb-1">{l.source_label}</Badge>}
        <div className="flex gap-2 mt-2">
          {pts > 0 && onBuyPoints && (
            <Button size="sm" variant="outline" disabled={busyKey === l.id + 'points'} onClick={() => onBuyPoints(l)}>
              <Coins className="w-4 h-4 mr-1" /> {pts.toLocaleString()}
            </Button>
          )}
          {l.price_usd > 0 && onBuyCard && (
            <Button size="sm" disabled={busyKey === l.id + 'card'} onClick={() => onBuyCard(l)}>
              <CreditCard className="w-4 h-4 mr-1" /> {fmt(l.price_usd)}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

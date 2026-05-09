import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Zap, TrendingDown } from 'lucide-react';

/**
 * Best Price Badge — shows the lowest found price inline in the search bar.
 * Pulsates while loading, shows price + vendor when ready.
 */
export default function BestPriceBadge({ loading, bestPrice, bestVendor, className = '' }) {
  if (loading) {
    return (
      <div className={`flex items-center gap-1.5 bg-amber-50 border border-amber-300 rounded-full px-3 py-1 animate-pulse ${className}`}>
        <Zap className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-xs font-semibold text-amber-700">Finding best price…</span>
      </div>
    );
  }

  if (!bestPrice || !bestVendor) return null;

  return (
    <div className={`flex items-center gap-1.5 bg-green-50 border border-green-300 rounded-full px-3 py-1 ${className}`}>
      <TrendingDown className="w-3.5 h-3.5 text-green-600" />
      <span className="text-xs font-bold text-green-700">
        Best Price: ${bestPrice.toFixed(2)}
      </span>
      <span className="text-xs text-green-600">@ {bestVendor}</span>
    </div>
  );
}
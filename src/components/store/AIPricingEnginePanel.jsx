import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingDown, Zap, ShoppingBag, ExternalLink,
  CheckCircle, XCircle, Star, Award, Info
} from 'lucide-react';

const VENDOR_COLORS = {
  amazon:    'bg-orange-100 text-orange-700 border-orange-200',
  walmart:   'bg-blue-100 text-blue-700 border-blue-200',
  target:    'bg-red-100 text-red-700 border-red-200',
  'best buy':'bg-blue-100 text-blue-800 border-blue-200',
  ebay:      'bg-yellow-100 text-yellow-700 border-yellow-200',
  newegg:    'bg-orange-100 text-orange-800 border-orange-200',
  costco:    'bg-red-100 text-red-800 border-red-200',
  gamestop:  'bg-green-100 text-green-700 border-green-200',
};
function vendorColor(vendor) {
  const k = (vendor || '').toLowerCase();
  for (const [n, c] of Object.entries(VENDOR_COLORS)) {
    if (k.includes(n)) return c;
  }
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

/**
 * Full AI Pricing Engine results panel — rendered inside ProductSearchResults
 * when the AI engine toggle is on and results are ready.
 */
export default function AIPricingEnginePanel({ engineData, onOrderBestDeal, loading }) {
  if (loading) {
    return (
      <div className="mx-4 mt-3 rounded-xl border-2 border-amber-200 bg-amber-50 p-4 animate-pulse">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-5 h-5 text-amber-500 animate-bounce" />
          <span className="font-bold text-amber-800 text-sm">AI Pricing Engine scanning retailers…</span>
        </div>
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-10 bg-amber-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!engineData?.listings?.length) return null;

  const { listings, best_price_vendor, best_price_amount, best_fulfillment_vendor,
          price_range_low, price_range_high, average_price, ai_recommendation, confidence } = engineData;

  const bestIdx = listings.findIndex(l => (l.vendor || '').toLowerCase() === (best_fulfillment_vendor || best_price_vendor || '').toLowerCase());
  const recommended = bestIdx >= 0 ? listings[bestIdx] : listings[0];

  return (
    <div className="mx-4 mt-3 rounded-xl border-2 border-green-300 bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-500 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-white" />
          <span className="font-bold text-white text-sm">AI Pricing Engine</span>
          <span className="text-green-100 text-xs">· {listings.length} retailers scanned</span>
        </div>
        {confidence != null && (
          <span className="text-[11px] bg-white/20 text-white rounded-full px-2 py-0.5">
            {Math.round(confidence * 100)}% confidence
          </span>
        )}
      </div>

      {/* AI Recommendation banner */}
      {ai_recommendation && (
        <div className="bg-green-50 border-b border-green-200 px-4 py-2 flex gap-2">
          <Award className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-green-800">{ai_recommendation}</p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x border-b text-center py-2">
        <div>
          <p className="text-[11px] text-gray-500">Lowest</p>
          <p className="text-sm font-black text-green-600">${(price_range_low || best_price_amount || 0).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[11px] text-gray-500">Average</p>
          <p className="text-sm font-black text-gray-700">${(average_price || 0).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[11px] text-gray-500">Highest</p>
          <p className="text-sm font-black text-red-500">${(price_range_high || 0).toFixed(2)}</p>
        </div>
      </div>

      {/* Recommended vendor CTA */}
      <div className="bg-green-50 border-b border-green-200 px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
            <span className="text-xs font-bold text-gray-900">AI Recommended: {recommended.vendor}</span>
            <Badge className="text-[10px] bg-green-600 text-white border-0 px-1.5">Best Deal</Badge>
          </div>
          <p className="text-xs text-gray-600 mt-0.5">
            ${(recommended.total_landed_cost || recommended.price || 0).toFixed(2)} total
            {recommended.shipping_cost === 0 ? ' · Free shipping' : ` · +$${recommended.shipping_cost} shipping`}
            {recommended.shipping_days ? ` · ~${recommended.shipping_days}d` : ''}
          </p>
        </div>
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white text-xs h-8 flex-shrink-0"
          onClick={() => onOrderBestDeal(recommended)}
        >
          <ShoppingBag className="w-3.5 h-3.5 mr-1" /> Order Best Deal
        </Button>
      </div>

      {/* Retailer list */}
      <div className="divide-y max-h-72 overflow-y-auto">
        {listings.map((l, i) => {
          const isRec = l.vendor === recommended.vendor;
          const savings = (price_range_high || 0) - (l.total_landed_cost || l.price || 0);
          return (
            <div key={i} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${isRec ? 'bg-green-50/60' : ''}`}>
              <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${isRec ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {isRec ? '★' : i + 1}
              </span>
              <Badge className={`text-[10px] border font-semibold flex-shrink-0 ${vendorColor(l.vendor)}`}>{l.vendor}</Badge>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  {l.in_stock === false
                    ? <span className="flex items-center gap-0.5 text-[10px] text-red-500"><XCircle className="w-3 h-3" />Out of stock</span>
                    : <span className="flex items-center gap-0.5 text-[10px] text-green-600"><CheckCircle className="w-3 h-3" />In stock</span>
                  }
                  {l.discount_percentage > 0 && (
                    <span className="text-[10px] bg-red-100 text-red-700 rounded px-1 font-bold">-{l.discount_percentage}%</span>
                  )}
                  {l.notes && <span className="text-[10px] text-gray-400 truncate">{l.notes}</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`font-black text-sm ${isRec ? 'text-green-700' : 'text-gray-800'}`}>
                  ${(l.total_landed_cost || l.price || 0).toFixed(2)}
                </p>
                {l.shipping_cost === 0
                  ? <p className="text-[10px] text-green-600">Free ship</p>
                  : <p className="text-[10px] text-gray-400">+${l.shipping_cost} ship</p>
                }
              </div>
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-blue-500 hover:text-blue-700">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 border-t bg-gray-50 flex items-center gap-1.5">
        <Info className="w-3 h-3 text-gray-400" />
        <p className="text-[10px] text-gray-400">Prices are AI-estimated from live web data. "Order Best Deal" uses GamerGain automated fulfillment.</p>
      </div>
    </div>
  );
}
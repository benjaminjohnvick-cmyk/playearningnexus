import React from 'react';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, Clock } from 'lucide-react';

const URGENCY_STYLES = {
  high: 'bg-red-500/20 text-red-300 border-red-500/30',
  medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  low: 'bg-slate-500/20 text-slate-300 border-slate-500/30'
};

export default function PriceAlertCards({ alerts }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
      <h2 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
        <TrendingDown className="w-5 h-5 text-red-400" /> Price Drop Alerts
      </h2>
      {!alerts.length ? (
        <div className="text-slate-500 text-sm text-center py-8">No price drops detected right now.<br />Add items to your wishlist to track them.</div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert, i) => (
            <div key={i} className="bg-slate-900 border border-slate-700 rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-white font-medium text-sm">{alert.product_name}</h3>
                <Badge className={`text-xs border ${URGENCY_STYLES[alert.urgency] || URGENCY_STYLES.low}`}>
                  {alert.urgency?.toUpperCase()} urgency
                </Badge>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-slate-500 line-through text-sm">${alert.original_price}</span>
                <span className="text-emerald-400 font-bold text-lg">${alert.current_price}</span>
                <span className="text-red-400 text-sm font-medium">Save ${alert.savings}!</span>
              </div>
              {alert.expires_in && (
                <div className="flex items-center gap-1 text-slate-500 text-xs">
                  <Clock className="w-3 h-3" /> Expires: {alert.expires_in}
                </div>
              )}
              {/* Savings bar */}
              <div className="mt-2 h-1.5 bg-slate-700 rounded-full">
                <div className="h-full bg-gradient-to-r from-red-500 to-emerald-500 rounded-full"
                  style={{ width: `${Math.min((alert.savings / (alert.original_price || 1)) * 100, 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
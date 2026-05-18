import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';

export default function MarketRecommendations({ recommendations }) {
  if (!recommendations.length) return null;

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
      <h2 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
        <Star className="w-5 h-5 text-yellow-400" /> Personalized Picks For You
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {recommendations.map((rec, i) => (
          <div key={i} className="bg-slate-900 border border-slate-700 rounded-xl p-4 hover:border-indigo-500/50 transition-all">
            <div className="flex items-start justify-between mb-2">
              <span className="text-3xl">{rec.image_emoji || '🛍️'}</span>
              <div className="flex items-center gap-1 bg-indigo-500/20 rounded-full px-2 py-0.5">
                <Star className="w-3 h-3 text-indigo-400" />
                <span className="text-indigo-300 text-xs font-bold">{rec.match_score}%</span>
              </div>
            </div>
            <h3 className="text-white font-medium text-sm leading-tight mb-1">{rec.product_name}</h3>
            <div className="text-emerald-400 font-bold text-sm mb-2">~${rec.estimated_price}</div>
            <Badge className="text-xs bg-slate-700 text-slate-300 border-0 mb-2">{rec.category}</Badge>
            <p className="text-slate-400 text-xs leading-relaxed">{rec.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
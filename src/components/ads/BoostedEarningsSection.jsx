import { Card } from "@/components/ui/card";
import { Zap, TrendingUp, Info } from "lucide-react";
import AdDiscoveryCard from "./AdDiscoveryCard";

export default function BoostedEarningsSection({ boosted, topCategories, insight, onEngage }) {
  if (!boosted?.length) return null;

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-lg">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
            Boosted Earnings
            <span className="text-xs font-normal bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Your Top Topics</span>
          </h2>
          <p className="text-xs text-gray-500">Matched to your highest-earning survey categories</p>
        </div>
      </div>

      {/* Top categories chips */}
      {topCategories?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {topCategories.map((cat, i) => (
            <div key={i} className="flex items-center gap-1 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-full px-3 py-1">
              <TrendingUp className="w-3 h-3 text-orange-500" />
              <span className="text-xs font-semibold text-orange-700">{cat.category}</span>
              <span className="text-xs text-orange-500">+${cat.total_earned?.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {/* AI insight */}
      {insight && (
        <Card className="flex items-start gap-2 p-3 mb-4 bg-amber-50 border-amber-200">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">{insight}</p>
        </Card>
      )}

      {/* Boosted ads grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-3">
        {boosted.map((ad, i) => (
          <AdDiscoveryCard key={ad.ad_id || i} ad={ad} boosted onEngage={onEngage} />
        ))}
      </div>
    </div>
  );
}
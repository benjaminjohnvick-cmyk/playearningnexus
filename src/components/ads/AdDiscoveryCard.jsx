import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Zap, Clock, TrendingUp, Star } from "lucide-react";

const difficultyColor = {
  Easy: "bg-green-100 text-green-700",
  Medium: "bg-yellow-100 text-yellow-700",
  Long: "bg-orange-100 text-orange-700",
};

const typeIcon = {
  survey: "📋",
  marketplace: "🛒",
  ad: "📣",
};

export default function AdDiscoveryCard({ ad, boosted = false, onEngage }) {
  const reward = ad.actual_reward || ad.estimated_reward || 0;
  const boostedReward = boosted && ad.boost_multiplier
    ? (reward * ad.boost_multiplier).toFixed(2)
    : null;

  return (
    <Card className={`p-4 relative overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer
      ${boosted ? "border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-white" : "border border-gray-100"}`}
      onClick={() => onEngage?.(ad)}
    >
      {boosted && (
        <div className="absolute top-0 right-0 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-bl-xl flex items-center gap-1">
          <Zap className="w-3 h-3" /> BOOSTED
        </div>
      )}

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2 min-w-0">
          <span className="text-xl flex-shrink-0">{typeIcon[ad.type] || "📋"}</span>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">{ad.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{ad.category}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {boostedReward ? (
            <>
              <p className="text-xs text-gray-400 line-through">${reward.toFixed(2)}</p>
              <p className="text-lg font-black text-yellow-600">${boostedReward}</p>
            </>
          ) : (
            <p className="text-lg font-black text-green-600">${reward.toFixed(2)}</p>
          )}
        </div>
      </div>

      {ad.reasoning && (
        <p className="text-xs text-gray-500 mb-3 italic line-clamp-2">"{ad.reasoning}"</p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {ad.difficulty && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${difficultyColor[ad.difficulty] || "bg-gray-100 text-gray-600"}`}>
              {ad.difficulty}
            </span>
          )}
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-blue-500" />
            <span className="text-xs text-blue-600 font-medium">{ad.match_score || 0}% match</span>
          </div>
        </div>
        <Button
          size="sm"
          className={boosted
            ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold text-xs h-7 px-3"
            : "bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-xs h-7 px-3"
          }
          onClick={(e) => { e.stopPropagation(); onEngage?.(ad); }}
        >
          Start
        </Button>
      </div>
    </Card>
  );
}
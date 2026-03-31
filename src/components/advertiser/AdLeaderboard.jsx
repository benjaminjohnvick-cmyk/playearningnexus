import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, Grid2x2, MousePointerClick, Medal, Crown, Star } from 'lucide-react';

const SORT_MODES = [
  { key: 'roi', label: 'ROI', icon: TrendingUp },
  { key: 'engagement', label: 'Engagement', icon: MousePointerClick },
  { key: 'dominance', label: 'Grid Dominance', icon: Grid2x2 },
];

function computeScore(ad, mode) {
  const spent = ad.total_spent || 0;
  const completed = ad.surveys_completed || 0;
  const clicks = ad.total_clicks || 0;
  const bid = ad.bid_amount || 0.4;

  if (mode === 'roi') {
    // ROI: surveys completed per dollar spent
    return spent > 0 ? (completed / spent) * 100 : completed * 10;
  }
  if (mode === 'engagement') {
    // Engagement: clicks + (completions * 3)
    return clicks + completed * 3;
  }
  if (mode === 'dominance') {
    // Grid dominance: bid tier × completions
    return bid * completed * 10;
  }
  return 0;
}

function rankLabel(rank) {
  if (rank === 1) return { icon: <Crown className="w-4 h-4 text-yellow-400" />, color: 'text-yellow-400' };
  if (rank === 2) return { icon: <Medal className="w-4 h-4 text-gray-300" />, color: 'text-gray-300' };
  if (rank === 3) return { icon: <Medal className="w-4 h-4 text-orange-400" />, color: 'text-orange-400' };
  return { icon: <span className="text-gray-500 font-bold text-sm w-4 text-center">#{rank}</span>, color: 'text-gray-500' };
}

export default function AdLeaderboard({ myUserId }) {
  const [sortMode, setSortMode] = useState('roi');

  const { data: allAds = [], isLoading } = useQuery({
    queryKey: ['leaderboard-ads'],
    queryFn: () => base44.entities.AdListing.filter({ status: 'active' }, '-surveys_completed', 50),
    staleTime: 60000,
  });

  // Group by owner, aggregate
  const advertiserMap = {};
  allAds.forEach(ad => {
    const uid = ad.owner_user_id;
    if (!advertiserMap[uid]) {
      advertiserMap[uid] = {
        user_id: uid,
        brand_name: ad.brand_name,
        ads: [],
        total_clicks: 0,
        surveys_completed: 0,
        total_spent: 0,
        bid_amount: ad.bid_amount || 0.4,
      };
    }
    advertiserMap[uid].ads.push(ad);
    advertiserMap[uid].total_clicks += ad.total_clicks || 0;
    advertiserMap[uid].surveys_completed += ad.surveys_completed || 0;
    advertiserMap[uid].total_spent += ad.total_spent || 0;
    advertiserMap[uid].bid_amount = Math.max(advertiserMap[uid].bid_amount, ad.bid_amount || 0.4);
  });

  const ranked = Object.values(advertiserMap)
    .map(a => ({ ...a, score: computeScore(a, sortMode) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  const tierColors = {
    Premium: 'text-yellow-400',
    High: 'text-orange-400',
    Standard: 'text-blue-400',
    Economy: 'text-gray-400',
  };

  function getTier(bid) {
    if (bid >= 0.60) return 'Premium';
    if (bid >= 0.50) return 'High';
    if (bid >= 0.40) return 'Standard';
    return 'Economy';
  }

  return (
    <div className="space-y-4">
      {/* Sort tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-xl p-1 w-fit">
        {SORT_MODES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSortMode(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              sortMode === key ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Icon className="w-3 h-3" /> {label}
          </button>
        ))}
      </div>

      {/* Leaderboard list */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-bold text-white">Top Advertisers</span>
          <Badge className="bg-gray-800 text-gray-400 text-xs ml-auto">{ranked.length} active</Badge>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading leaderboard...</div>
        ) : ranked.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No active advertisers yet.</div>
        ) : (
          <div className="divide-y divide-gray-800/60">
            {ranked.map((advertiser, i) => {
              const rank = i + 1;
              const { icon, color } = rankLabel(rank);
              const isMe = advertiser.user_id === myUserId;
              const tier = getTier(advertiser.bid_amount);

              return (
                <div
                  key={advertiser.user_id}
                  className={`flex items-center gap-3 px-4 py-3 ${isMe ? 'bg-yellow-500/5 border-l-2 border-yellow-500' : ''}`}
                >
                  <div className="w-6 flex items-center justify-center flex-shrink-0">{icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${isMe ? 'text-yellow-400' : 'text-white'}`}>
                        {advertiser.brand_name}
                        {isMe && <span className="ml-1 text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">You</span>}
                      </span>
                      <span className={`text-[10px] font-bold ${tierColors[tier]}`}>{tier}</span>
                    </div>
                    <div className="flex gap-3 mt-0.5 text-[10px] text-gray-500">
                      <span>{advertiser.total_clicks} clicks</span>
                      <span>{advertiser.surveys_completed} surveys</span>
                      <span>${advertiser.total_spent.toFixed(2)} spent</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-black text-sm ${color}`}>{advertiser.score.toFixed(1)}</p>
                    <p className="text-[10px] text-gray-600">score</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
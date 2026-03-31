import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Gavel, Zap, TrendingUp, MapPin, Brain, ToggleLeft, ToggleRight, Info, ChevronUp, ChevronDown, Target, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const GRID_TIERS = [
  { tier: 'Premium', rows: '1-3', cols: '1-3', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', avgTraffic: '3.2x', minBid: 0.60, description: 'Top-left prime real estate — highest user attention' },
  { tier: 'High', rows: '1-5', cols: '4-7', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', avgTraffic: '2.1x', minBid: 0.50, description: 'Top-center zone — strong first-fold visibility' },
  { tier: 'Standard', rows: '4-7', cols: '1-5', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30', avgTraffic: '1.4x', minBid: 0.40, description: 'Mid-grid — solid engagement at base price' },
  { tier: 'Economy', rows: '7-10', cols: '6-10', color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/30', avgTraffic: '0.8x', minBid: 0.30, description: 'Lower-grid — budget-friendly with lower competition' },
];

// Auto-bidding: given a target tier, return the minimum competitive bid
function calcAutoBid(targetTier, competitorBids) {
  const tier = GRID_TIERS.find(t => t.tier === targetTier) || GRID_TIERS[2];
  const competitorsInTier = competitorBids.filter(b => b >= tier.minBid);
  if (competitorsInTier.length === 0) return tier.minBid;
  const highestComp = Math.max(...competitorsInTier);
  // Outbid by $0.03 but don't exceed max sensible amount
  return Math.min(+(highestComp + 0.03).toFixed(2), 1.50);
}

export default function AdBidAuction({ ads, adBalance, onRefresh }) {
  const [bids, setBids] = useState({});
  const [smartBidding, setSmartBidding] = useState({});
  const [autoBidding, setAutoBidding] = useState({}); // target-position auto-bidding
  const [targetTiers, setTargetTiers] = useState({}); // desired grid tier per ad
  const [loading, setLoading] = useState({});
  const [liveAuction, setLiveAuction] = useState(null);

  // Initialize bid state from ad data
  useEffect(() => {
    const initial = {};
    const smart = {};
    const auto = {};
    const targets = {};
    ads.forEach(ad => {
      initial[ad.id] = ad.bid_amount || 0.40;
      smart[ad.id] = ad.smart_bidding || false;
      auto[ad.id] = false;
      targets[ad.id] = ad.grid_tier || 'Standard';
    });
    setBids(initial);
    setSmartBidding(smart);
    setAutoBidding(auto);
    setTargetTiers(targets);
  }, [ads]);

  // Simulate live auction activity + auto-bid adjustment
  useEffect(() => {
    const competitors = ['Apex Gaming', 'TechGear Pro', 'NovaSkins', 'EpicLoot', 'StreamKit'];
    const interval = setInterval(() => {
      const comp = competitors[Math.floor(Math.random() * competitors.length)];
      const tier = GRID_TIERS[Math.floor(Math.random() * 3)];
      const bid = parseFloat((Math.random() * 0.4 + 0.35).toFixed(2));
      setLiveAuction({ comp, tier: tier.tier, bid: bid.toFixed(2), time: new Date().toLocaleTimeString() });

      // Auto-bidding: re-compute bids for ads that have it enabled
      setBids(prev => {
        const updated = { ...prev };
        Object.entries(autoBidding).forEach(([adId, isAuto]) => {
          if (!isAuto) return;
          const target = targetTiers[adId] || 'Standard';
          // Simulate a pool of competitor bids around the new bid
          const pool = [bid, bid - 0.05, bid + 0.02, bid - 0.10].filter(b => b > 0);
          const newBid = calcAutoBid(target, pool);
          updated[adId] = newBid;
        });
        return updated;
      });
    }, 8000);
    return () => clearInterval(interval);
  }, [autoBidding, targetTiers]);

  const adjustBid = (adId, delta) => {
    setBids(prev => ({
      ...prev,
      [adId]: Math.max(0.20, Math.min(2.00, +(prev[adId] + delta).toFixed(2))),
    }));
  };

  const placeBid = async (ad) => {
    const bidAmt = bids[ad.id];
    if (adBalance <= 0) {
      toast.error('Top up your balance before bidding');
      return;
    }
    setLoading(l => ({ ...l, [ad.id]: true }));
    await base44.entities.AdListing.update(ad.id, {
      bid_amount: bidAmt,
      smart_bidding: smartBidding[ad.id],
    });
    const tier = GRID_TIERS.find(t => bidAmt >= t.minBid) || GRID_TIERS[3];
    toast.success(`Bid set to $${bidAmt}/survey — placed in ${tier.tier} zone`);
    setLoading(l => ({ ...l, [ad.id]: false }));
    onRefresh();
  };

  const toggleAutoBid = async (adId) => {
    const next = !autoBidding[adId];
    setAutoBidding(a => ({ ...a, [adId]: next }));
    if (next) {
      // Disable smart bidding when auto-bidding is on
      setSmartBidding(s => ({ ...s, [adId]: false }));
      const target = targetTiers[adId] || 'Standard';
      const tier = GRID_TIERS.find(t => t.tier === target) || GRID_TIERS[2];
      setBids(b => ({ ...b, [adId]: tier.minBid }));
      toast.success(`Auto-Bidding ON — targeting ${target} zone, adjusts in real-time`);
    } else {
      toast.info('Auto-Bidding disabled');
    }
  };

  const toggleSmartBid = async (adId) => {
    const next = !smartBidding[adId];
    setSmartBidding(s => ({ ...s, [adId]: next }));
    if (next) {
      // Auto-calculate optimal bid based on budget
      const ad = ads.find(a => a.id === adId);
      if (ad) {
        const remaining = adBalance;
        const optimalBid = remaining > 50 ? 0.55 : remaining > 20 ? 0.45 : 0.35;
        setBids(b => ({ ...b, [adId]: optimalBid }));
        toast.success(`Smart Bidding ON — auto-set bid to $${optimalBid} based on your budget`);
      }
    } else {
      toast.info('Smart Bidding disabled — bids will stay at your manual setting');
    }
  };

  if (ads.length === 0) return null;

  const activeBid = (ad) => {
    const amt = bids[ad.id] || ad.bid_amount || 0.40;
    return GRID_TIERS.slice().reverse().find(t => amt >= t.minBid) || GRID_TIERS[3];
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold flex items-center gap-2">
          <Gavel className="w-4 h-4 text-yellow-400" /> Grid Bid Auction
        </h3>
        {liveAuction && (
          <div className="flex items-center gap-1.5 text-[10px] text-green-400 animate-pulse">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
            {liveAuction.comp} bid ${liveAuction.bid} on {liveAuction.tier}
          </div>
        )}
      </div>

      {/* Tier legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        {GRID_TIERS.map(tier => (
          <div key={tier.tier} className={`border rounded-xl p-2.5 ${tier.bg}`}>
            <div className="flex items-center justify-between mb-0.5">
              <span className={`text-xs font-black ${tier.color}`}>{tier.tier}</span>
              <span className="text-[10px] text-gray-400">min ${tier.minBid}</span>
            </div>
            <p className="text-[10px] text-gray-500 leading-tight">{tier.description}</p>
            <div className="mt-1.5 flex items-center gap-1">
              <TrendingUp className={`w-2.5 h-2.5 ${tier.color}`} />
              <span className={`text-[10px] font-bold ${tier.color}`}>{tier.avgTraffic} avg traffic</span>
            </div>
          </div>
        ))}
      </div>

      {/* Per-ad bidding */}
      <div className="space-y-3">
        {ads.filter(a => a.status !== 'rejected').map(ad => {
          const currentTier = activeBid(ad);
          const bidAmt = bids[ad.id] || 0.40;
          const isSmart = smartBidding[ad.id];
          const isAuto = autoBidding[ad.id];

          return (
            <div key={ad.id} className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <span className="text-white font-bold text-sm">{ad.brand_name}</span>
                  <Badge className={`ml-2 text-[10px] ${currentTier.bg} ${currentTier.color} border`}>
                    <MapPin className="w-2.5 h-2.5 mr-1" />{currentTier.tier} Zone
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Auto-Bidding toggle */}
                  <button
                    onClick={() => toggleAutoBid(ad.id)}
                    className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                      isAuto
                        ? 'bg-green-500/20 border-green-500/50 text-green-300'
                        : 'bg-gray-700 border-gray-600 text-gray-400 hover:text-white'
                    }`}
                  >
                    <Target className={`w-3 h-3 ${isAuto ? 'text-green-400' : 'text-gray-500'}`} />
                    Auto-Bid {isAuto ? 'ON' : 'OFF'}
                  </button>
                  {/* Smart Bidding toggle */}
                  <button
                    onClick={() => toggleSmartBid(ad.id)}
                    className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                      isSmart
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                        : 'bg-gray-700 border-gray-600 text-gray-400 hover:text-white'
                    }`}
                  >
                    <Brain className={`w-3 h-3 ${isSmart ? 'text-purple-400' : 'text-gray-500'}`} />
                    Smart {isSmart ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              {/* Target tier selector for auto-bidding */}
              {isAuto && (
                <div className="mb-3 flex items-center gap-2 flex-wrap">
                  <span className="text-gray-400 text-xs flex items-center gap-1"><Target className="w-3 h-3 text-green-400" /> Target Zone:</span>
                  {GRID_TIERS.map(t => (
                    <button
                      key={t.tier}
                      onClick={() => setTargetTiers(prev => ({ ...prev, [ad.id]: t.tier }))}
                      className={`text-[10px] px-2 py-1 rounded-lg border transition-all ${
                        targetTiers[ad.id] === t.tier
                          ? `${t.bg} ${t.color} border-current`
                          : 'bg-gray-700 border-gray-600 text-gray-500'
                      }`}
                    >
                      {t.tier}
                    </button>
                  ))}
                  <span className="text-[10px] text-green-400 flex items-center gap-1 ml-1">
                    <RefreshCw className="w-3 h-3" /> Adjusting live
                  </span>
                </div>
              )}

              <div className="flex items-center gap-4 flex-wrap">
                {/* Bid controls */}
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-xs">Bid/survey:</span>
                  <div className="flex items-center gap-1 bg-gray-700 rounded-lg overflow-hidden">
                    <button
                      onClick={() => adjustBid(ad.id, -0.05)}
                      disabled={isSmart}
                      className="px-2 py-1.5 hover:bg-gray-600 disabled:opacity-30 transition-colors"
                    >
                      <ChevronDown className="w-3.5 h-3.5 text-gray-300" />
                    </button>
                    <span className="text-white font-black text-sm w-12 text-center">${bidAmt.toFixed(2)}</span>
                    <button
                      onClick={() => adjustBid(ad.id, 0.05)}
                      disabled={isSmart}
                      className="px-2 py-1.5 hover:bg-gray-600 disabled:opacity-30 transition-colors"
                    >
                      <ChevronUp className="w-3.5 h-3.5 text-gray-300" />
                    </button>
                  </div>
                </div>

                {isSmart && (
                  <span className="text-purple-400 text-xs flex items-center gap-1">
                    <Brain className="w-3 h-3" /> Auto-optimizing bid
                  </span>
                )}

                <Button
                  size="sm"
                  disabled={loading[ad.id]}
                  onClick={() => placeBid(ad)}
                  className="bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xs h-8 gap-1 ml-auto"
                >
                  <Zap className="w-3 h-3" />
                  {loading[ad.id] ? 'Updating...' : 'Place Bid'}
                </Button>
              </div>

              {/* Tier threshold hints */}
              <div className="mt-2 flex gap-2 flex-wrap">
                {GRID_TIERS.map(t => (
                  <span
                    key={t.tier}
                    className={`text-[9px] px-1.5 py-0.5 rounded border ${
                      bidAmt >= t.minBid ? `${t.bg} ${t.color}` : 'border-gray-700 text-gray-600'
                    }`}
                  >
                    {t.tier} ≥${t.minBid}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
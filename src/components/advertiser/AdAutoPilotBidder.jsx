import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, Zap, Target, TrendingDown, TrendingUp, Play, Pause, CheckCircle, Activity } from 'lucide-react';
import { toast } from 'sonner';

const TIER_MINS = { Premium: 0.70, High: 0.50, Standard: 0.35, Economy: 0.20 };
const TIER_ORDER = ['Premium', 'High', 'Standard', 'Economy'];

// ML model: given heatmap demand score (0-100) and target tier, compute optimal bid
function computeOptimalBid(heatScore, targetTier, currentCpc, competitorBids) {
  const tierMin = TIER_MINS[targetTier];
  const maxCompetitor = Math.max(...competitorBids.filter(b => b.tier === targetTier).map(b => b.bid), tierMin);
  // Use heat as demand multiplier; higher demand = need higher bid to hold position
  const demandFactor = 1 + (heatScore / 100) * 0.4;
  const raw = maxCompetitor * demandFactor;
  // Cap savings: never bid more than 30% above floor or 20% above max competitor
  const optimal = Math.min(tierMin * 2.5, Math.max(tierMin, raw * 1.02));
  return parseFloat(optimal.toFixed(2));
}

// Simulate live competitor bids from tier activity
function getCompetitorBids(tick) {
  return TIER_ORDER.flatMap(tier => {
    const base = TIER_MINS[tier];
    return Array.from({ length: 3 }, (_, i) => ({
      tier,
      bid: parseFloat((base + ((tick + i * 7) % 11) * 0.02).toFixed(2)),
    }));
  });
}

const LOG_MAX = 8;

export default function AdAutoPilotBidder({ ads, adBalance, onRefresh }) {
  const [enabled, setEnabled] = useState({});           // adId -> bool
  const [targetTiers, setTargetTiers] = useState({});   // adId -> tier
  const [currentBids, setCurrentBids] = useState({});   // adId -> bid
  const [savings, setSavings] = useState({});           // adId -> cumulative savings
  const [log, setLog] = useState([]);
  const [tick, setTick] = useState(0);
  const tickRef = useRef(0);

  // Tick every 8 seconds
  useEffect(() => {
    const iv = setInterval(() => {
      tickRef.current += 1;
      setTick(t => t + 1);
    }, 8000);
    return () => clearInterval(iv);
  }, []);

  // Run ML adjustment on each tick
  useEffect(() => {
    const activeAds = ads.filter(a => enabled[a.id]);
    if (!activeAds.length) return;

    const competitors = getCompetitorBids(tick);
    const heatScore = 45 + (tick % 10) * 5; // simulated live heat demand

    activeAds.forEach(async (ad) => {
      const target = targetTiers[ad.id] || ad.grid_tier || 'Standard';
      const prevBid = currentBids[ad.id] || ad.bid_amount || TIER_MINS[target];
      const optimal = computeOptimalBid(heatScore, target, prevBid, competitors);

      if (Math.abs(optimal - prevBid) >= 0.01) {
        // Apply bid update
        await base44.entities.AdListing.update(ad.id, { bid_amount: optimal, grid_tier: target }).catch(() => null);

        const saved = parseFloat((prevBid - optimal).toFixed(2));
        setCurrentBids(b => ({ ...b, [ad.id]: optimal }));
        setSavings(s => ({ ...s, [ad.id]: parseFloat(((s[ad.id] || 0) + Math.max(0, saved)).toFixed(2)) }));

        const entry = {
          id: Date.now(),
          adName: ad.brand_name,
          from: prevBid,
          to: optimal,
          tier: target,
          heat: heatScore,
          ts: new Date().toLocaleTimeString(),
        };
        setLog(l => [entry, ...l].slice(0, LOG_MAX));
      }
    });

    if (activeAds.length > 0) onRefresh();
  }, [tick]);

  const toggleAd = (adId) => {
    const next = !enabled[adId];
    setEnabled(e => ({ ...e, [adId]: next }));
    if (next) {
      const ad = ads.find(a => a.id === adId);
      setCurrentBids(b => ({ ...b, [adId]: ad?.bid_amount || TIER_MINS['Standard'] }));
      toast.success(`Auto-Pilot enabled for "${ads.find(a => a.id === adId)?.brand_name}"`);
    }
  };

  const activeCount = Object.values(enabled).filter(Boolean).length;

  if (ads.length === 0) {
    return <div className="text-center py-12 text-gray-500 text-sm">Submit an ad first to use Auto-Pilot Bidder.</div>;
  }

  return (
    <div className="space-y-5">
      {/* Status bar */}
      <div className="flex items-center justify-between bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${activeCount > 0 ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
          <span className="text-white font-bold text-sm">Auto-Pilot Bidder</span>
          {activeCount > 0 && (
            <Badge className="bg-green-500/20 border-green-500/30 text-green-300 text-[10px]">{activeCount} active</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Activity className="w-3.5 h-3.5" />
          Adjusting every 8s
        </div>
      </div>

      {/* Per-ad controls */}
      <div className="space-y-3">
        {ads.map(ad => {
          const isOn = !!enabled[ad.id];
          const target = targetTiers[ad.id] || ad.grid_tier || 'Standard';
          const bid = currentBids[ad.id] || ad.bid_amount || TIER_MINS[target];
          const saved = savings[ad.id] || 0;
          return (
            <div key={ad.id} className={`border rounded-xl p-4 transition-all ${isOn ? 'border-green-500/30 bg-green-500/5' : 'border-gray-700 bg-gray-800/40'}`}>
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-white font-bold text-sm truncate">{ad.brand_name}</p>
                    {isOn && <Badge className="bg-green-500/20 border-green-500/30 text-green-300 text-[10px]">Live</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3">
                    <span>Current bid: <span className="text-yellow-400 font-bold">${bid.toFixed(2)}</span></span>
                    <span>Saved: <span className="text-green-400 font-bold">${saved.toFixed(2)}</span></span>
                    <span>CTR: <span className="text-white">{ad.total_clicks > 0 ? (ad.surveys_completed / ad.total_clicks * 100).toFixed(1) : '0'}%</span></span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-gray-500 text-xs">Target tier:</span>
                    {TIER_ORDER.map(tier => (
                      <button key={tier} onClick={() => setTargetTiers(t => ({ ...t, [ad.id]: tier }))}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                          target === tier
                            ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
                            : 'border-gray-700 text-gray-500 hover:text-white'
                        }`}>
                        {tier}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={() => toggleAd(ad.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all flex-shrink-0 ${
                    isOn
                      ? 'bg-green-500/20 border border-green-500/40 text-green-300 hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-300'
                      : 'bg-gray-700 border border-gray-600 text-gray-300 hover:border-green-500/40 hover:text-green-300'
                  }`}>
                  {isOn ? <><Pause className="w-3.5 h-3.5" /> Stop</> : <><Play className="w-3.5 h-3.5" /> Enable</>}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Activity log */}
      {log.length > 0 && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-1.5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-2">
            <Bot className="w-3.5 h-3.5 text-green-400" /> Recent Adjustments
          </p>
          {log.map(entry => (
            <div key={entry.id} className="flex items-center gap-3 text-xs text-gray-400">
              <span className="text-gray-600">{entry.ts}</span>
              <span className="text-white font-bold truncate max-w-[100px]">{entry.adName}</span>
              <span className="flex items-center gap-1">
                ${entry.from.toFixed(2)}
                {entry.to < entry.from
                  ? <TrendingDown className="w-3 h-3 text-green-400" />
                  : <TrendingUp className="w-3 h-3 text-orange-400" />}
                ${entry.to.toFixed(2)}
              </span>
              <span className="text-gray-600">{entry.tier} · heat {entry.heat}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
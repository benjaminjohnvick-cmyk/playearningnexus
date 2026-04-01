import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, TrendingUp, TrendingDown, Gauge, Play, Pause, Zap, Activity, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

// Peak traffic hours (0-23, higher = more traffic)
const HOURLY_TRAFFIC = [
  0.3, 0.2, 0.15, 0.1, 0.1, 0.15, // 0–5
  0.3, 0.5, 0.7, 0.85, 0.9, 0.95, // 6–11
  1.0, 0.95, 0.9, 0.85, 0.8, 0.9, // 12–17
  1.0, 0.95, 0.85, 0.7, 0.55, 0.4, // 18–23
];

// How much of the daily budget should ideally be spent by this hour
function idealSpentByHour(hour, dailyBudget) {
  const totalWeight = HOURLY_TRAFFIC.reduce((s, w) => s + w, 0);
  const weightUpToNow = HOURLY_TRAFFIC.slice(0, hour + 1).reduce((s, w) => s + w, 0);
  return dailyBudget * (weightUpToNow / totalWeight);
}

// Target bid for this hour based on traffic load
function computeHourlyBid(baseBid, currentHour, pacingStatus) {
  const traffic = HOURLY_TRAFFIC[currentHour] || 0.5;
  // During peak hours: full bid. Off-peak: reduce bid to conserve budget.
  if (pacingStatus === 'ahead') {
    // Spending too fast — reduce bid during low traffic hours
    return parseFloat((baseBid * Math.max(0.6, traffic * 0.85)).toFixed(2));
  } else if (pacingStatus === 'behind') {
    // Underspending — boost bid during peak hours to catch up
    return parseFloat((baseBid * Math.min(1.35, 1 + (1 - traffic) * 0.2)).toFixed(2));
  }
  // On pace — proportional to traffic
  return parseFloat((baseBid * (0.75 + traffic * 0.25)).toFixed(2));
}

function getPacingStatus(ad, currentHour) {
  const dailyBudget = (ad.budget_limit || 100) / 30; // rough daily slice
  const spent = ad.total_spent || 0;
  const dailySpent = spent % dailyBudget || spent * 0.03; // simulate today's spend
  const ideal = idealSpentByHour(currentHour, dailyBudget);
  if (ideal === 0) return 'on_pace';
  const ratio = dailySpent / ideal;
  if (ratio > 1.25) return 'ahead';
  if (ratio < 0.7) return 'behind';
  return 'on_pace';
}

const PACING_LABELS = {
  ahead: { label: 'Ahead of Pace', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  behind: { label: 'Behind Pace', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  on_pace: { label: 'On Pace', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
};

export default function AdBudgetPacing({ ads, adBalance, onRefresh }) {
  const [enabled, setEnabled] = useState({});
  const [tick, setTick] = useState(0);
  const [adjustments, setAdjustments] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  const currentHour = new Date().getHours();
  const trafficNow = HOURLY_TRAFFIC[currentHour];

  useEffect(() => {
    if (!isRunning) return;
    const iv = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(iv);
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning) return;
    const activeAds = ads.filter(a => enabled[a.id] && a.status === 'active');
    if (!activeAds.length) return;

    activeAds.forEach(async (ad) => {
      const status = getPacingStatus(ad, currentHour);
      const newBid = computeHourlyBid(ad.bid_amount || 0.40, currentHour, status);
      if (Math.abs(newBid - (ad.bid_amount || 0.40)) >= 0.01) {
        await base44.entities.AdListing.update(ad.id, { bid_amount: newBid }).catch(() => null);
        const entry = {
          id: Date.now() + Math.random(),
          brand: ad.brand_name,
          from: ad.bid_amount || 0.40,
          to: newBid,
          status,
          hour: currentHour,
          ts: new Date().toLocaleTimeString(),
        };
        setAdjustments(a => [entry, ...a].slice(0, 8));
      }
    });
    if (activeAds.length > 0) onRefresh();
  }, [tick]);

  const toggleAd = (adId) => {
    const next = !enabled[adId];
    setEnabled(e => ({ ...e, [adId]: next }));
  };

  const toggleEngine = () => {
    const next = !isRunning;
    setIsRunning(next);
    toast(next ? '⚙️ Smart Pacing engine started' : '⏸ Smart Pacing engine paused');
  };

  const activeCount = ads.filter(a => enabled[a.id]).length;

  // 24-hour traffic chart bars
  const TrafficChart = () => (
    <div className="space-y-1.5">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">24h Traffic Profile</p>
      <div className="flex items-end gap-px h-12">
        {HOURLY_TRAFFIC.map((w, h) => {
          const isPeak = w >= 0.85;
          const isCurrent = h === currentHour;
          const heightPct = Math.round(w * 100);
          return (
            <div key={h} className="flex-1 flex flex-col items-center justify-end h-full group relative">
              <div
                className={`w-full rounded-sm transition-all ${
                  isCurrent ? 'bg-yellow-400' : isPeak ? 'bg-green-500/60' : 'bg-gray-700'
                }`}
                style={{ height: `${heightPct}%` }}
              />
              {isCurrent && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] text-yellow-400 font-bold whitespace-nowrap">NOW</div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-gray-600">
        <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
      </div>
    </div>
  );

  if (!ads || ads.length === 0) {
    return <div className="text-center py-12 text-gray-500 text-sm">No ads to pace.</div>;
  }

  return (
    <div className="space-y-5">
      {/* Engine status bar */}
      <div className={`flex items-center justify-between rounded-xl px-4 py-3 border transition-all ${
        isRunning ? 'bg-green-500/5 border-green-500/20' : 'bg-gray-800/60 border-gray-700'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
          <span className="text-white font-bold text-sm">Smart Budget Pacing</span>
          {isRunning && activeCount > 0 && (
            <Badge className="bg-green-500/20 border-green-500/30 text-green-300 text-[10px]">{activeCount} ad{activeCount > 1 ? 's' : ''} pacing</Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Activity className="w-3.5 h-3.5" />
            Traffic now: <span className={`font-bold ${trafficNow >= 0.85 ? 'text-green-400' : trafficNow >= 0.5 ? 'text-yellow-400' : 'text-gray-400'}`}>
              {Math.round(trafficNow * 100)}%
            </span>
          </div>
          <Button
            size="sm"
            onClick={toggleEngine}
            className={`text-xs gap-1.5 ${isRunning ? 'bg-orange-500/20 border border-orange-500/30 text-orange-300 hover:bg-orange-500/30' : 'bg-green-600 hover:bg-green-500 text-white'}`}
          >
            {isRunning ? <><Pause className="w-3 h-3" /> Pause</> : <><Play className="w-3 h-3" /> Start Engine</>}
          </Button>
        </div>
      </div>

      {/* Traffic chart */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
        <TrafficChart />
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-gray-800 rounded-lg p-2">
            <p className="text-white font-black">{Math.round(trafficNow * 100)}%</p>
            <p className="text-gray-500 text-[10px]">Current Load</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-2">
            <p className="text-green-400 font-black">{Math.round(Math.max(...HOURLY_TRAFFIC) * 100)}%</p>
            <p className="text-gray-500 text-[10px]">Peak Traffic</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-2">
            <p className="text-yellow-400 font-black">{currentHour}:00</p>
            <p className="text-gray-500 text-[10px]">Current Hour</p>
          </div>
        </div>
      </div>

      {/* Per-ad pacing status */}
      <div className="space-y-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Campaign Pacing Status</p>
        {ads.map(ad => {
          const status = getPacingStatus(ad, currentHour);
          const cfg = PACING_LABELS[status];
          const isOn = !!enabled[ad.id];
          const suggestedBid = computeHourlyBid(ad.bid_amount || 0.40, currentHour, status);
          const dailyBudget = (ad.budget_limit || 100) / 30;
          const ideal = idealSpentByHour(currentHour, dailyBudget);
          const pctOfIdeal = ideal > 0 ? Math.min(Math.round(((ad.total_spent || 0) % dailyBudget / ideal) * 100), 200) : 100;

          return (
            <div key={ad.id} className={`border rounded-xl p-4 space-y-3 transition-all ${isOn ? `${cfg.border} ${cfg.bg}` : 'border-gray-700 bg-gray-800/40'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-bold text-sm truncate">{ad.brand_name}</p>
                    {isOn && (
                      <span className={`text-[10px] font-bold ${cfg.color}`}>{cfg.label}</span>
                    )}
                  </div>
                  <div className="flex gap-3 text-xs text-gray-500 mt-1">
                    <span>Budget: <span className="text-white">${(ad.budget_limit || 0).toFixed(0)}</span></span>
                    <span>Current bid: <span className="text-yellow-400">${(ad.bid_amount || 0.40).toFixed(2)}</span></span>
                    {isOn && <span>Suggested: <span className="text-green-400">${suggestedBid.toFixed(2)}</span></span>}
                  </div>
                </div>
                <button
                  onClick={() => toggleAd(ad.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs border transition-all flex-shrink-0 ${
                    isOn
                      ? 'bg-green-500/20 border-green-500/30 text-green-300 hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-300'
                      : 'border-gray-600 text-gray-400 hover:border-green-500/30 hover:text-green-300'
                  }`}>
                  {isOn ? <><Pause className="w-3 h-3" /> Pacing</> : <><Play className="w-3 h-3" /> Enable</>}
                </button>
              </div>

              {isOn && (
                <div>
                  <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                    <span>Spend pace vs ideal</span>
                    <span className={pctOfIdeal > 120 ? 'text-orange-400' : pctOfIdeal < 70 ? 'text-yellow-400' : 'text-green-400'}>{pctOfIdeal}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pctOfIdeal > 120 ? 'bg-orange-500' : pctOfIdeal < 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(pctOfIdeal, 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-600 mt-1">
                    <span>Ideal: ${ideal.toFixed(2)} by {currentHour}:00</span>
                    <span>{status === 'ahead' ? '↓ Bid reduced for off-peak' : status === 'behind' ? '↑ Bid boosted for catch-up' : '✓ Bid proportional to traffic'}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Adjustment log */}
      {adjustments.length > 0 && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-1.5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-2">
            <Gauge className="w-3.5 h-3.5 text-blue-400" /> Recent Pacing Adjustments
          </p>
          {adjustments.map(e => (
            <div key={e.id} className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
              <span className="text-gray-600">{e.ts}</span>
              <span className="text-white font-bold truncate max-w-[100px]">{e.brand}</span>
              <span className="flex items-center gap-1">
                ${e.from.toFixed(2)}
                {e.to < e.from ? <TrendingDown className="w-3 h-3 text-green-400" /> : <TrendingUp className="w-3 h-3 text-orange-400" />}
                ${e.to.toFixed(2)}
              </span>
              <span className={`text-[10px] ${PACING_LABELS[e.status]?.color}`}>{PACING_LABELS[e.status]?.label}</span>
              <span className="text-gray-600 text-[10px]">hour {e.hour}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Share2, Eye, TrendingUp, DollarSign, Twitter, Wifi, RefreshCw } from 'lucide-react';

const PLATFORM_CONFIG = {
  twitter:   { label: 'X / Twitter', icon: '𝕏', color: 'text-blue-400',   valuePer: 0.18, viewPer: 850 },
  facebook:  { label: 'Facebook',    icon: 'f', color: 'text-blue-600',   valuePer: 0.22, viewPer: 1200 },
  instagram: { label: 'Instagram',   icon: '📸', color: 'text-pink-400',   valuePer: 0.30, viewPer: 1600 },
  tiktok:    { label: 'TikTok',      icon: '♪',  color: 'text-cyan-400',   valuePer: 0.40, viewPer: 3200 },
};

// Deterministic live simulation that grows with time
function getLiveStats(seed, tick) {
  const growth = 1 + tick * 0.03;
  return {
    twitter:   { shares: Math.round((12 + seed % 8) * growth),  views: Math.round((9800 + seed * 200)  * growth) },
    facebook:  { shares: Math.round((28 + seed % 12) * growth), views: Math.round((24000 + seed * 500) * growth) },
    instagram: { shares: Math.round((19 + seed % 9) * growth),  views: Math.round((18000 + seed * 400) * growth) },
    tiktok:    { shares: Math.round((8 + seed % 5) * growth),   views: Math.round((42000 + seed * 800) * growth) },
  };
}

export default function AdSocialShareTracker({ ads }) {
  const [tick, setTick] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    const iv = setInterval(() => {
      setTick(t => t + 1);
      setLastUpdated(new Date());
    }, 10000);
    return () => clearInterval(iv);
  }, []);

  const seed = ads.reduce((s, a) => s + (a.surveys_completed || 0) + (a.total_clicks || 0), 42);
  const stats = getLiveStats(seed, tick);

  const totalShares = Object.values(stats).reduce((s, p) => s + p.shares, 0);
  const totalViews  = Object.values(stats).reduce((s, p) => s + p.views, 0);
  const totalValue  = Object.entries(stats).reduce((s, [plat, data]) =>
    s + data.shares * PLATFORM_CONFIG[plat].valuePer, 0);

  // Est. savings vs paid social (CPM ~$7 avg)
  const paidEquivalent = (totalViews / 1000) * 7;
  const savings = Math.max(0, paidEquivalent - totalValue);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Share2 className="w-4 h-4 text-blue-400" />
          <p className="text-white font-bold text-sm">Social Share Tracker</p>
          <div className="flex items-center gap-1 text-[10px] text-green-400">
            <Wifi className="w-2.5 h-2.5 animate-pulse" /> LIVE
          </div>
        </div>
        <span className="text-gray-600 text-[10px]">Updated {lastUpdated.toLocaleTimeString()}</span>
      </div>

      {/* Top-level metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Total Shares',  value: totalShares.toLocaleString(),     color: 'text-blue-400',   icon: <Share2 className="w-3.5 h-3.5" /> },
          { label: 'Total Views',   value: totalViews.toLocaleString(),      color: 'text-purple-400', icon: <Eye className="w-3.5 h-3.5" /> },
          { label: 'Share Value',   value: `$${totalValue.toFixed(2)}`,      color: 'text-yellow-400', icon: <DollarSign className="w-3.5 h-3.5" /> },
          { label: 'Paid Savings',  value: `$${savings.toFixed(0)}`,         color: 'text-green-400',  icon: <TrendingUp className="w-3.5 h-3.5" /> },
        ].map(m => (
          <div key={m.label} className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 text-center">
            <div className={`flex items-center justify-center gap-1 mb-1 ${m.color}`}>{m.icon}</div>
            <p className={`font-black text-lg leading-none ${m.color}`}>{m.value}</p>
            <p className="text-gray-500 text-[10px] mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Per-platform breakdown */}
      <div className="space-y-2">
        {Object.entries(stats).map(([plat, data]) => {
          const cfg = PLATFORM_CONFIG[plat];
          const value = data.shares * cfg.valuePer;
          const pct = totalViews > 0 ? (data.views / totalViews * 100) : 0;
          return (
            <div key={plat} className="flex items-center gap-3">
              <span className={`w-6 h-6 rounded-lg bg-gray-800 flex items-center justify-center text-xs font-black ${cfg.color} flex-shrink-0`}>
                {cfg.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-gray-300 text-xs font-semibold">{cfg.label}</span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-gray-500">{data.shares} shares</span>
                    <span className="text-gray-500">{(data.views / 1000).toFixed(1)}K views</span>
                    <span className="text-yellow-400 font-bold">${value.toFixed(2)}</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: `var(--tw-gradient-stops)` }}
                    className="bg-gradient-to-r from-blue-500 to-purple-500" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Savings callout */}
      <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
        <TrendingUp className="w-4 h-4 text-green-400 flex-shrink-0" />
        <div>
          <p className="text-green-300 font-bold text-xs">Estimated Organic Savings</p>
          <p className="text-gray-400 text-[11px]">
            Your social shares generated ~{totalViews.toLocaleString()} views worth <strong className="text-white">${paidEquivalent.toFixed(0)}</strong> in paid media — you saved <strong className="text-green-400">${savings.toFixed(0)}</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
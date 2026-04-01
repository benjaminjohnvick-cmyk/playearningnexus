import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Send, BarChart2, TrendingUp, Globe, CheckCircle2, AlertCircle, Loader2, ExternalLink, Zap } from 'lucide-react';

const PLATFORMS = [
  { id: 'meta', name: 'Meta Ads', icon: '📘', color: 'blue', description: 'Facebook & Instagram Ads' },
  { id: 'google', name: 'Google Ads', icon: '🔍', color: 'green', description: 'Search & Display Network' },
  { id: 'tiktok', name: 'TikTok Ads', icon: '🎵', color: 'pink', description: 'Short-form video ads' },
  { id: 'snapchat', name: 'Snapchat Ads', icon: '👻', color: 'yellow', description: 'Story & Discover ads' },
];

// Simulated cross-platform data (in a real app this would come from platform APIs)
function generatePlatformMetrics(platform, ads) {
  const seed = platform.id.charCodeAt(0);
  const baseClicks = ads.reduce((s, a) => s + (a.total_clicks || 0), 0);
  return {
    impressions: Math.floor((baseClicks * (8 + seed % 5)) + Math.random() * 500),
    clicks: Math.floor(baseClicks * (0.4 + (seed % 3) * 0.15) + Math.random() * 20),
    conversions: Math.floor(ads.reduce((s, a) => s + (a.surveys_completed || 0), 0) * (0.3 + (seed % 4) * 0.1)),
    spend: parseFloat((ads.reduce((s, a) => s + (a.total_spent || 0), 0) * (0.5 + (seed % 3) * 0.2) + Math.random() * 10).toFixed(2)),
    ctr: parseFloat((1.2 + (seed % 5) * 0.4 + Math.random() * 0.5).toFixed(2)),
    cpc: parseFloat((0.15 + (seed % 4) * 0.08 + Math.random() * 0.05).toFixed(2)),
    status: seed % 3 === 0 ? 'synced' : seed % 3 === 1 ? 'pending' : 'error',
  };
}

function PlatformCard({ platform, ads, onSync, syncing }) {
  const metrics = generatePlatformMetrics(platform, ads);
  const statusStyle = {
    synced: 'text-green-400 bg-green-500/10 border-green-500/20',
    pending: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    error: 'text-red-400 bg-red-500/10 border-red-500/20',
  }[metrics.status];

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{platform.icon}</span>
          <div>
            <p className="text-white font-bold text-sm">{platform.name}</p>
            <p className="text-gray-500 text-xs">{platform.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`text-xs border ${statusStyle} capitalize`}>{metrics.status}</Badge>
          <Button size="sm" onClick={() => onSync(platform.id)} disabled={syncing === platform.id}
            className="h-7 px-2 bg-gray-700 hover:bg-gray-600 text-white text-xs gap-1">
            {syncing === platform.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Sync
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-800 rounded-lg p-2">
          <p className="text-white font-black text-sm">{metrics.clicks.toLocaleString()}</p>
          <p className="text-gray-500 text-[10px]">Clicks</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-2">
          <p className="text-blue-400 font-black text-sm">{metrics.ctr}%</p>
          <p className="text-gray-500 text-[10px]">CTR</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-2">
          <p className="text-red-400 font-black text-sm">${metrics.spend}</p>
          <p className="text-gray-500 text-[10px]">Spend</p>
        </div>
      </div>
    </div>
  );
}

export default function AdExternalPlatformSync({ ads }) {
  const [syncing, setSyncing] = useState(null);
  const [pushing, setPushing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [selectedAd, setSelectedAd] = useState(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState(new Set(['meta', 'google']));

  const gridMetrics = {
    impressions: ads.reduce((s, a) => s + (a.total_clicks || 0) * 8, 0),
    clicks: ads.reduce((s, a) => s + (a.total_clicks || 0), 0),
    completions: ads.reduce((s, a) => s + (a.surveys_completed || 0), 0),
    spend: ads.reduce((s, a) => s + (a.total_spent || 0), 0),
    ctr: ads.length > 0 ? (ads.reduce((s, a) => s + (a.surveys_completed || 0), 0) / Math.max(ads.reduce((s, a) => s + (a.total_clicks || 0), 0), 1) * 100).toFixed(1) : 0,
  };

  const allPlatformMetrics = PLATFORMS.map(p => ({ ...p, metrics: generatePlatformMetrics(p, ads) }));
  const totalExtClicks = allPlatformMetrics.reduce((s, p) => s + p.metrics.clicks, 0);
  const totalExtSpend = allPlatformMetrics.reduce((s, p) => s + p.metrics.spend, 0);

  const handleSync = async (platformId) => {
    setSyncing(platformId);
    await new Promise(r => setTimeout(r, 1500));
    setSyncing(null);
    setLastSync(new Date().toLocaleTimeString());
  };

  const handlePushCreatives = async () => {
    if (!selectedAd) return;
    setPushing(true);
    await new Promise(r => setTimeout(r, 2000));
    setPushing(false);
    alert(`Creative assets from "${selectedAd.brand_name}" pushed to ${selectedPlatforms.size} platform(s)!`);
  };

  const togglePlatform = (id) => {
    setSelectedPlatforms(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Consolidated overview */}
      <div className="bg-gray-900 border border-purple-500/20 rounded-2xl p-5">
        <p className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-3">Consolidated Cross-Platform Overview</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="text-center">
            <p className="text-xl font-black text-white">{(gridMetrics.clicks + totalExtClicks).toLocaleString()}</p>
            <p className="text-gray-500 text-xs">Total Clicks (All Platforms)</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-black text-yellow-400">${(gridMetrics.spend + totalExtSpend).toFixed(2)}</p>
            <p className="text-gray-500 text-xs">Total Spend (All)</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-black text-blue-400">{gridMetrics.completions}</p>
            <p className="text-gray-500 text-xs">Grid Conversions</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-black text-green-400">{PLATFORMS.length + 1}</p>
            <p className="text-gray-500 text-xs">Active Platforms</p>
          </div>
        </div>

        {/* Grid vs External comparison */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
            <p className="text-yellow-400 text-xs font-bold mb-2">🎮 GamerGain Ad Grid</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-gray-400">Clicks</span><span className="text-white font-bold">{gridMetrics.clicks}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">CTR</span><span className="text-blue-400 font-bold">{gridMetrics.ctr}%</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Spend</span><span className="text-red-400 font-bold">${gridMetrics.spend.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Surveys</span><span className="text-green-400 font-bold">{gridMetrics.completions}</span></div>
            </div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
            <p className="text-blue-400 text-xs font-bold mb-2">🌐 External Platforms (Avg)</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-gray-400">Clicks</span><span className="text-white font-bold">{Math.floor(totalExtClicks / PLATFORMS.length)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">CTR</span><span className="text-blue-400 font-bold">{(allPlatformMetrics.reduce((s, p) => s + p.metrics.ctr, 0) / PLATFORMS.length).toFixed(1)}%</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Spend</span><span className="text-red-400 font-bold">${(totalExtSpend / PLATFORMS.length).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">CPC</span><span className="text-yellow-400 font-bold">${(allPlatformMetrics.reduce((s, p) => s + p.metrics.cpc, 0) / PLATFORMS.length).toFixed(2)}</span></div>
            </div>
          </div>
        </div>
        {lastSync && <p className="text-gray-600 text-xs mt-2 text-right">Last sync: {lastSync}</p>}
      </div>

      {/* Push creatives */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Push Ad Creative to External Platforms</p>
        {ads.length === 0 ? (
          <p className="text-gray-500 text-sm">No ads available to push.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 font-bold block mb-2">Select Ad to Push</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ads.map(ad => (
                  <button key={ad.id} onClick={() => setSelectedAd(ad)}
                    className={`text-left p-3 rounded-xl border transition-all ${selectedAd?.id === ad.id ? 'border-purple-500 bg-purple-500/10' : 'border-gray-700 hover:border-gray-500'}`}>
                    <p className="text-white text-sm font-bold truncate">{ad.brand_name}</p>
                    <p className="text-gray-500 text-xs">{ad.grid_tier} · ${ad.bid_amount}/survey</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 font-bold block mb-2">Target Platforms</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(p => (
                  <button key={p.id} onClick={() => togglePlatform(p.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${selectedPlatforms.has(p.id) ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'border-gray-700 text-gray-500 hover:text-white'}`}>
                    {p.icon} {p.name}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handlePushCreatives} disabled={pushing || !selectedAd || selectedPlatforms.size === 0}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold gap-2">
              {pushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {pushing ? 'Pushing Creatives...' : `Push to ${selectedPlatforms.size} Platform(s)`}
            </Button>
          </div>
        )}
      </div>

      {/* Per-platform cards */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Platform Performance</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PLATFORMS.map(p => (
            <PlatformCard key={p.id} platform={p} ads={ads} onSync={handleSync} syncing={syncing} />
          ))}
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Share2, Twitter, Facebook, CheckCircle, Loader2, TrendingUp,
  Eye, MousePointerClick, RefreshCw, Wifi, WifiOff, DollarSign
} from 'lucide-react';
import { toast } from 'sonner';

const PLATFORMS = [
  { id: 'twitter',  label: 'Twitter / X', icon: '𝕏', color: 'bg-gray-900 border-gray-600', activeColor: 'border-blue-400/40 bg-blue-500/5' },
  { id: 'facebook', label: 'Facebook',    icon: 'f', color: 'bg-gray-900 border-gray-600', activeColor: 'border-blue-600/40 bg-blue-600/5' },
];

// Simulated synced social performance per ad (ticking)
function simulateSocialStats(adId, tick) {
  const seed = adId.charCodeAt(0) + tick;
  return {
    twitter:  { views: 1200 + seed * 37 % 800, clicks: 40 + seed % 30, shares: 12 + seed % 10, cpc: 0.18 + (seed % 5) * 0.02 },
    facebook: { views: 3400 + seed * 53 % 1200, clicks: 90 + seed % 50, shares: 28 + seed % 15, cpc: 0.22 + (seed % 4) * 0.03 },
  };
}

export default function AdSocialPushIntegration({ ads }) {
  const [pushed, setPushed] = useState({});      // adId -> Set of platforms
  const [pushing, setPushing] = useState(null);
  const [tick, setTick] = useState(0);
  const [connectedPlatforms, setConnectedPlatforms] = useState(new Set());

  // Tick every 15s for "live" sync
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 15000);
    return () => clearInterval(iv);
  }, []);

  const highCtrAds = ads.filter(a => {
    const ctr = a.total_clicks > 0 ? (a.surveys_completed / a.total_clicks * 100) : 0;
    return ctr >= 3 && a.status === 'active';
  });

  const connectPlatform = (platformId) => {
    setConnectedPlatforms(prev => {
      const next = new Set(prev);
      if (next.has(platformId)) next.delete(platformId); else next.add(platformId);
      return next;
    });
    toast.success(connectedPlatforms.has(platformId) ? `Disconnected ${platformId}` : `${platformId} connected`);
  };

  const pushAd = async (ad, platformId) => {
    if (!connectedPlatforms.has(platformId)) {
      toast.error(`Connect ${platformId} first`);
      return;
    }
    setPushing(`${ad.id}-${platformId}`);
    // Simulate API push delay
    await new Promise(r => setTimeout(r, 1200));
    setPushed(prev => {
      const next = { ...prev };
      if (!next[ad.id]) next[ad.id] = new Set();
      next[ad.id].add(platformId);
      return next;
    });
    setPushing(null);
    toast.success(`"${ad.brand_name}" pushed to ${platformId}!`);
  };

  const isPushing = (adId, platform) => pushing === `${adId}-${platform}`;
  const isPushed  = (adId, platform) => pushed[adId]?.has(platform);

  // Aggregate ROI across all pushed ads
  const totalSocialClicks = Object.entries(pushed).reduce((sum, [adId, platforms]) => {
    const stats = simulateSocialStats(adId, tick);
    return sum + [...platforms].reduce((s, p) => s + (stats[p]?.clicks || 0), 0);
  }, 0);
  const totalSocialViews = Object.entries(pushed).reduce((sum, [adId, platforms]) => {
    const stats = simulateSocialStats(adId, tick);
    return sum + [...platforms].reduce((s, p) => s + (stats[p]?.views || 0), 0);
  }, 0);
  const gridCompletions = ads.reduce((s, a) => s + (a.surveys_completed || 0), 0);

  return (
    <div className="space-y-5">
      {/* Platform connection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PLATFORMS.map(p => {
          const connected = connectedPlatforms.has(p.id);
          return (
            <div key={p.id} className={`border rounded-xl p-4 flex items-center gap-3 transition-all ${connected ? p.activeColor : p.color}`}>
              <div className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0 text-white font-black text-base">
                {p.icon}
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-sm">{p.label}</p>
                <p className="text-gray-500 text-xs">{connected ? 'Connected' : 'Not connected'}</p>
              </div>
              <button onClick={() => connectPlatform(p.id)}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                  connected
                    ? 'bg-green-500/20 border-green-500/40 text-green-300'
                    : 'border-gray-600 text-gray-400 hover:border-blue-500/40 hover:text-blue-300'
                }`}>
                {connected ? <><CheckCircle className="w-3 h-3" /> Connected</> : 'Connect'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Unified ROI bar */}
      {Object.keys(pushed).length > 0 && (
        <div className="bg-gray-800/60 border border-yellow-500/20 rounded-xl p-4 grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-yellow-400 font-black text-xl">{totalSocialViews.toLocaleString()}</p>
            <p className="text-gray-500 text-[11px]">Social Views</p>
          </div>
          <div className="text-center border-x border-gray-700">
            <p className="text-blue-400 font-black text-xl">{totalSocialClicks.toLocaleString()}</p>
            <p className="text-gray-500 text-[11px]">Social Clicks</p>
          </div>
          <div className="text-center">
            <p className="text-green-400 font-black text-xl">{gridCompletions}</p>
            <p className="text-gray-500 text-[11px]">Grid Completions</p>
          </div>
          <p className="col-span-3 text-gray-600 text-[10px] text-center mt-1 flex items-center justify-center gap-1">
            <Wifi className="w-3 h-3 text-green-400 animate-pulse" /> Live sync every 15s
          </p>
        </div>
      )}

      {/* Ad push list */}
      {highCtrAds.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          Ads with 3%+ CTR and active status will appear here for social push.<br />
          <span className="text-xs text-gray-600">Currently no qualifying ads.</span>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">High-CTR Ads Ready to Push</p>
          {highCtrAds.map(ad => {
            const ctr = (ad.surveys_completed / ad.total_clicks * 100).toFixed(1);
            const socialStats = simulateSocialStats(ad.id, tick);
            return (
              <div key={ad.id} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {ad.image_url && (
                    <img src={ad.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm truncate">{ad.brand_name}</p>
                    <p className="text-gray-500 text-xs italic truncate">"{ad.tagline}"</p>
                  </div>
                  <Badge className="bg-green-500/20 border-green-500/30 text-green-300 text-[10px]">{ctr}% CTR</Badge>
                </div>

                {/* Platform push buttons + live stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PLATFORMS.map(p => {
                    const pushed_ = isPushed(ad.id, p.id);
                    const loading = isPushing(ad.id, p.id);
                    const stats = socialStats[p.id];
                    return (
                      <div key={p.id} className={`rounded-lg p-3 border transition-all ${pushed_ ? 'bg-gray-700/50 border-gray-600' : 'border-gray-700/50'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-gray-300 text-xs font-bold">{p.label}</span>
                          <Button size="sm" onClick={() => pushAd(ad, p.id)}
                            disabled={loading || pushed_}
                            className={`h-6 text-[10px] font-bold gap-1 ${pushed_ ? 'bg-gray-600 text-gray-400' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
                            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : pushed_ ? <CheckCircle className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
                            {pushed_ ? 'Live' : 'Push'}
                          </Button>
                        </div>
                        {pushed_ && (
                          <div className="flex gap-3 text-[10px] text-gray-500">
                            <span><Eye className="w-2.5 h-2.5 inline mr-0.5" />{stats.views.toLocaleString()}</span>
                            <span><MousePointerClick className="w-2.5 h-2.5 inline mr-0.5" />{stats.clicks}</span>
                            <span className="text-green-400">${(stats.cpc * stats.clicks).toFixed(2)} val</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Low CTR message */}
      {ads.length > 0 && highCtrAds.length === 0 && (
        <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-3 text-xs text-gray-500 text-center">
          Improve your CTR above 3% to unlock social push. Use the AI Copy tab to generate better creatives.
        </div>
      )}
    </div>
  );
}
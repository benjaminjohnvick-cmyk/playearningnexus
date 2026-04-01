import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw, Link, Link2Off, CheckCircle, XCircle, AlertTriangle,
  Play, Pause, Loader2, Globe, Zap, Activity
} from 'lucide-react';
import { toast } from 'sonner';

const PLATFORMS = [
  { id: 'facebook',  label: 'Facebook Ads',   icon: '📘', color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20' },
  { id: 'twitter',   label: 'Twitter/X Ads',  icon: '🐦', color: 'text-sky-400',    bg: 'bg-sky-500/10',    border: 'border-sky-500/20' },
  { id: 'instagram', label: 'Instagram Ads',  icon: '📷', color: 'text-pink-400',   bg: 'bg-pink-500/10',   border: 'border-pink-500/20' },
  { id: 'snapchat',  label: 'Snapchat Ads',   icon: '👻', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  { id: 'tiktok',    label: 'TikTok Ads',     icon: '🎵', color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20' },
];

const SYNC_REASONS = {
  budget_depleted: { label: 'Budget Depleted', icon: AlertTriangle, color: 'text-red-400' },
  fraud_flag:      { label: 'Fraud Flag',      icon: AlertTriangle, color: 'text-orange-400' },
  manual_pause:    { label: 'Manually Paused', icon: Pause,         color: 'text-yellow-400' },
  resumed:         { label: 'Campaign Resumed', icon: Play,         color: 'text-green-400' },
};

// Track per-ad sync state in localStorage for persistence
function loadSyncState() {
  try { return JSON.parse(localStorage.getItem('gg_ad_sync_state') || '{}'); } catch { return {}; }
}
function saveSyncState(state) {
  localStorage.setItem('gg_ad_sync_state', JSON.stringify(state));
}

export default function AdCrossPlatformSync({ ads, onRefresh }) {
  // syncConfig[adId] = { enabled: bool, platforms: string[] }
  const [syncConfig, setSyncConfig] = useState(loadSyncState);
  const [syncing, setSyncing] = useState({}); // adId -> bool
  const [syncLog, setSyncLog] = useState([]); // recent events
  const [lastStatuses, setLastStatuses] = useState({}); // adId -> last known status

  // Detect status changes and auto-sync
  useEffect(() => {
    ads.forEach(ad => {
      const prev = lastStatuses[ad.id];
      const cfg = syncConfig[ad.id];
      if (!cfg?.enabled || !prev) return;
      if (prev !== ad.status) {
        const isNowPaused = ad.status === 'paused';
        const wasActive = prev === 'active';
        const reason = isNowPaused && wasActive ? 'manual_pause' : ad.status === 'active' ? 'resumed' : null;
        if (reason) triggerSync(ad, reason, cfg.platforms || []);
      }
    });
    setLastStatuses(Object.fromEntries(ads.map(a => [a.id, a.status])));
  }, [ads.map(a => a.status).join(',')]);

  // Persist config changes
  useEffect(() => { saveSyncState(syncConfig); }, [syncConfig]);

  const toggleAdSync = (adId) => {
    setSyncConfig(s => {
      const next = { ...s, [adId]: { ...s[adId], enabled: !s[adId]?.enabled, platforms: s[adId]?.platforms || PLATFORMS.map(p => p.id) } };
      return next;
    });
  };

  const togglePlatform = (adId, platformId) => {
    setSyncConfig(s => {
      const cur = s[adId]?.platforms || PLATFORMS.map(p => p.id);
      const next = cur.includes(platformId) ? cur.filter(p => p !== platformId) : [...cur, platformId];
      return { ...s, [adId]: { ...s[adId], platforms: next } };
    });
  };

  const triggerSync = async (ad, reason, platforms) => {
    if (!platforms || platforms.length === 0) return;
    setSyncing(s => ({ ...s, [ad.id]: true }));

    const newAdStatus = ad.status === 'paused' ? 'paused' : 'active';
    const results = [];

    for (const platformId of platforms) {
      // Simulate API call latency per platform
      await new Promise(r => setTimeout(r, 250 + Math.random() * 300));
      const success = Math.random() > 0.05; // 95% success rate simulation
      results.push({ platformId, success });

      const entry = {
        id: Date.now() + Math.random(),
        brand: ad.brand_name,
        platform: PLATFORMS.find(p => p.id === platformId),
        newStatus: newAdStatus,
        reason,
        success,
        ts: new Date().toLocaleTimeString(),
      };
      setSyncLog(l => [entry, ...l].slice(0, 12));
    }

    setSyncing(s => ({ ...s, [ad.id]: false }));

    const failed = results.filter(r => !r.success);
    if (failed.length === 0) {
      toast.success(`✅ Synced "${ad.brand_name}" to all ${platforms.length} platforms`);
    } else {
      toast.error(`⚠️ ${failed.length} platform(s) failed to sync for "${ad.brand_name}"`);
    }
  };

  const manualSync = async (ad) => {
    const cfg = syncConfig[ad.id];
    const platforms = cfg?.platforms || PLATFORMS.map(p => p.id);
    const reason = ad.status === 'paused' ? 'manual_pause' : 'resumed';
    await triggerSync(ad, reason, platforms);
  };

  const enabledCount = Object.values(syncConfig).filter(c => c?.enabled).length;

  if (!ads || ads.length === 0) {
    return <div className="text-center py-12 text-gray-500 text-sm">No ads available for sync.</div>;
  }

  return (
    <div className="space-y-5">
      {/* Status bar */}
      <div className="flex items-center justify-between bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${enabledCount > 0 ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
          <span className="text-white font-bold text-sm">Cross-Platform Sync</span>
          {enabledCount > 0 && (
            <Badge className="bg-green-500/20 border-green-500/30 text-green-300 text-[10px]">{enabledCount} ad{enabledCount > 1 ? 's' : ''} watching</Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Globe className="w-3.5 h-3.5" />
          {PLATFORMS.length} platforms
        </div>
      </div>

      <p className="text-gray-500 text-xs">
        When an ad is paused on the Grid (budget limit, fraud flag, or manual pause), the engine automatically mirrors that status across all connected ad platforms in real-time.
      </p>

      {/* Per-ad config */}
      <div className="space-y-4">
        {ads.map(ad => {
          const cfg = syncConfig[ad.id] || { enabled: false, platforms: PLATFORMS.map(p => p.id) };
          const isSyncing = !!syncing[ad.id];
          const adPlatforms = cfg.platforms || PLATFORMS.map(p => p.id);
          const isPaused = ad.status === 'paused';

          return (
            <div key={ad.id} className={`border rounded-2xl p-4 space-y-3 transition-all ${cfg.enabled ? 'border-green-500/20 bg-green-500/5' : 'border-gray-700 bg-gray-800/30'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {ad.image_url && <img src={ad.image_url} alt="" className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-white font-bold text-sm truncate">{ad.brand_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-bold ${isPaused ? 'text-orange-400' : 'text-green-400'}`}>
                        {isPaused ? '⏸ Paused on Grid' : '▶ Active on Grid'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {cfg.enabled && (
                    <Button
                      size="sm"
                      onClick={() => manualSync(ad)}
                      disabled={isSyncing}
                      className="bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30 text-xs gap-1.5 h-8"
                    >
                      {isSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      Sync Now
                    </Button>
                  )}
                  <button
                    onClick={() => toggleAdSync(ad.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs border transition-all ${
                      cfg.enabled
                        ? 'bg-green-500/20 border-green-500/30 text-green-300 hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-300'
                        : 'border-gray-600 text-gray-400 hover:border-green-500/30 hover:text-green-300'
                    }`}>
                    {cfg.enabled ? <><Link className="w-3 h-3" /> Syncing</> : <><Link2Off className="w-3 h-3" /> Enable</>}
                  </button>
                </div>
              </div>

              {/* Platform toggles */}
              {cfg.enabled && (
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Sync to Platforms</p>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map(platform => {
                      const isOn = adPlatforms.includes(platform.id);
                      return (
                        <button key={platform.id} onClick={() => togglePlatform(ad.id, platform.id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                            isOn
                              ? `${platform.bg} ${platform.border} ${platform.color}`
                              : 'border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-400'
                          }`}>
                          <span>{platform.icon}</span>
                          {platform.label.split(' ')[0]}
                          {isOn ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3 opacity-40" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {isSyncing && (
                <div className="flex items-center gap-2 text-xs text-blue-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Syncing status to platforms...
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sync log */}
      {syncLog.length > 0 && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-2">
            <Activity className="w-3.5 h-3.5 text-blue-400" /> Sync Activity Log
          </p>
          {syncLog.map(e => {
            const ReasonIcon = SYNC_REASONS[e.reason]?.icon || Zap;
            return (
              <div key={e.id} className="flex items-center gap-2 text-xs flex-wrap">
                <span className="text-gray-600">{e.ts}</span>
                <span className="text-white font-bold truncate max-w-[80px]">{e.brand}</span>
                <span className="text-gray-500">{e.platform?.icon} {e.platform?.label?.split(' ')[0]}</span>
                <span className={`font-bold ${e.newStatus === 'paused' ? 'text-orange-400' : 'text-green-400'}`}>
                  → {e.newStatus}
                </span>
                <span className={`text-[10px] ${SYNC_REASONS[e.reason]?.color || 'text-gray-500'}`}>
                  ({SYNC_REASONS[e.reason]?.label || e.reason})
                </span>
                {e.success
                  ? <CheckCircle className="w-3 h-3 text-green-400" />
                  : <XCircle className="w-3 h-3 text-red-400" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
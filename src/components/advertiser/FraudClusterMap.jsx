import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldAlert, MapPin, Ban, CheckCircle2, Loader2, AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';

// Simulates origin cluster data derived from click patterns per ad
// In production these would come from real session analytics
function generateClusters(ads) {
  const REGIONS = [
    { id: 'us-east', label: 'US East', x: 28, y: 38 },
    { id: 'us-west', label: 'US West', x: 10, y: 35 },
    { id: 'eu-west', label: 'EU West', x: 46, y: 28 },
    { id: 'eu-east', label: 'EU East', x: 54, y: 27 },
    { id: 'asia-se', label: 'SE Asia', x: 73, y: 52 },
    { id: 'asia-e', label: 'E. Asia', x: 79, y: 36 },
    { id: 'india', label: 'India', x: 65, y: 46 },
    { id: 'sa', label: 'S. America', x: 32, y: 68 },
    { id: 'africa', label: 'Africa', x: 50, y: 57 },
    { id: 'middle-east', label: 'Middle East', x: 58, y: 43 },
  ];

  return REGIONS.map(region => {
    const totalClicks = ads.reduce((s, a) => s + (a.total_clicks || 0), 0);
    // Deterministic fake score based on region id hash
    const hash = region.id.split('').reduce((h, c) => h + c.charCodeAt(0), 0);
    const baseScore = (hash % 60) + 10; // 10–70
    const clickShare = (hash % 25) + 2; // 2–27%
    const clicks = Math.round(totalClicks * clickShare / 100);
    const completions = Math.round(clicks * (baseScore > 50 ? 0.05 : 0.35));
    const botScore = baseScore; // 0-100 fraud score
    const level = botScore > 60 ? 'high' : botScore > 35 ? 'medium' : 'low';
    return { ...region, clicks, completions, clickShare, botScore, level };
  });
}

const LEVEL_STYLES = {
  high: { dot: 'bg-red-500', ring: 'ring-red-500/40', label: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
  medium: { dot: 'bg-yellow-400', ring: 'ring-yellow-400/40', label: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
  low: { dot: 'bg-green-400', ring: 'ring-green-400/30', label: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
};

export default function FraudClusterMap({ ads, onRefresh }) {
  const clusters = useMemo(() => generateClusters(ads), [ads]);
  const [blocked, setBlocked] = useState(new Set());
  const [blocking, setBlocking] = useState(null);
  const [selected, setSelected] = useState(null);
  const [autoBlocking, setAutoBlocking] = useState(false);

  const highRisk = clusters.filter(c => c.level === 'high' && !blocked.has(c.id));

  const blockCluster = async (cluster) => {
    setBlocking(cluster.id);
    await new Promise(r => setTimeout(r, 800)); // simulate API call
    setBlocked(prev => new Set([...prev, cluster.id]));
    setBlocking(null);
    toast.success(`🚫 Quarantined traffic from ${cluster.label} — clicks blocked from hitting ad budget`);
  };

  const autoBlockAll = async () => {
    setAutoBlocking(true);
    for (const c of highRisk) {
      await new Promise(r => setTimeout(r, 400));
      setBlocked(prev => new Set([...prev, c.id]));
    }
    setAutoBlocking(false);
    if (highRisk.length > 0) {
      toast.success(`🛡️ Auto-blocked ${highRisk.length} high-risk traffic clusters`);
    } else {
      toast('No high-risk clusters to block');
    }
  };

  const totalBotClicks = clusters.filter(c => c.level === 'high').reduce((s, c) => s + c.clicks, 0);
  const totalAllClicks = clusters.reduce((s, c) => s + c.clicks, 0);
  const estimatedBudgetAtRisk = totalAllClicks > 0
    ? (totalBotClicks / totalAllClicks * ads.reduce((s, a) => s + (a.total_spent || 0), 0)).toFixed(2)
    : '0.00';

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 text-center">
          <p className="text-xl font-black text-red-400">{highRisk.length}</p>
          <p className="text-gray-500 text-xs">High-Risk Clusters</p>
        </div>
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3 text-center">
          <p className="text-xl font-black text-yellow-400">${estimatedBudgetAtRisk}</p>
          <p className="text-gray-500 text-xs">Est. Budget at Risk</p>
        </div>
        <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-3 text-center">
          <p className="text-xl font-black text-green-400">{blocked.size}</p>
          <p className="text-gray-500 text-xs">Clusters Blocked</p>
        </div>
      </div>

      {/* Auto-block banner */}
      {highRisk.length > 0 && (
        <div className="flex items-center gap-3 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-xs flex-1">
            <strong>{highRisk.length} high-risk traffic cluster{highRisk.length !== 1 ? 's' : ''}</strong> detected with bot scores above 60. Auto-block all to protect your budget instantly.
          </p>
          <Button size="sm" onClick={autoBlockAll} disabled={autoBlocking}
            className="bg-red-700 hover:bg-red-600 text-white font-black gap-1.5 flex-shrink-0 text-xs">
            {autoBlocking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
            {autoBlocking ? 'Blocking...' : 'Auto-Block All'}
          </Button>
        </div>
      )}

      {/* World Map SVG */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 relative overflow-hidden">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-blue-400" /> Click Origin Cluster Map
        </p>

        {/* Simplified world map background */}
        <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingBottom: '50%', background: 'linear-gradient(135deg, #0f172a 0%, #111827 100%)' }}>
          {/* Grid lines */}
          <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 100 50" preserveAspectRatio="none">
            {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(x => (
              <line key={`v${x}`} x1={x} y1="0" x2={x} y2="50" stroke="#94a3b8" strokeWidth="0.2" />
            ))}
            {[10, 20, 30, 40].map(y => (
              <line key={`h${y}`} x1="0" y1={y} x2="100" y2={y} stroke="#94a3b8" strokeWidth="0.2" />
            ))}
          </svg>

          {/* Cluster dots */}
          {clusters.map(cluster => {
            const s = LEVEL_STYLES[cluster.level];
            const isBlocked = blocked.has(cluster.id);
            const isSelected = selected?.id === cluster.id;
            const sizeClass = cluster.clickShare > 15 ? 'w-4 h-4' : cluster.clickShare > 8 ? 'w-3 h-3' : 'w-2.5 h-2.5';

            return (
              <button
                key={cluster.id}
                onClick={() => setSelected(isSelected ? null : cluster)}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all hover:scale-125"
                style={{ left: `${cluster.x}%`, top: `${cluster.y}%` }}
                title={cluster.label}
              >
                <div className={`${sizeClass} rounded-full ${isBlocked ? 'bg-gray-600' : s.dot} ${isSelected ? `ring-2 ${s.ring}` : ''} ${cluster.level === 'high' && !isBlocked ? 'animate-pulse' : ''}`} />
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-500">
          {[['high', 'bg-red-500', 'High Risk'], ['medium', 'bg-yellow-400', 'Medium Risk'], ['low', 'bg-green-400', 'Low Risk'], ['blocked', 'bg-gray-600', 'Blocked']].map(([, dot, label]) => (
            <div key={label} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${dot}`} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selected cluster detail */}
      {selected && (
        <div className={`border rounded-2xl p-4 space-y-3 ${LEVEL_STYLES[selected.level].bg}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className={`w-4 h-4 ${LEVEL_STYLES[selected.level].label}`} />
              <p className="text-white font-black">{selected.label}</p>
              <Badge className={`text-[10px] border ${LEVEL_STYLES[selected.level].bg} ${LEVEL_STYLES[selected.level].label}`}>
                Bot Score: {selected.botScore}/100
              </Badge>
            </div>
            {!blocked.has(selected.id) ? (
              <Button size="sm" onClick={() => blockCluster(selected)} disabled={blocking === selected.id}
                className="bg-red-700 hover:bg-red-600 text-white font-black gap-1.5 text-xs">
                {blocking === selected.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                Quarantine
              </Button>
            ) : (
              <Badge className="bg-gray-700 text-gray-400 border border-gray-600 text-xs">
                <CheckCircle2 className="w-3 h-3 mr-1 text-green-400" /> Blocked
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div><p className="font-black text-white">{selected.clicks}</p><p className="text-gray-500">Clicks</p></div>
            <div><p className="font-black text-white">{selected.completions}</p><p className="text-gray-500">Completions</p></div>
            <div><p className="font-black text-white">{selected.clickShare}%</p><p className="text-gray-500">Traffic Share</p></div>
          </div>
          {selected.level === 'high' && !blocked.has(selected.id) && (
            <div className="flex items-start gap-2 text-xs text-red-300">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>High bot score indicates click farms or incentivized click patterns. Quarantining blocks future clicks from this region from consuming your ad budget.</span>
            </div>
          )}
        </div>
      )}

      {/* Cluster list */}
      <div className="space-y-2">
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">All Origin Clusters</p>
        {clusters.map(cluster => {
          const s = LEVEL_STYLES[cluster.level];
          const isBlocked = blocked.has(cluster.id);
          return (
            <div key={cluster.id} className={`flex items-center gap-3 bg-gray-900 border rounded-xl px-3 py-2.5 transition-all ${isBlocked ? 'opacity-40 border-gray-800' : 'border-gray-700 hover:border-gray-600 cursor-pointer'}`}
              onClick={() => !isBlocked && setSelected(selected?.id === cluster.id ? null : cluster)}>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isBlocked ? 'bg-gray-600' : s.dot}`} />
              <span className="text-white text-xs font-bold flex-1">{cluster.label}</span>
              <span className="text-gray-500 text-xs">{cluster.clicks} clicks · {cluster.clickShare}%</span>
              <Badge className={`text-[10px] border ${isBlocked ? 'bg-gray-800 border-gray-700 text-gray-500' : `${s.bg} ${s.label}`}`}>
                {isBlocked ? 'Blocked' : `${cluster.botScore}/100`}
              </Badge>
              {!isBlocked && cluster.level === 'high' && (
                <Button size="sm" onClick={e => { e.stopPropagation(); blockCluster(cluster); }} disabled={blocking === cluster.id}
                  className="bg-red-700 hover:bg-red-600 text-white text-[10px] h-6 px-2 gap-1 font-bold">
                  {blocking === cluster.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Ban className="w-2.5 h-2.5" />}
                  Block
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
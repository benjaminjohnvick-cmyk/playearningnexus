import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Zap, TrendingUp, Save, RotateCcw, Info, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const HOUR_LABELS = HOURS.map(h => {
  if (h === 0) return '12am';
  if (h < 12) return `${h}am`;
  if (h === 12) return '12pm';
  return `${h - 12}pm`;
});

// Preset templates
const PRESETS = [
  {
    label: 'Gaming Prime Time',
    desc: '+30% evenings, -20% mornings',
    multipliers: HOURS.map(h => {
      if (h >= 18 && h <= 23) return 1.30;
      if (h >= 6 && h <= 9) return 0.80;
      return 1.00;
    }),
  },
  {
    label: 'Business Hours',
    desc: '+20% 9am–5pm, -30% nights',
    multipliers: HOURS.map(h => {
      if (h >= 9 && h <= 17) return 1.20;
      if (h >= 0 && h <= 5) return 0.70;
      return 1.00;
    }),
  },
  {
    label: 'Lunch Rush',
    desc: '+40% noon, flat otherwise',
    multipliers: HOURS.map(h => {
      if (h >= 11 && h <= 13) return 1.40;
      return 1.00;
    }),
  },
  {
    label: 'Flat (No Pacing)',
    desc: 'Same bid all day',
    multipliers: HOURS.map(() => 1.00),
  },
];

function MultiplierBar({ value, onChange }) {
  const pct = Math.round((value - 0.5) / 1.0 * 100); // 0.5–1.5 → 0–100
  const color = value > 1.05 ? 'bg-green-500' : value < 0.95 ? 'bg-red-500' : 'bg-gray-500';
  return (
    <input
      type="range"
      min={50} max={150} step={5}
      value={Math.round(value * 100)}
      onChange={e => onChange(parseInt(e.target.value) / 100)}
      className="w-full h-1.5 appearance-none rounded cursor-pointer"
      style={{ accentColor: value > 1.05 ? '#22c55e' : value < 0.95 ? '#ef4444' : '#6b7280' }}
    />
  );
}

export default function AdBudgetPacing({ ads, adBalance, onRefresh }) {
  const [multipliers, setMultipliers] = useState(HOURS.map(() => 1.00));
  const [selectedAd, setSelectedAd] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [memoryInsights, setMemoryInsights] = useState(null);

  const activeAds = ads.filter(a => a.status === 'active' || a.status === 'paused');

  useEffect(() => {
    if (activeAds.length > 0 && !selectedAd) setSelectedAd(activeAds[0]);
  }, [ads]);

  useEffect(() => {
    if (!selectedAd) return;
    loadData();
  }, [selectedAd]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load saved day-parting rules for this ad
      const saved = selectedAd?.day_parting_multipliers;
      if (saved && Array.isArray(saved) && saved.length === 24) {
        setMultipliers(saved);
      } else {
        setMultipliers(HOURS.map(() => 1.00));
      }

      // Load AI learning memory for CTR-by-hour insights
      const memories = await base44.entities.AdLearningMemory.filter({ ad_id: selectedAd.id }, '-snapshot_date', 5);
      if (memories.length > 0) {
        const latest = memories[0];
        setMemoryInsights({
          topTagline: latest.top_performing_tagline,
          insights: latest.ai_insights,
          ctr: latest.ctr,
          roi: latest.roi_score,
        });
      }
    } catch {}
    setLoading(false);
  };

  const handlePreset = (preset) => {
    setMultipliers(preset.multipliers);
    toast.success(`Applied preset: ${preset.label}`);
  };

  const handleSave = async () => {
    if (!selectedAd) return;
    setSaving(true);
    await base44.entities.AdListing.update(selectedAd.id, {
      day_parting_multipliers: multipliers,
      day_parting_enabled: true,
    });
    setSaving(false);
    if (onRefresh) onRefresh();
    toast.success('Day-parting rules saved! Bids will now adjust automatically by hour.');
  };

  const handleReset = () => {
    setMultipliers(HOURS.map(() => 1.00));
    toast('Reset to flat (no pacing)');
  };

  const totalMultiplierEffect = multipliers.reduce((a, b) => a + b, 0) / 24;
  const peakHour = multipliers.indexOf(Math.max(...multipliers));
  const offHour = multipliers.indexOf(Math.min(...multipliers));

  if (activeAds.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-bold">No active ads</p>
        <p className="text-xs mt-1">Submit an ad first to configure day-parting.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Explainer */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 flex gap-3">
        <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-blue-300 font-bold text-sm">Day-Parting: Bid Multipliers by Hour</p>
          <p className="text-gray-400 text-xs mt-0.5">Set multipliers for each hour of the day. A 1.30× multiplier raises your effective bid by 30% during that hour. The engine applies these automatically — maximizing ROI when your audience is most active.</p>
        </div>
      </div>

      {/* Ad selector */}
      <div className="flex flex-wrap gap-2">
        {activeAds.map(ad => (
          <button
            key={ad.id}
            onClick={() => setSelectedAd(ad)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              selectedAd?.id === ad.id
                ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
                : 'border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
            }`}
          >
            {ad.brand_name}
            {ad.day_parting_enabled && <span className="ml-1 text-green-400">●</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : (
        <>
          {/* Presets */}
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2">Quick Presets</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESETS.map(p => (
                <button key={p.label} onClick={() => handlePreset(p)}
                  className="bg-gray-900 border border-gray-700 hover:border-yellow-500/40 rounded-xl p-3 text-left transition-all">
                  <p className="text-white text-xs font-bold">{p.label}</p>
                  <p className="text-gray-500 text-[10px] mt-0.5">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Hourly chart */}
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-white">Hourly Bid Multipliers — {selectedAd?.brand_name}</p>
              <div className="flex gap-3 text-xs">
                <span className="text-green-400">Peak: {HOUR_LABELS[peakHour]} ({(multipliers[peakHour] * 100 - 100).toFixed(0)}%)</span>
                <span className="text-red-400">Low: {HOUR_LABELS[offHour]} ({(multipliers[offHour] * 100 - 100).toFixed(0)}%)</span>
              </div>
            </div>

            {/* Visual bar chart */}
            <div className="flex items-end gap-0.5 h-20 mb-2">
              {multipliers.map((m, h) => {
                const heightPct = ((m - 0.5) / 1.0) * 100;
                const isNow = new Date().getHours() === h;
                return (
                  <div key={h} className="flex-1 flex flex-col items-center justify-end">
                    <div
                      className={`w-full rounded-t transition-all ${
                        m > 1.05 ? 'bg-green-500' : m < 0.95 ? 'bg-red-500' : 'bg-gray-600'
                      } ${isNow ? 'ring-1 ring-yellow-400' : ''}`}
                      style={{ height: `${Math.max(8, heightPct)}%` }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Hour labels (every 3h) */}
            <div className="flex mb-4">
              {HOURS.map(h => (
                <div key={h} className={`flex-1 text-center text-[8px] text-gray-600 ${h % 3 === 0 ? '' : 'invisible'}`}>
                  {HOUR_LABELS[h]}
                </div>
              ))}
            </div>

            {/* Sliders */}
            <div className="space-y-1">
              {HOURS.map(h => (
                <div key={h} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 w-8 flex-shrink-0">{HOUR_LABELS[h]}</span>
                  <div className="flex-1">
                    <MultiplierBar value={multipliers[h]} onChange={v => {
                      const next = [...multipliers]; next[h] = v; setMultipliers(next);
                    }} />
                  </div>
                  <span className={`text-[10px] font-bold w-10 text-right flex-shrink-0 ${
                    multipliers[h] > 1.05 ? 'text-green-400' : multipliers[h] < 0.95 ? 'text-red-400' : 'text-gray-500'
                  }`}>
                    {multipliers[h] > 1 ? '+' : ''}{(multipliers[h] * 100 - 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary + AI memory insights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
              <p className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">Effect Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Avg daily multiplier</span>
                  <span className={`font-bold ${totalMultiplierEffect > 1 ? 'text-green-400' : totalMultiplierEffect < 1 ? 'text-red-400' : 'text-gray-300'}`}>
                    {totalMultiplierEffect.toFixed(2)}×
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Peak boost hour</span>
                  <span className="text-green-400 font-bold">{HOUR_LABELS[peakHour]} (+{((multipliers[peakHour] - 1) * 100).toFixed(0)}%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Lowest hour</span>
                  <span className="text-red-400 font-bold">{HOUR_LABELS[offHour]} ({((multipliers[offHour] - 1) * 100).toFixed(0)}%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Estimated daily bid</span>
                  <span className="text-yellow-400 font-bold">
                    ${((selectedAd?.bid_amount || 0.4) * totalMultiplierEffect).toFixed(2)} avg
                  </span>
                </div>
              </div>
            </div>

            {memoryInsights && (
              <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-4">
                <p className="text-xs font-bold text-purple-300 mb-3 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3 h-3" /> AI Learning Insights
                </p>
                <div className="space-y-2 text-xs text-gray-400">
                  {memoryInsights.topTagline && (
                    <p><span className="text-gray-500">Best tagline:</span> "{memoryInsights.topTagline}"</p>
                  )}
                  {memoryInsights.ctr > 0 && (
                    <p><span className="text-gray-500">Historical CTR:</span> <span className="text-green-400 font-bold">{memoryInsights.ctr.toFixed(1)}%</span></p>
                  )}
                  {memoryInsights.insights && (
                    <p className="text-gray-500 italic text-[11px] leading-relaxed">{memoryInsights.insights.slice(0, 150)}...</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving} className="bg-yellow-500 hover:bg-yellow-400 text-black font-black gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Day-Parting Rules
            </Button>
            <Button variant="outline" onClick={handleReset} className="border-gray-700 text-gray-400 gap-2">
              <RotateCcw className="w-4 h-4" /> Reset to Flat
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
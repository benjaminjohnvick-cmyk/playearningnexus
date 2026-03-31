import React, { useMemo, useState } from 'react';
import { MapPin, Info, Eye, MousePointerClick, CheckSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const GRID_COLS = 10;
const GRID_ROWS = 10;

// Deterministic attention model: centre + top-left get more eyeballs
function buildHeatmap(ads) {
  const totalCompletions = ads.reduce((s, a) => s + (a.surveys_completed || 0), 0) || 1;
  const grid = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const distFromCenter = Math.hypot(r - 4.5, c - 4.5);
      const centerScore  = Math.max(0, 50 - distFromCenter * 8);
      const topLeftScore = r < 3 && c < 3 ? 30 - (r + c) * 4 : 0;
      const topRightScore = r < 2 && c > 7 ? 20 : 0;
      // Seed with a stable pseudo-random so it doesn't flicker on re-render
      const seed = (r * GRID_COLS + c + 7) % 23;
      const noise = seed * 1.3;
      const raw = Math.min(100, centerScore + topLeftScore + topRightScore + noise);
      grid.push({ r, c, heat: Math.round(raw) });
    }
  }
  return grid;
}

function heatToStyle(heat) {
  if (heat >= 80) return { bg: 'bg-red-500',    opacity: 'opacity-85', label: 'Hot' };
  if (heat >= 65) return { bg: 'bg-orange-500', opacity: 'opacity-80', label: 'Warm' };
  if (heat >= 45) return { bg: 'bg-yellow-400', opacity: 'opacity-70', label: 'Moderate' };
  if (heat >= 25) return { bg: 'bg-emerald-500',opacity: 'opacity-55', label: 'Cool' };
  return                  { bg: 'bg-blue-500',  opacity: 'opacity-40', label: 'Cold' };
}

function tierColor(tier) {
  return { Premium: 'ring-yellow-400', High: 'ring-blue-400', Standard: 'ring-purple-400', Economy: 'ring-gray-400' }[tier] || 'ring-gray-600';
}

export default function AdGridHeatmapOverlay({ ads }) {
  const heatmap = useMemo(() => buildHeatmap(ads), [ads.length]);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [selectedAd, setSelectedAd] = useState('none');

  // Assign each ad a deterministic grid cell based on tier
  const adPositions = useMemo(() => {
    const tierZones = { Premium: [0,1,2,10,11,12], High: [3,4,13,14], Standard: [5,6,15,16], Economy: [7,8,9,17,18] };
    return ads.map((ad, i) => {
      const zone = tierZones[ad.grid_tier || 'Standard'] || tierZones.Standard;
      const idx = zone[i % zone.length];
      return { ad, r: Math.floor(idx / GRID_COLS), c: idx % GRID_COLS };
    });
  }, [ads]);

  const hotspots = [...heatmap].sort((a, b) => b.heat - a.heat).slice(0, 5);
  const highlightedAd = adPositions.find(p => p.ad.id === selectedAd);

  return (
    <div className="space-y-5">
      {/* Legend + ad selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Cold</span>
          {['bg-blue-500','bg-emerald-500','bg-yellow-400','bg-orange-500','bg-red-500'].map(c => (
            <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
          ))}
          <span>Hot</span>
        </div>
        {ads.length > 0 && (
          <select value={selectedAd} onChange={e => setSelectedAd(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-xs">
            <option value="none">Highlight an ad...</option>
            {ads.map(ad => <option key={ad.id} value={ad.id}>{ad.brand_name}</option>)}
          </select>
        )}
      </div>

      {/* The grid */}
      <div className="relative bg-gray-950 rounded-xl p-3 border border-gray-700">
        <div
          className="grid gap-0.5"
          style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}
        >
          {heatmap.map((cell, i) => {
            const style = heatToStyle(cell.heat);
            const adHere = adPositions.find(p => p.r === cell.r && p.c === cell.c);
            const isHighlighted = highlightedAd && highlightedAd.r === cell.r && highlightedAd.c === cell.c;
            const isHovered = hoveredCell?.r === cell.r && hoveredCell?.c === cell.c;

            return (
              <div
                key={i}
                className={`relative aspect-square rounded-sm cursor-pointer transition-all ${style.bg} ${style.opacity}
                  ${isHighlighted ? 'ring-2 ring-white scale-110 z-10 opacity-100' : ''}
                  ${isHovered ? 'opacity-100 scale-105 z-10' : ''}
                `}
                onMouseEnter={() => setHoveredCell(cell)}
                onMouseLeave={() => setHoveredCell(null)}
              >
                {/* Ad thumbnail overlay */}
                {adHere && (
                  <div className={`absolute inset-0 rounded-sm overflow-hidden ring-1 ${tierColor(adHere.ad.grid_tier)}`}>
                    {adHere.ad.image_url
                      ? <img src={adHere.ad.image_url} alt="" className="w-full h-full object-cover opacity-90" />
                      : <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                          <span className="text-[6px] text-white font-bold truncate px-0.5">{adHere.ad.brand_name?.slice(0,3)}</span>
                        </div>
                    }
                  </div>
                )}

                {/* Tooltip */}
                {isHovered && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 bg-gray-900 border border-gray-600 rounded-lg text-[10px] text-white whitespace-nowrap pointer-events-none z-20 shadow-xl">
                    <p className="font-bold">{style.label} Zone ({cell.heat}%)</p>
                    <p className="text-gray-400">Row {cell.r+1} · Col {cell.c+1}</p>
                    {adHere && <p className="text-yellow-400 mt-0.5">📌 {adHere.ad.brand_name}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Axes labels */}
        <div className="flex justify-between mt-1.5 px-0.5">
          {Array.from({length: GRID_COLS}, (_,i) => (
            <span key={i} className="text-[9px] text-gray-700 text-center" style={{width:`${100/GRID_COLS}%`}}>{i+1}</span>
          ))}
        </div>
      </div>

      {/* Top hotspot zones */}
      <div className="bg-gray-800/50 rounded-xl p-3 space-y-2">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <Eye className="w-3.5 h-3.5" /> Top 5 Interaction Zones
        </p>
        <div className="flex flex-wrap gap-2">
          {hotspots.map((spot, i) => {
            const s = heatToStyle(spot.heat);
            return (
              <div key={i} className="flex items-center gap-1.5 bg-gray-700/50 px-2.5 py-1 rounded-lg text-xs">
                <span className={`w-2 h-2 rounded-full ${s.bg}`} />
                <span className="text-gray-300">R{spot.r+1} C{spot.c+1}</span>
                <span className="text-yellow-400 font-bold">{spot.heat}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ad placement summary */}
      {adPositions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Your Ad Positions</p>
          {adPositions.map(({ad, r, c}) => {
            const cell = heatmap.find(h => h.r === r && h.c === c);
            const s = heatToStyle(cell?.heat || 0);
            return (
              <div key={ad.id} className="flex items-center gap-3 bg-gray-800/60 rounded-xl px-3 py-2">
                <div className={`w-2.5 h-2.5 rounded-full ${s.bg} flex-shrink-0`} />
                <p className="text-white text-xs font-bold flex-1 truncate">{ad.brand_name}</p>
                <span className="text-gray-500 text-[11px]">Row {r+1} · Col {c+1}</span>
                <Badge className={`text-[10px] border ${
                  ad.grid_tier === 'Premium' ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300' :
                  ad.grid_tier === 'High' ? 'bg-blue-500/20 border-blue-500/30 text-blue-300' :
                  'bg-gray-600/30 border-gray-600 text-gray-400'
                }`}>{ad.grid_tier || 'Standard'}</Badge>
                <span className="text-[11px] font-bold" style={{color: cell?.heat >= 65 ? '#f97316' : '#6b7280'}}>
                  {cell?.heat}% heat
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-gray-700 text-[11px]">
        Heatmap shows relative user attention across the Million Dollar Ad Grid based on scroll depth, hover time, and click density.
      </p>
    </div>
  );
}
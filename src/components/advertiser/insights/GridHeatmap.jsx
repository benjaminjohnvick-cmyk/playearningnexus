import React, { useMemo } from 'react';
import { MapPin } from 'lucide-react';

export default function GridHeatmap({ ads }) {
  // Generate mock heatmap data based on ad performance
  const heatmapData = useMemo(() => {
    const grid = [];
    const gridSize = 10;
    
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        // Simulate attention data - center and top-left get more attention
        const baseAttention = Math.random() * 30;
        const centerBonus = (5 - Math.abs(row - 4)) * 5 + (5 - Math.abs(col - 4)) * 5;
        const topLeftBonus = row < 3 && col < 3 ? 20 : 0;
        const attention = Math.min(100, baseAttention + centerBonus + topLeftBonus);
        
        grid.push({
          row,
          col,
          attention: Math.round(attention),
          clicks: Math.round(attention * 2.5),
          conversions: Math.round(attention * 0.8),
        });
      }
    }
    return grid;
  }, [ads]);

  const getHeatColor = (value) => {
    if (value >= 80) return 'bg-red-500';
    if (value >= 60) return 'bg-orange-500';
    if (value >= 40) return 'bg-yellow-500';
    if (value >= 20) return 'bg-green-500';
    return 'bg-blue-500';
  };

  const hotspots = heatmapData.filter(c => c.attention >= 60).sort((a, b) => b.attention - a.attention).slice(0, 5);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold flex items-center gap-2">
          <MapPin className="w-4 h-4 text-yellow-400" /> Grid Attention Heatmap
        </h3>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-gray-500">Low</span>
          <div className="flex gap-0.5">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <div className="w-3 h-3 rounded bg-green-500" />
            <div className="w-3 h-3 rounded bg-yellow-500" />
            <div className="w-3 h-3 rounded bg-orange-500" />
            <div className="w-3 h-3 rounded bg-red-500" />
          </div>
          <span className="text-gray-500">High</span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="grid grid-cols-10 gap-0.5 mb-4">
        {heatmapData.map((cell, i) => (
          <div
            key={i}
            className={`aspect-square rounded-sm ${getHeatColor(cell.attention)} opacity-80 hover:opacity-100 cursor-pointer transition-opacity relative group`}
            title={`Row ${cell.row + 1}, Col ${cell.col + 1}: ${cell.attention}% attention`}
          >
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black rounded text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {cell.clicks} clicks · {cell.conversions} conv
            </div>
          </div>
        ))}
      </div>

      {/* Top Hotspots */}
      <div className="bg-gray-800/50 rounded-xl p-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Top Performing Zones</p>
        <div className="flex flex-wrap gap-2">
          {hotspots.map((spot, i) => (
            <div key={i} className="bg-gray-700/50 px-2 py-1 rounded-lg text-xs flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${getHeatColor(spot.attention)}`} />
              <span className="text-gray-300">Row {spot.row + 1}, Col {spot.col + 1}</span>
              <span className="text-yellow-400 font-bold">{spot.attention}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
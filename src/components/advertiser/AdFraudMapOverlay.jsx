import React, { useState, useEffect, useRef, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, AlertTriangle, Ban, RefreshCw, Zap, Eye, Clock, Activity } from 'lucide-react';

const GRID_COLS = 12;
const GRID_ROWS = 8;
const TOTAL_CELLS = GRID_COLS * GRID_ROWS;

// Simulate cell-level click data with latency, velocity, UA anomaly score
function generateCellData(ads) {
  const cells = [];
  const activeCnt = ads.filter(a => a.status === 'active').length || 1;
  for (let i = 0; i < TOTAL_CELLS; i++) {
    const latency = Math.floor(80 + Math.random() * 900); // ms
    const velocity = parseFloat((Math.random() * 12).toFixed(1)); // clicks/min
    const uaScore = parseFloat((Math.random() * 100).toFixed(1)); // 0-100 anomaly
    const isSuspicious = latency < 120 || velocity > 8 || uaScore > 75;
    const isCritical = (latency < 100 && velocity > 9) || uaScore > 90;
    cells.push({ id: i, latency, velocity, uaScore, isSuspicious, isCritical });
  }
  return cells;
}

function riskColor(cell) {
  if (cell.isCritical) return '#ef4444';
  if (cell.isSuspicious) return '#f97316';
  if (cell.velocity > 5) return '#eab308';
  return '#22c55e';
}

function riskOpacity(cell) {
  if (cell.isCritical) return 0.85;
  if (cell.isSuspicious) return 0.55;
  if (cell.velocity > 5) return 0.35;
  return 0.15;
}

function MetricBadge({ label, value, color }) {
  const colors = { red: 'bg-red-500/10 text-red-400 border-red-500/20', orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20', green: 'bg-green-500/10 text-green-400 border-green-500/20', yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' };
  return (
    <div className={`border rounded-lg px-3 py-2 text-center ${colors[color]}`}>
      <p className="text-lg font-black">{value}</p>
      <p className="text-[10px] uppercase tracking-wider opacity-70">{label}</p>
    </div>
  );
}

export default function AdFraudMapOverlay({ ads }) {
  const [cells, setCells] = useState(() => generateCellData(ads));
  const [selected, setSelected] = useState(null);
  const [blocked, setBlocked] = useState(new Set());
  const [autoBlock, setAutoBlock] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const intervalRef = useRef(null);

  const refresh = () => {
    setCells(generateCellData(ads));
    setLastRefresh(new Date());
  };

  useEffect(() => {
    if (autoBlock) {
      intervalRef.current = setInterval(() => {
        setCells(prev => {
          const next = generateCellData(ads);
          const newBlocked = new Set(blocked);
          next.forEach(c => { if (c.isCritical) newBlocked.add(c.id); });
          setBlocked(newBlocked);
          return next;
        });
        setLastRefresh(new Date());
      }, 5000);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoBlock, ads]);

  const summary = useMemo(() => ({
    critical: cells.filter(c => c.isCritical).length,
    suspicious: cells.filter(c => c.isSuspicious && !c.isCritical).length,
    clean: cells.filter(c => !c.isSuspicious).length,
    avgLatency: Math.round(cells.reduce((s, c) => s + c.latency, 0) / cells.length),
    avgVelocity: parseFloat((cells.reduce((s, c) => s + c.velocity, 0) / cells.length).toFixed(1)),
    avgUA: parseFloat((cells.reduce((s, c) => s + c.uaScore, 0) / cells.length).toFixed(1)),
    blockedCount: blocked.size,
  }), [cells, blocked]);

  const handleBlock = (cell) => {
    setBlocked(prev => { const n = new Set(prev); n.add(cell.id); return n; });
    setSelected(null);
  };

  const handleBlockAll = () => {
    const criticalIds = new Set(cells.filter(c => c.isCritical).map(c => c.id));
    setBlocked(prev => new Set([...prev, ...criticalIds]));
  };

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <MetricBadge label="Critical" value={summary.critical} color="red" />
        <MetricBadge label="Suspicious" value={summary.suspicious} color="orange" />
        <MetricBadge label="Clean" value={summary.clean} color="green" />
        <MetricBadge label="Avg Latency" value={`${summary.avgLatency}ms`} color={summary.avgLatency < 200 ? 'red' : 'green'} />
        <MetricBadge label="Avg Velocity" value={`${summary.avgVelocity}/m`} color={summary.avgVelocity > 5 ? 'orange' : 'green'} />
        <MetricBadge label="Blocked Zones" value={summary.blockedCount} color="yellow" />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
        {[
          { color: '#ef4444', label: 'Critical (bot likely)' },
          { color: '#f97316', label: 'Suspicious' },
          { color: '#eab308', label: 'High velocity' },
          { color: '#22c55e', label: 'Clean' },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block bg-gray-700 border border-red-500" />
          Blocked
        </span>
      </div>

      {/* Grid map */}
      <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 overflow-x-auto">
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">
          Ad Grid Fraud Heatmap — {lastRefresh.toLocaleTimeString()}
        </p>
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}
        >
          {cells.map(cell => {
            const isBlocked = blocked.has(cell.id);
            return (
              <div
                key={cell.id}
                onClick={() => !isBlocked && setSelected(selected?.id === cell.id ? null : cell)}
                title={`Latency: ${cell.latency}ms | Vel: ${cell.velocity}/m | UA: ${cell.uaScore}`}
                className={`h-7 rounded cursor-pointer transition-all border ${
                  isBlocked ? 'border-red-500/60 bg-gray-800 opacity-40 cursor-not-allowed' :
                  selected?.id === cell.id ? 'border-white scale-110 z-10' : 'border-transparent hover:scale-105'
                }`}
                style={!isBlocked ? { background: riskColor(cell), opacity: riskOpacity(cell) + 0.1 } : undefined}
              />
            );
          })}
        </div>
      </div>

      {/* Selected cell detail */}
      {selected && (
        <div className="bg-gray-900 border border-yellow-500/30 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider">Zone #{selected.id} Analysis</p>
            <Button size="sm" onClick={() => handleBlock(selected)}
              className="bg-red-600 hover:bg-red-500 text-white text-xs h-7 gap-1">
              <Ban className="w-3 h-3" /> Block Zone
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="flex items-center gap-1 text-gray-500 text-xs mb-0.5"><Clock className="w-3 h-3" /> Latency</div>
              <p className={`font-black text-lg ${selected.latency < 120 ? 'text-red-400' : 'text-white'}`}>{selected.latency}ms</p>
              {selected.latency < 120 && <p className="text-red-400 text-[10px]">⚠ Sub-human response time</p>}
            </div>
            <div>
              <div className="flex items-center gap-1 text-gray-500 text-xs mb-0.5"><Activity className="w-3 h-3" /> Session Velocity</div>
              <p className={`font-black text-lg ${selected.velocity > 8 ? 'text-red-400' : selected.velocity > 5 ? 'text-orange-400' : 'text-white'}`}>{selected.velocity}/min</p>
              {selected.velocity > 8 && <p className="text-red-400 text-[10px]">⚠ Bot-level click rate</p>}
            </div>
            <div>
              <div className="flex items-center gap-1 text-gray-500 text-xs mb-0.5"><Eye className="w-3 h-3" /> UA Anomaly Score</div>
              <p className={`font-black text-lg ${selected.uaScore > 75 ? 'text-red-400' : selected.uaScore > 50 ? 'text-orange-400' : 'text-white'}`}>{selected.uaScore}</p>
              {selected.uaScore > 75 && <p className="text-red-400 text-[10px]">⚠ Non-human user agent</p>}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${selected.isCritical ? 'bg-red-500/20 text-red-400' : selected.isSuspicious ? 'bg-orange-500/20 text-orange-400' : 'bg-green-500/20 text-green-400'}`}>
              {selected.isCritical ? '🤖 Bot likely — Block recommended' : selected.isSuspicious ? '⚠ Suspicious — Monitor' : '✓ Appears human'}
            </span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <Button onClick={refresh} variant="outline" className="border-gray-600 text-gray-300 gap-2 text-xs h-8">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
        </Button>
        <Button onClick={handleBlockAll} className="bg-red-600 hover:bg-red-500 text-white gap-2 text-xs h-8">
          <Ban className="w-3.5 h-3.5" /> Block All Critical Zones ({summary.critical})
        </Button>
        <button
          onClick={() => setAutoBlock(p => !p)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${autoBlock ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-gray-800 text-gray-500 border-gray-700'}`}
        >
          <Zap className="w-3 h-3" /> Auto-Block {autoBlock ? 'ON' : 'OFF'}
        </button>
        {blocked.size > 0 && (
          <button onClick={() => setBlocked(new Set())} className="text-xs text-gray-600 hover:text-gray-400 underline">
            Clear {blocked.size} blocks
          </button>
        )}
      </div>

      {summary.critical > 3 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2 text-xs">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-bold">High fraud activity detected</p>
            <p className="text-gray-500 mt-0.5">{summary.critical} critical zones found. Enable Auto-Block or manually block zones to protect your ad spend.</p>
          </div>
        </div>
      )}
    </div>
  );
}
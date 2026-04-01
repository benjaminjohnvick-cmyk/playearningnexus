import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Play, Pause, RefreshCw, TrendingUp, TrendingDown, DollarSign, Target, Loader2, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function calcMetrics(ad) {
  const spent = ad.total_spent || 0;
  const budget = ad.budget_limit || 100;
  const completions = ad.surveys_completed || 0;
  const clicks = ad.total_clicks || 0;
  const roi = spent > 0 ? (completions * (ad.bid_amount || 0.4)) / spent : 0;
  const ctr = clicks > 0 ? (completions / clicks) * 100 : 0;
  const budgetLeft = Math.max(0, budget - spent);
  const budgetUsedPct = budget > 0 ? (spent / budget) * 100 : 0;
  return { spent, budget, completions, clicks, roi, ctr, budgetLeft, budgetUsedPct };
}

function AdPacerRow({ ad, metrics, allocation, isHigh }) {
  const pct = Math.min(100, metrics.budgetUsedPct);
  return (
    <div className={`border rounded-xl p-3 ${isHigh ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {isHigh ? <TrendingUp className="w-3.5 h-3.5 text-green-400 flex-shrink-0" /> : <TrendingDown className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
          <p className="text-white font-bold text-xs truncate">{ad.brand_name}</p>
          <Badge className={`text-[10px] border flex-shrink-0 ${isHigh ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
            ROI {metrics.roi.toFixed(2)}x
          </Badge>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 text-xs">
          <span className="text-gray-400">Budget: <span className="text-white font-bold">${metrics.budget.toFixed(2)}</span></span>
          {allocation !== 0 && (
            <span className={`font-black ${allocation > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {allocation > 0 ? '+' : ''}${allocation.toFixed(2)}
            </span>
          )}
        </div>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${isHigh ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-gray-600 mt-1">
        <span>${metrics.spent.toFixed(2)} spent</span>
        <span>${metrics.budgetLeft.toFixed(2)} left</span>
      </div>
    </div>
  );
}

export default function AdDailyBudgetPacer({ ads, onRefresh }) {
  const [roiThreshold, setRoiThreshold] = useState(1.0);
  const [shiftPct, setShiftPct] = useState(25);
  const [autoRun, setAutoRun] = useState(false);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const [plan, setPlan] = useState(null);
  const [cycleCount, setCycleCount] = useState(0);
  const intervalRef = useRef(null);

  const addLog = (msg, type = 'info') => setLog(p => [{ msg, type, t: new Date().toLocaleTimeString() }, ...p.slice(0, 24)]);

  const metricsMap = ads.reduce((m, a) => { m[a.id] = calcMetrics(a); return m; }, {});
  const activeAds = ads.filter(a => a.status === 'active');
  const highPerformers = activeAds.filter(a => metricsMap[a.id].roi >= roiThreshold);
  const lowPerformers = activeAds.filter(a => metricsMap[a.id].roi < roiThreshold && metricsMap[a.id].budgetLeft > 2);

  const buildPlan = () => {
    const moves = [];
    let pool = 0;
    lowPerformers.forEach(ad => {
      const m = metricsMap[ad.id];
      const take = parseFloat((m.budgetLeft * shiftPct / 100).toFixed(2));
      if (take >= 0.5) { moves.push({ adId: ad.id, brand: ad.brand_name, direction: 'reduce', amount: take, newBudget: m.budget - take }); pool += take; }
    });
    if (highPerformers.length > 0 && pool > 0) {
      const totalROI = highPerformers.reduce((s, a) => s + metricsMap[a.id].roi, 0);
      highPerformers.forEach(ad => {
        const share = metricsMap[ad.id].roi / totalROI;
        const boost = parseFloat((pool * share).toFixed(2));
        if (boost >= 0.5) moves.push({ adId: ad.id, brand: ad.brand_name, direction: 'boost', amount: boost, newBudget: metricsMap[ad.id].budget + boost });
      });
    }
    return { moves, pool };
  };

  const execute = async () => {
    const { moves, pool } = buildPlan();
    if (moves.length === 0) { addLog('Portfolio balanced — no reallocation needed.', 'success'); return; }
    setRunning(true);
    addLog(`Cycle ${cycleCount + 1}: redistributing $${pool.toFixed(2)} across ${moves.length} ads...`, 'info');
    for (const m of moves) {
      await base44.entities.AdListing.update(m.adId, { budget_limit: parseFloat(m.newBudget.toFixed(2)) });
      addLog(`${m.direction === 'boost' ? '🚀' : '📉'} ${m.brand}: ${m.direction === 'boost' ? '+' : '-'}$${m.amount} → $${m.newBudget.toFixed(2)}`, m.direction === 'boost' ? 'success' : 'warn');
    }
    setCycleCount(p => p + 1);
    setRunning(false);
    onRefresh?.();
  };

  useEffect(() => {
    clearInterval(intervalRef.current);
    if (autoRun) {
      addLog('Auto-pacing enabled — running every 30s', 'info');
      intervalRef.current = setInterval(execute, 30000);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRun, ads, roiThreshold, shiftPct]);

  const chartData = activeAds.map(a => ({
    name: a.brand_name.slice(0, 10),
    roi: parseFloat(metricsMap[a.id].roi.toFixed(2)),
    budget: metricsMap[a.id].budgetLeft,
  }));

  const logColors = { info: 'text-gray-400', success: 'text-green-400', warn: 'text-yellow-400' };

  const currentPlan = buildPlan();
  const allocationMap = currentPlan.moves.reduce((m, mv) => { m[mv.adId] = mv.direction === 'boost' ? mv.amount : -mv.amount; return m; }, {});

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pacing Parameters</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400 font-bold block mb-1">ROI Threshold <span className="text-gray-600">(below = low-performer)</span></label>
            <div className="flex items-center gap-2">
              <input type="range" min="0.3" max="3" step="0.1" value={roiThreshold} onChange={e => setRoiThreshold(parseFloat(e.target.value))} className="flex-1 accent-yellow-500" />
              <span className="text-yellow-400 font-black text-sm w-10">{roiThreshold}x</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 font-bold block mb-1">Daily Shift % <span className="text-gray-600">(from low-performers)</span></label>
            <div className="flex items-center gap-2">
              <input type="range" min="5" max="60" step="5" value={shiftPct} onChange={e => setShiftPct(parseInt(e.target.value))} className="flex-1 accent-orange-500" />
              <span className="text-orange-400 font-black text-sm w-10">{shiftPct}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-green-400">{highPerformers.length}</p>
          <p className="text-gray-500 text-xs">High Performers</p>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-red-400">{lowPerformers.length}</p>
          <p className="text-gray-500 text-xs">Low Performers</p>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-yellow-400">${currentPlan.pool.toFixed(2)}</p>
          <p className="text-gray-500 text-xs">Available to Shift</p>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-blue-400">{cycleCount}</p>
          <p className="text-gray-500 text-xs">Cycles Run</p>
        </div>
      </div>

      {/* ROI chart */}
      {chartData.length > 0 && (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Campaign ROI vs. Budget Remaining</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="roi" fill="#eab308" name="ROI (x)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="budget" fill="#3b82f6" name="Budget Left ($)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Ad rows */}
      {activeAds.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Campaign Allocation Preview</p>
          {activeAds.map(ad => (
            <AdPacerRow key={ad.id} ad={ad} metrics={metricsMap[ad.id]}
              allocation={allocationMap[ad.id] || 0}
              isHigh={metricsMap[ad.id].roi >= roiThreshold} />
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-600 text-sm py-8">No active ads. Launch a campaign to enable pacing.</p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 items-center">
        <Button onClick={execute} disabled={running || activeAds.length === 0}
          className="bg-orange-600 hover:bg-orange-500 text-white font-black gap-2">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {running ? 'Pacing...' : 'Run Pacing Cycle'}
        </Button>
        <button onClick={() => setAutoRun(p => !p)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all ${autoRun ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
          <RefreshCw className={`w-3 h-3 ${autoRun ? 'animate-spin' : ''}`} />
          Auto-Pace {autoRun ? 'ON (30s)' : 'OFF'}
        </button>
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4">
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Pacing Log</p>
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {log.map((e, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <span className="text-gray-700 font-mono flex-shrink-0">{e.t}</span>
                <span className={logColors[e.type]}>{e.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
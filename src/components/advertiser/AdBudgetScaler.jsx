import React, { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, TrendingUp, TrendingDown, Zap, Loader2,
  Play, Pause, RefreshCw, AlertTriangle, CheckCircle2, DollarSign, Target
} from 'lucide-react';

function calcAdROI(ad) {
  const spent = ad.total_spent || 0;
  const completions = ad.surveys_completed || 0;
  const clicks = ad.total_clicks || 0;
  const ctr = clicks > 0 ? (completions / clicks) * 100 : 0;
  const cpc = clicks > 0 ? spent / clicks : 0;
  const roi = spent > 0 ? (completions * ad.bid_amount) / spent : 0;
  const budgetUsed = ad.budget_limit > 0 ? (spent / ad.budget_limit) * 100 : 0;
  const budgetLeft = (ad.budget_limit || 100) - spent;
  return { spent, completions, clicks, ctr, cpc, roi, budgetUsed, budgetLeft };
}

function AdScalerRow({ ad, metrics, roiThreshold, classification, scalingAmount, onTransfer }) {
  const isHigh = classification === 'high';
  const isLow = classification === 'low';

  return (
    <div className={`border rounded-xl p-4 transition-all ${
      isHigh ? 'border-green-500/30 bg-green-500/5' :
      isLow ? 'border-red-500/30 bg-red-500/5' :
      'border-gray-700 bg-gray-900'
    }`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-white font-black text-sm truncate">{ad.brand_name}</p>
            <Badge className={`text-[10px] border flex-shrink-0 ${
              isHigh ? 'bg-green-500/10 text-green-300 border-green-500/20' :
              isLow ? 'bg-red-500/10 text-red-300 border-red-500/20' :
              'bg-gray-700 text-gray-400 border-gray-600'
            }`}>
              {isHigh ? '🚀 High Performer' : isLow ? '📉 Underperformer' : '⚖️ Average'}
            </Badge>
            <Badge className={`text-[10px] border flex-shrink-0 ${
              ad.status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-gray-700 text-gray-400 border-gray-600'
            }`}>
              {ad.status}
            </Badge>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-2">
            <div className="text-center">
              <p className="text-white font-black text-sm">{metrics.roi.toFixed(2)}x</p>
              <p className="text-gray-600 text-[10px]">ROI</p>
            </div>
            <div className="text-center">
              <p className="text-blue-400 font-black text-sm">{metrics.ctr.toFixed(1)}%</p>
              <p className="text-gray-600 text-[10px]">CTR</p>
            </div>
            <div className="text-center">
              <p className="text-yellow-400 font-black text-sm">${metrics.spent.toFixed(2)}</p>
              <p className="text-gray-600 text-[10px]">Spent</p>
            </div>
            <div className="text-center">
              <p className="text-purple-400 font-black text-sm">{metrics.completions}</p>
              <p className="text-gray-600 text-[10px]">Surveys</p>
            </div>
            <div className="text-center">
              <p className="text-orange-400 font-black text-sm">${metrics.budgetLeft.toFixed(2)}</p>
              <p className="text-gray-600 text-[10px]">Budget Left</p>
            </div>
            <div className="text-center">
              <p className={`font-black text-sm ${metrics.roi >= roiThreshold ? 'text-green-400' : 'text-red-400'}`}>
                {metrics.roi >= roiThreshold ? '✓' : '✗'} {(roiThreshold)}x
              </p>
              <p className="text-gray-600 text-[10px]">Target ROI</p>
            </div>
          </div>
        </div>
        {isHigh && scalingAmount > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-green-400 text-xs font-bold">+${scalingAmount.toFixed(2)}</span>
            <ArrowRight className="w-4 h-4 text-green-400" />
          </div>
        )}
        {isLow && scalingAmount > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <ArrowRight className="w-4 h-4 text-red-400" />
            <span className="text-red-400 text-xs font-bold">-${scalingAmount.toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdBudgetScaler({ ads, adBalance, onRefresh }) {
  const [roiThreshold, setRoiThreshold] = useState(1.2);
  const [shiftPct, setShiftPct] = useState(20);
  const [minBudgetLeft, setMinBudgetLeft] = useState(5);
  const [running, setRunning] = useState(false);
  const [scaling, setScaling] = useState(false);
  const [log, setLog] = useState([]);
  const [lastRun, setLastRun] = useState(null);
  const [preview, setPreview] = useState(null);

  const addLog = (msg, type = 'info') =>
    setLog(prev => [{ msg, type, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 29)]);

  const metricsMap = ads.reduce((m, ad) => { m[ad.id] = calcAdROI(ad); return m; }, {});

  const highPerformers = ads.filter(a =>
    a.status === 'active' && metricsMap[a.id].roi >= roiThreshold && metricsMap[a.id].budgetLeft < a.budget_limit * 0.3
  );
  const underPerformers = ads.filter(a =>
    a.status === 'active' && metricsMap[a.id].roi < roiThreshold && metricsMap[a.id].budgetLeft > minBudgetLeft
  );

  const buildScalingPlan = useCallback(() => {
    const plan = [];
    let totalFreed = 0;

    // Calculate funds to free from underperformers
    underPerformers.forEach(ad => {
      const metrics = metricsMap[ad.id];
      const shift = parseFloat((metrics.budgetLeft * (shiftPct / 100)).toFixed(2));
      if (shift >= 0.5) {
        plan.push({ adId: ad.id, brand: ad.brand_name, direction: 'reduce', amount: shift, newBudget: ad.budget_limit - shift });
        totalFreed += shift;
      }
    });

    // Distribute freed funds to high performers proportionally by ROI
    if (highPerformers.length > 0 && totalFreed > 0) {
      const totalROI = highPerformers.reduce((s, a) => s + metricsMap[a.id].roi, 0);
      highPerformers.forEach(ad => {
        const roiShare = metricsMap[ad.id].roi / totalROI;
        const boost = parseFloat((totalFreed * roiShare).toFixed(2));
        if (boost >= 0.5) {
          plan.push({ adId: ad.id, brand: ad.brand_name, direction: 'increase', amount: boost, newBudget: ad.budget_limit + boost });
        }
      });
    }

    return { plan, totalFreed };
  }, [ads, roiThreshold, shiftPct, minBudgetLeft]);

  const handlePreview = () => {
    const result = buildScalingPlan();
    setPreview(result);
  };

  const handleExecute = async () => {
    if (!preview) return;
    setScaling(true);
    addLog(`Executing budget scaling — ${preview.plan.length} adjustments...`, 'info');

    for (const action of preview.plan) {
      await base44.entities.AdListing.update(action.adId, { budget_limit: parseFloat(action.newBudget.toFixed(2)) });
      const sign = action.direction === 'increase' ? '+' : '-';
      addLog(`${action.direction === 'increase' ? '🚀' : '📉'} "${action.brand}": budget ${sign}$${action.amount} → $${action.newBudget.toFixed(2)}`, action.direction === 'increase' ? 'success' : 'warn');
    }

    setScaling(false);
    setPreview(null);
    setLastRun(new Date().toLocaleTimeString());
    addLog(`Scaling complete. $${preview.totalFreed.toFixed(2)} reallocated.`, 'success');
    onRefresh?.();
  };

  const logColor = { info: 'text-gray-400', success: 'text-green-400', warn: 'text-yellow-400', error: 'text-red-400' };

  const totalBudget = ads.reduce((s, a) => s + (a.budget_limit || 0), 0);
  const avgROI = ads.length > 0 ? ads.reduce((s, a) => s + metricsMap[a.id].roi, 0) / ads.length : 0;

  return (
    <div className="space-y-5">

      {/* Config */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Scaling Parameters</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-400 font-bold block mb-1">
              Target ROI Threshold
              <span className="text-gray-600 font-normal ml-1">(ads below = underperforming)</span>
            </label>
            <div className="flex items-center gap-2">
              <input type="range" min="0.5" max="3" step="0.1" value={roiThreshold}
                onChange={e => setRoiThreshold(parseFloat(e.target.value))}
                className="flex-1 accent-yellow-500" />
              <span className="text-yellow-400 font-black text-sm w-10">{roiThreshold}x</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 font-bold block mb-1">
              Budget Shift %
              <span className="text-gray-600 font-normal ml-1">(% of underperformer budget to move)</span>
            </label>
            <div className="flex items-center gap-2">
              <input type="range" min="5" max="50" step="5" value={shiftPct}
                onChange={e => setShiftPct(parseInt(e.target.value))}
                className="flex-1 accent-orange-500" />
              <span className="text-orange-400 font-black text-sm w-10">{shiftPct}%</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 font-bold block mb-1">
              Min Budget Floor $
              <span className="text-gray-600 font-normal ml-1">(don't pull below this)</span>
            </label>
            <div className="flex items-center gap-2">
              <input type="range" min="1" max="30" step="1" value={minBudgetLeft}
                onChange={e => setMinBudgetLeft(parseInt(e.target.value))}
                className="flex-1 accent-blue-500" />
              <span className="text-blue-400 font-black text-sm w-10">${minBudgetLeft}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Portfolio overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-white">{ads.length}</p>
          <p className="text-gray-500 text-xs">Total Ads</p>
        </div>
        <div className="bg-gray-900 border border-green-500/20 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-green-400">{highPerformers.length}</p>
          <p className="text-gray-500 text-xs">High Performers</p>
        </div>
        <div className="bg-gray-900 border border-red-500/20 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-red-400">{underPerformers.length}</p>
          <p className="text-gray-500 text-xs">Underperformers</p>
        </div>
        <div className="bg-gray-900 border border-yellow-500/20 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-yellow-400">{avgROI.toFixed(2)}x</p>
          <p className="text-gray-500 text-xs">Portfolio Avg ROI</p>
        </div>
      </div>

      {/* Ads classification */}
      {ads.length === 0 ? (
        <div className="text-center py-10 text-gray-600 text-sm">No ads to analyze. Submit your first ad to use budget scaling.</div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Campaign Classification</p>
          {ads.filter(a => a.status === 'active').map(ad => {
            const metrics = metricsMap[ad.id];
            const classification = metrics.roi >= roiThreshold && metrics.budgetLeft < ad.budget_limit * 0.3 ? 'high'
              : metrics.roi < roiThreshold && metrics.budgetLeft > minBudgetLeft ? 'low' : 'neutral';
            const planItem = preview?.plan.find(p => p.adId === ad.id);
            return (
              <AdScalerRow key={ad.id} ad={ad} metrics={metrics} roiThreshold={roiThreshold}
                classification={classification} scalingAmount={planItem?.amount || 0} />
            );
          })}
          {ads.filter(a => a.status !== 'active').map(ad => (
            <AdScalerRow key={ad.id} ad={ad} metrics={metricsMap[ad.id]} roiThreshold={roiThreshold}
              classification="neutral" scalingAmount={0} />
          ))}
        </div>
      )}

      {/* Preview panel */}
      {preview && preview.plan.length > 0 && (
        <div className="bg-gray-900 border border-yellow-500/20 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
            Scaling Preview — ${preview.totalFreed.toFixed(2)} to be reallocated
          </p>
          <div className="space-y-1.5">
            {preview.plan.map((action, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {action.direction === 'increase'
                  ? <TrendingUp className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  : <TrendingDown className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                <span className={action.direction === 'increase' ? 'text-green-300' : 'text-red-300'}>
                  {action.brand}
                </span>
                <span className="text-gray-600">budget →</span>
                <span className="text-white font-bold">${action.newBudget.toFixed(2)}</span>
                <Badge className={`text-[10px] border ml-auto ${action.direction === 'increase' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                  {action.direction === 'increase' ? '+' : '-'}${action.amount}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {preview?.plan.length === 0 && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex items-center gap-2 text-sm text-gray-400">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          Portfolio is balanced — no reallocation needed at current threshold.
        </div>
      )}

      {/* Action buttons */}
      {ads.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handlePreview} variant="outline" className="border-gray-600 text-gray-200 gap-2">
            <Target className="w-4 h-4" /> Preview Scaling Plan
          </Button>
          <Button onClick={handleExecute} disabled={scaling || !preview || preview.plan.length === 0}
            className="bg-orange-600 hover:bg-orange-500 text-white font-black gap-2">
            {scaling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {scaling ? 'Executing...' : 'Execute Reallocation'}
          </Button>
          {lastRun && <span className="text-gray-600 text-xs self-center">Last run: {lastRun}</span>}
        </div>
      )}

      {/* Activity log */}
      {log.length > 0 && (
        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4">
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">Activity Log</p>
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {log.map((entry, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <span className="text-gray-600 flex-shrink-0 font-mono">{entry.time}</span>
                <span className={logColor[entry.type]}>{entry.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
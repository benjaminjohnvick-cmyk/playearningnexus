import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, Zap, TrendingUp, TrendingDown, ArrowRight, Loader2, CheckCircle, Info } from 'lucide-react';
import { toast } from 'sonner';

function computeROI(ad) {
  const spent = ad.total_spent || 0;
  const completed = ad.surveys_completed || 0;
  if (spent === 0) return completed > 0 ? 999 : 0;
  return (completed / spent) * 100;
}

function suggestReallocation(ads) {
  const active = ads.filter(a => a.status === 'active' && (a.budget_limit || 0) > 0);
  if (active.length < 2) return null;

  const withROI = active.map(ad => ({ ...ad, roi: computeROI(ad) }));
  const sorted = [...withROI].sort((a, b) => b.roi - a.roi);

  const totalBudget = sorted.reduce((s, a) => s + (a.budget_limit || 0), 0);
  const avgROI = sorted.reduce((s, a) => s + a.roi, 0) / sorted.length;

  // Weighted allocation: high ROI ads get proportionally more budget
  const roiSum = sorted.reduce((s, a) => s + Math.max(a.roi, 0.1), 0);
  const allocations = sorted.map(ad => ({
    ...ad,
    newBudget: Math.round((Math.max(ad.roi, 0.1) / roiSum) * totalBudget * 100) / 100,
    delta: Math.round(((Math.max(ad.roi, 0.1) / roiSum) * totalBudget - (ad.budget_limit || 0)) * 100) / 100,
  }));

  return { allocations, totalBudget, avgROI };
}

export default function AdBudgetOptimizer({ ads, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(false);
  const [preview, setPreview] = useState(null);

  const activeAds = ads.filter(a => a.status === 'active');
  const suggestion = preview || suggestReallocation(ads);

  const handlePreview = () => {
    const result = suggestReallocation(ads);
    setPreview(result);
    setApplied(false);
  };

  const handleApply = async () => {
    if (!suggestion) return;
    setLoading(true);
    await Promise.all(
      suggestion.allocations.map(ad =>
        base44.entities.AdListing.update(ad.id, { budget_limit: ad.newBudget })
      )
    );
    setApplied(true);
    setLoading(false);
    onRefresh();
    toast.success('Budget reallocated — high-ROI ads now receive more budget');
  };

  if (activeAds.length < 2) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 text-center">
        <Brain className="w-10 h-10 text-gray-600 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">You need at least 2 active ads to use the budget optimizer.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-purple-500/20 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
            <Brain className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">ML Budget Optimizer</h3>
            <p className="text-gray-500 text-xs">Auto-shifts daily budget to highest-ROI campaigns</p>
          </div>
        </div>
        <Badge className="bg-purple-500/20 border-purple-500/30 text-purple-300 text-xs">Beta</Badge>
      </div>

      <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        The model calculates ROI (surveys per dollar) for each ad and reallocates your total budget proportionally — more money to what's working, less to what's not.
      </div>

      {/* Current ad performance */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Current Allocation</p>
        {activeAds.map(ad => {
          const roi = computeROI(ad);
          const totalBudget = activeAds.reduce((s, a) => s + (a.budget_limit || 0), 0);
          const share = totalBudget > 0 ? ((ad.budget_limit || 0) / totalBudget * 100).toFixed(0) : 0;
          return (
            <div key={ad.id} className="flex items-center gap-3 bg-gray-800/50 rounded-xl px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold text-sm truncate">{ad.brand_name}</span>
                  <span className="text-gray-500 text-xs">{roi.toFixed(1)} ROI</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${share}%` }} />
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-white font-black text-sm">${(ad.budget_limit || 0).toFixed(0)}</p>
                <p className="text-gray-600 text-[10px]">{share}%</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Suggested reallocation */}
      {suggestion && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-yellow-400" /> Suggested Reallocation
          </p>
          {suggestion.allocations.map(ad => (
            <div key={ad.id} className="flex items-center gap-3 bg-gray-800/50 rounded-xl px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-bold text-sm truncate">{ad.brand_name}</span>
                  {ad.delta > 0 ? (
                    <span className="text-green-400 text-xs flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3" />+${ad.delta.toFixed(0)}
                    </span>
                  ) : ad.delta < 0 ? (
                    <span className="text-red-400 text-xs flex items-center gap-0.5">
                      <TrendingDown className="w-3 h-3" />${ad.delta.toFixed(0)}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                  <span>${(ad.budget_limit || 0).toFixed(0)}</span>
                  <ArrowRight className="w-3 h-3" />
                  <span className="text-white font-bold">${ad.newBudget.toFixed(0)}</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-purple-300 text-xs">{ad.roi.toFixed(1)} ROI</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={handlePreview}
          variant="outline"
          className="border-gray-600 text-gray-300 hover:bg-gray-700 text-xs gap-1 flex-1"
        >
          <Brain className="w-3.5 h-3.5" /> Preview Optimization
        </Button>
        {suggestion && !applied && (
          <Button
            onClick={handleApply}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-500 text-white font-black text-xs gap-1 flex-1"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Apply Now
          </Button>
        )}
        {applied && (
          <span className="flex items-center gap-1.5 text-green-400 text-xs font-bold px-3">
            <CheckCircle className="w-4 h-4" /> Applied!
          </span>
        )}
      </div>
    </div>
  );
}
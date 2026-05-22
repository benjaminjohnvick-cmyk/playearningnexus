import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Pause, Zap, Loader2, RefreshCw, DollarSign, BarChart2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ROASBiddingPanel({ campaignId }) {
  const [loading, setLoading] = useState(false);
  const [dryRunning, setDryRunning] = useState(false);
  const [result, setResult] = useState(null);

  const run = async (dry_run = false) => {
    if (dry_run) setDryRunning(true);
    else setLoading(true);
    try {
      const res = await base44.functions.invoke('roasBiddingEngine', {
        campaign_id: campaignId || undefined,
        dry_run,
      });
      setResult(res.data);
      if (!dry_run) toast.success(`${res.data.actions_taken} bid/budget adjustments applied`);
      else toast.info('Preview complete — no changes made');
    } catch (e) {
      toast.error('Bidding engine failed: ' + e.message);
    }
    setLoading(false);
    setDryRunning(false);
  };

  const actionIcon = (action) => {
    if (action === 'pause') return <Pause className="w-4 h-4 text-red-500" />;
    if (action === 'increase_budget' || action === 'increase_bid') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (action === 'decrease_budget' || action === 'decrease_bid') return <TrendingDown className="w-4 h-4 text-yellow-500" />;
    return <CheckCircle className="w-4 h-4 text-gray-400" />;
  };

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-black text-sm text-gray-900">AI ROAS Bidding Engine</p>
            <p className="text-xs text-gray-500">Auto-optimizes budgets & bids based on return-on-ad-spend</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => run(true)} disabled={dryRunning} className="gap-1">
            {dryRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <BarChart2 className="w-3 h-3" />}
            Preview
          </Button>
          <Button size="sm" onClick={() => run(false)} disabled={loading}
            className="bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold gap-1">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            {loading ? 'Optimizing…' : 'Optimize Now'}
          </Button>
        </div>
      </div>

      {!result && (
        <div className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200 rounded-2xl p-6 text-center">
          <Zap className="w-10 h-10 text-orange-600 mx-auto mb-3" />
          <p className="font-black text-gray-900 mb-1">Smart ROAS Optimization</p>
          <p className="text-sm text-gray-600">Monitors real-time campaign performance, pauses underperforming ads, and pivots budgets to high-converting creatives automatically.</p>
        </div>
      )}

      {result && (
        <>
          {/* Summary stat */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border-2 border-orange-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-orange-600">{result.actions_taken || 0}</p>
              <p className="text-xs text-gray-500">Actions Applied</p>
            </div>
            <div className="bg-white border-2 border-green-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-green-600">+{result.projected_roas_improvement || 0}%</p>
              <p className="text-xs text-gray-500">ROAS Lift Est.</p>
            </div>
            <div className="bg-white border-2 border-blue-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-blue-600">{result.dry_run ? 'Preview' : 'Live'}</p>
              <p className="text-xs text-gray-500">Mode</p>
            </div>
          </div>

          {/* Insights */}
          {result.overall_insights && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-900">
              <p className="font-bold mb-1">📊 AI Insights</p>
              <p>{result.overall_insights}</p>
            </div>
          )}

          {/* Campaign actions */}
          {result.campaign_actions?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Campaign Adjustments</p>
              <div className="space-y-2">
                {result.campaign_actions.map((a, i) => (
                  <div key={i} className="bg-white border rounded-xl p-3 flex items-center gap-3">
                    {actionIcon(a.action)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{a.campaign_name}</p>
                      <p className="text-xs text-gray-500">{a.reasoning}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <Badge className={`text-xs ${a.action === 'pause' ? 'bg-red-100 text-red-700' : a.action === 'increase_budget' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {a.action === 'pause' ? 'Paused' : `Budget: $${a.new_budget}`}
                      </Badge>
                      <p className="text-xs text-gray-400 mt-0.5">ROAS: {a.current_roas}x</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ad bid actions */}
          {result.ad_actions?.filter(a => a.action !== 'maintain').length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Ad Bid Adjustments</p>
              <div className="space-y-2">
                {result.ad_actions.filter(a => a.action !== 'maintain').map((a, i) => (
                  <div key={i} className="bg-white border rounded-xl p-3 flex items-center gap-3">
                    {actionIcon(a.action)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-gray-900 truncate">{a.ad_name}</p>
                        {a.is_top_performer && <Badge className="bg-yellow-100 text-yellow-700 text-xs">⭐ Top</Badge>}
                      </div>
                      <p className="text-xs text-gray-500">{a.reasoning}</p>
                    </div>
                    <Badge className={`text-xs flex-shrink-0 ${a.action === 'pause' ? 'bg-red-100 text-red-700' : a.action === 'increase_bid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {a.action === 'pause' ? 'Paused' : `$${a.new_bid?.toFixed(2)} bid`}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Budget pivot */}
          {result.budget_pivot?.pivot_amount > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs font-bold text-blue-700 mb-1">💸 Budget Pivot</p>
              <p className="text-sm text-blue-900">Moved <strong>${result.budget_pivot.pivot_amount}</strong> from underperforming campaigns to top performer. {result.budget_pivot.reasoning}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
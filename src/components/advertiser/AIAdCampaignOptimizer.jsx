import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Loader2, TrendingUp, DollarSign, Zap, BarChart2, Target, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { toast } from 'sonner';

const actionConfig = {
  scale_up: { label: 'Scale Up', icon: ArrowUp, color: 'text-green-600 bg-green-50 border-green-200' },
  maintain: { label: 'Maintain', icon: Minus, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  pause: { label: 'Pause', icon: ArrowDown, color: 'text-red-600 bg-red-50 border-red-200' },
  optimize: { label: 'Optimize', icon: Zap, color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
};

export default function AIAdCampaignOptimizer() {
  const [targetROI, setTargetROI] = useState(150);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [phase, setPhase] = useState('setup'); // setup | results

  const runOptimization = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('aiAdCampaignOptimizer', {
        action: 'analyze',
        target_roi: targetROI,
      });
      setData(res.data);
      setPhase('results');
      toast.success('Budget reallocated automatically by AI!');
    } catch (e) {
      toast.error(e.message);
    }
    setLoading(false);
  };

  const opt = data?.optimization;
  const projectedROI = opt?.projected_total_roi || 0;
  const roiColor = projectedROI >= targetROI ? 'text-green-600' : 'text-red-600';

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="w-5 h-5 text-orange-600" />
          AI Ad Campaign Optimizer
          <Badge className="bg-orange-100 text-orange-700 ml-auto">Real-Time Reallocation</Badge>
        </CardTitle>
        <p className="text-xs text-gray-500">Set your target ROI and AI automatically reallocates budget to maximize conversions.</p>
      </CardHeader>
      <CardContent className="space-y-4">

        {phase === 'setup' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { emoji: '🎯', title: 'Set ROI Target', desc: 'Define your minimum acceptable ROI' },
                { emoji: '🤖', title: 'AI Analyzes', desc: 'Scans all creative performance data' },
                { emoji: '⚡', title: 'Auto Reallocates', desc: 'Shifts budget to top performers instantly' },
              ].map(i => (
                <div key={i.title} className="p-3 bg-orange-50 rounded-xl border border-orange-100 text-xs">
                  <p className="text-xl mb-1">{i.emoji}</p>
                  <p className="font-bold text-orange-700">{i.title}</p>
                  <p className="text-gray-500 mt-0.5">{i.desc}</p>
                </div>
              ))}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Target ROI (%)</label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  value={targetROI}
                  onChange={e => setTargetROI(Number(e.target.value))}
                  className="w-32"
                  min={50}
                  max={500}
                />
                <div className="flex gap-2">
                  {[100, 150, 200, 300].map(v => (
                    <button
                      key={v}
                      onClick={() => setTargetROI(v)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${targetROI === v ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-orange-50'}`}
                    >
                      {v}%
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Ads below this ROI threshold will be paused and budget shifted to winners.</p>
            </div>

            <Button className="w-full bg-gradient-to-r from-orange-600 to-red-600 h-11" onClick={runOptimization} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
              {loading ? 'AI Optimizing Budgets...' : 'Run AI Optimization Now'}
            </Button>
          </div>
        )}

        {phase === 'results' && opt && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="p-4 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl text-white">
              <p className="text-xs text-slate-400 mb-1">Optimization Summary</p>
              <p className="text-sm mb-3">{opt.summary}</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className={`text-xl font-black ${roiColor.replace('text-', 'text-')}`}>{projectedROI}%</p>
                  <p className="text-[10px] text-slate-400">Projected ROI</p>
                </div>
                <div>
                  <p className="text-xl font-black text-white">{opt.confidence_score}/100</p>
                  <p className="text-[10px] text-slate-400">Confidence</p>
                </div>
                <div>
                  <p className="text-xl font-black text-green-400">{(opt.budget_allocations || []).filter(a => a.action === 'scale_up').length}</p>
                  <p className="text-[10px] text-slate-400">Scaled Up</p>
                </div>
              </div>
            </div>

            {/* Budget Allocations */}
            {opt.budget_allocations?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-700 mb-2">💰 Budget Reallocation (Auto-Applied)</p>
                <div className="space-y-2">
                  {opt.budget_allocations.map((alloc, i) => {
                    const cfg = actionConfig[alloc.action] || actionConfig.maintain;
                    const Icon = cfg.icon;
                    return (
                      <div key={i} className={`p-2.5 rounded-lg border text-xs ${cfg.color}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <Icon className="w-3.5 h-3.5" />
                            <span className="font-bold truncate max-w-[120px]">{alloc.title}</span>
                            <Badge className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
                          </div>
                          <div className="text-right">
                            <span className="font-black">${alloc.recommended_budget}</span>
                            <span className="text-[10px] ml-1">({alloc.budget_change_pct > 0 ? '+' : ''}{alloc.budget_change_pct}%)</span>
                          </div>
                        </div>
                        <div className="flex gap-3 text-[10px] opacity-80">
                          <span>Predicted ROI: {alloc.predicted_roi}%</span>
                          <span>Conversions: {alloc.predicted_conversions}</span>
                        </div>
                        <p className="text-[10px] mt-0.5 opacity-70">{alloc.reasoning}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Creative recommendations */}
            {opt.creative_recommendations?.length > 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                <p className="text-xs font-bold text-yellow-700 mb-1">✏️ Creative Improvements</p>
                {opt.creative_recommendations.map((c, i) => (
                  <div key={i} className="mb-1 text-xs text-yellow-600">
                    <span className="font-medium">→ {c.issue}:</span> {c.fix}
                  </div>
                ))}
              </div>
            )}

            {/* Top segments */}
            {opt.top_performing_segments?.length > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-xs font-bold text-blue-700 mb-1">👥 Top Performing Segments</p>
                <div className="flex flex-wrap gap-1">
                  {opt.top_performing_segments.map((s, i) => (
                    <Badge key={i} className="text-[10px] bg-white text-blue-700 border border-blue-200">{s}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPhase('setup')}>
                Change Target
              </Button>
              <Button className="flex-1 bg-gradient-to-r from-orange-600 to-red-600" onClick={runOptimization} disabled={loading}>
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Zap className="w-3.5 h-3.5 mr-1" />}
                Re-Optimize
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
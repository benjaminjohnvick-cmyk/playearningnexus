import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Zap, Loader2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

const STRATEGIES = [
  { id: 'manual_cpc', label: 'Manual CPC', desc: 'Set your own bid per click' },
  { id: 'auto_maximize_clicks', label: 'Maximize Clicks', desc: 'AI maximizes click volume' },
  { id: 'target_cpa', label: 'Target CPA', desc: 'AI hits your cost-per-acquisition goal' },
  { id: 'target_roas', label: 'Target ROAS', desc: 'AI maximizes return on ad spend' }
];

export default function BiddingAssistant({ campaigns, selectedCampaign, onSelectCampaign, onRefresh }) {
  const [localSelected, setLocalSelected] = useState(selectedCampaign || campaigns[0]);
  const [optimizing, setOptimizing] = useState(false);
  const [result, setResult] = useState(null);
  const [applyingStrategy, setApplyingStrategy] = useState(false);
  const [bidInput, setBidInput] = useState('');

  useEffect(() => {
    if (selectedCampaign) setLocalSelected(selectedCampaign);
    else if (!localSelected && campaigns[0]) setLocalSelected(campaigns[0]);
  }, [selectedCampaign, campaigns]);

  const campaign = localSelected;

  const runOptimization = async () => {
    if (!campaign) return;
    setOptimizing(true);
    setResult(null);
    const res = await base44.functions.invoke('aiCampaignManager', {
      action: 'optimize_bid',
      campaign_id: campaign.id
    });
    setResult(res.data?.optimization);
    // Refresh campaign data
    const updated = await base44.entities.AdCampaign.get(campaign.id);
    setLocalSelected(updated);
    setOptimizing(false);
    onRefresh();
  };

  const applyBidManually = async () => {
    if (!campaign || !bidInput) return;
    setApplyingStrategy(true);
    await base44.entities.AdCampaign.update(campaign.id, {
      bid_amount: parseFloat(bidInput),
      last_optimized_at: new Date().toISOString()
    });
    const updated = await base44.entities.AdCampaign.get(campaign.id);
    setLocalSelected(updated);
    setApplyingStrategy(false);
    onRefresh();
  };

  const updateStrategy = async (strategy) => {
    if (!campaign) return;
    await base44.entities.AdCampaign.update(campaign.id, { bid_strategy: strategy });
    const updated = await base44.entities.AdCampaign.get(campaign.id);
    setLocalSelected(updated);
    onRefresh();
  };

  const toggleAutoBid = async () => {
    if (!campaign) return;
    await base44.entities.AdCampaign.update(campaign.id, { ai_bid_enabled: !campaign.ai_bid_enabled });
    const updated = await base44.entities.AdCampaign.get(campaign.id);
    setLocalSelected(updated);
    onRefresh();
  };

  const alertColor = result?.alert_level === 'critical' ? 'red' : result?.alert_level === 'warning' ? 'yellow' : 'green';

  return (
    <div className="space-y-5">
      {/* Campaign Selector */}
      <div className="flex gap-2 flex-wrap">
        {campaigns.map(c => (
          <button key={c.id}
            onClick={() => setLocalSelected(c)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${localSelected?.id === c.id ? 'bg-purple-600 border-purple-500 text-white' : 'border-slate-700 text-slate-400 bg-slate-800 hover:border-slate-500'}`}>
            {c.name}
          </button>
        ))}
      </div>

      {!campaign ? (
        <div className="text-center py-16 text-slate-500">Select a campaign to manage bidding</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {/* Left: Strategy & Controls */}
          <div className="space-y-5">
            {/* Current Status */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" /> Bid Status
              </h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: 'Current Bid', value: `$${campaign.bid_amount || 0.50}` },
                  { label: 'Budget Left', value: `$${((campaign.budget_total || 0) - (campaign.budget_spent || 0)).toFixed(2)}` },
                  { label: 'Daily Cap', value: `$${campaign.budget_daily || 0}` },
                  { label: 'Last Optimized', value: campaign.last_optimized_at ? new Date(campaign.last_optimized_at).toLocaleDateString() : 'Never' }
                ].map((item, i) => (
                  <div key={i} className="bg-slate-900 rounded-lg p-3">
                    <div className="text-slate-400 text-xs">{item.label}</div>
                    <div className="text-white font-bold text-sm mt-1">{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Auto-bid Toggle */}
              <div
                onClick={toggleAutoBid}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${campaign.ai_bid_enabled ? 'bg-purple-900/30 border-purple-500/40' : 'bg-slate-900 border-slate-600'}`}>
                <div>
                  <div className="text-white text-sm font-medium">AI Auto-Bidding</div>
                  <div className="text-slate-400 text-xs">Automatically optimize bids for best ROI</div>
                </div>
                <div className={`w-10 h-5 rounded-full transition-all ${campaign.ai_bid_enabled ? 'bg-purple-500' : 'bg-slate-600'} relative`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${campaign.ai_bid_enabled ? 'left-5' : 'left-0.5'}`} />
                </div>
              </div>
            </div>

            {/* Bid Strategy */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-3">Bid Strategy</h3>
              <div className="space-y-2">
                {STRATEGIES.map(s => (
                  <button key={s.id}
                    onClick={() => updateStrategy(s.id)}
                    className={`w-full p-3 rounded-lg border text-left transition-all ${campaign.bid_strategy === s.id ? 'border-purple-500 bg-purple-900/30' : 'border-slate-700 bg-slate-900 hover:border-slate-500'}`}>
                    <div className="text-white text-sm font-medium">{s.label}</div>
                    <div className="text-slate-400 text-xs mt-0.5">{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Manual Bid Input */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-3">Manual Bid Override</h3>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Enter bid amount $"
                  value={bidInput}
                  onChange={e => setBidInput(e.target.value)}
                  className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
                  step="0.01"
                />
                <Button onClick={applyBidManually} disabled={applyingStrategy || !bidInput}
                  className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap">
                  {applyingStrategy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                </Button>
              </div>
            </div>
          </div>

          {/* Right: AI Optimization */}
          <div className="space-y-5">
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" /> AI Bid Optimizer
                </h3>
                <Button onClick={runOptimization} disabled={optimizing} size="sm"
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold hover:from-yellow-400">
                  {optimizing ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Analyzing...</> : <><Zap className="w-3 h-3 mr-1" />Run AI</>}
                </Button>
              </div>

              {!result ? (
                <div className="text-center py-10 text-slate-500">
                  <Zap className="w-12 h-12 mx-auto mb-3 text-slate-700" />
                  <p className="text-sm">Click "Run AI" to get intelligent bid recommendations based on your campaign performance</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Alert Level */}
                  <div className={`flex items-center gap-2 p-3 rounded-lg ${alertColor === 'green' ? 'bg-green-900/30 border border-green-500/30' : alertColor === 'yellow' ? 'bg-yellow-900/30 border border-yellow-500/30' : 'bg-red-900/30 border border-red-500/30'}`}>
                    {alertColor === 'green' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <AlertTriangle className={`w-4 h-4 text-${alertColor}-400`} />}
                    <span className={`text-${alertColor}-400 text-sm font-medium`}>Campaign Health: {result.alert_level || 'Good'}</span>
                  </div>

                  {/* Recommendation */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Recommended Bid', value: `$${result.recommended_bid?.toFixed(2)}`, color: 'text-yellow-400' },
                      { label: 'Adjustment', value: `${result.bid_adjustment_pct > 0 ? '+' : ''}${result.bid_adjustment_pct?.toFixed(0)}%`, color: result.bid_adjustment_pct > 0 ? 'text-green-400' : 'text-red-400' },
                      { label: 'Confidence', value: `${result.confidence_score}%`, color: 'text-blue-400' },
                      { label: 'Proj. ROAS', value: `${result.projected_roas?.toFixed(2)}x`, color: 'text-purple-400' }
                    ].map((item, i) => (
                      <div key={i} className="bg-slate-900 rounded-lg p-3">
                        <div className="text-slate-400 text-xs">{item.label}</div>
                        <div className={`font-bold text-sm mt-1 ${item.color}`}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-slate-900 rounded-lg p-3">
                    <div className="text-slate-400 text-xs mb-1">AI Reasoning</div>
                    <div className="text-slate-300 text-xs leading-relaxed">{result.reasoning}</div>
                  </div>

                  <div className="bg-slate-900 rounded-lg p-3">
                    <div className="text-slate-400 text-xs mb-2">Budget Pacing</div>
                    <div className="text-slate-300 text-xs">{result.budget_pacing}</div>
                  </div>

                  {result.action_steps?.length > 0 && (
                    <div className="bg-slate-900 rounded-lg p-3">
                      <div className="text-slate-400 text-xs mb-2">Action Steps</div>
                      {result.action_steps.map((step, i) => (
                        <div key={i} className="text-slate-300 text-xs flex items-start gap-2 mb-1">
                          <span className="text-yellow-400 mt-0.5 flex-shrink-0">{i + 1}.</span> {step}
                        </div>
                      ))}
                    </div>
                  )}

                  {campaign.ai_bid_enabled && (
                    <div className="text-xs text-green-400 text-center bg-green-900/20 py-2 rounded-lg border border-green-500/20">
                      ✓ Auto-bidding is ON — Bid of ${result.recommended_bid?.toFixed(2)} has been auto-applied
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
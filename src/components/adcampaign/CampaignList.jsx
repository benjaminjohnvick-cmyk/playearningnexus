import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, BarChart2, Zap, Trash2, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

const STATUS_COLORS = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  draft: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30'
};

const OBJ_ICONS = {
  brand_awareness: '📣', lead_generation: '🎯', conversions: '💰',
  app_installs: '📲', survey_completions: '📋'
};

export default function CampaignList({ campaigns, isLoading, selectedCampaign, onSelect, onRefresh }) {
  const [updating, setUpdating] = useState(null);
  const queryClient = useQueryClient();

  const toggleStatus = async (campaign) => {
    setUpdating(campaign.id);
    const newStatus = campaign.status === 'active' ? 'paused' : 'active';
    await base44.entities.AdCampaign.update(campaign.id, { status: newStatus });
    queryClient.invalidateQueries(['adCampaigns']);
    setUpdating(null);
  };

  const deleteCampaign = async (id) => {
    if (!confirm('Delete this campaign?')) return;
    await base44.entities.AdCampaign.delete(id);
    queryClient.invalidateQueries(['adCampaigns']);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
    </div>
  );

  if (!campaigns.length) return (
    <div className="text-center py-20 text-slate-500">
      <div className="text-5xl mb-4">📊</div>
      <p className="text-lg font-medium text-slate-400">No campaigns yet</p>
      <p className="text-sm mt-2">Click "New Campaign" to create your first AI-powered ad campaign</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {campaigns.map(campaign => {
        const perf = campaign.performance || {};
        const budget_pct = campaign.budget_total > 0 ? Math.min((campaign.budget_spent || 0) / campaign.budget_total * 100, 100) : 0;
        const isSelected = selectedCampaign?.id === campaign.id;

        return (
          <div
            key={campaign.id}
            onClick={() => onSelect(campaign)}
            className={`bg-slate-800/60 border rounded-xl p-4 cursor-pointer transition-all hover:border-purple-500/50 ${isSelected ? 'border-purple-500 bg-purple-900/20' : 'border-slate-700'}`}
          >
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg">{OBJ_ICONS[campaign.objective] || '📊'}</span>
                  <h3 className="text-white font-semibold truncate">{campaign.name}</h3>
                  <Badge className={`text-xs border ${STATUS_COLORS[campaign.status] || STATUS_COLORS.draft}`}>
                    {campaign.status}
                  </Badge>
                  {campaign.ai_generated && <Badge className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/30">✨ AI</Badge>}
                  {campaign.ai_bid_enabled && <Badge className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/30">⚡ Auto-Bid</Badge>}
                </div>

                {/* Budget Bar */}
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Spend: ${(campaign.budget_spent || 0).toFixed(2)}</span>
                    <span>Budget: ${campaign.budget_total}</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full">
                    <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all" style={{ width: `${budget_pct}%` }} />
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-4 gap-3 text-center min-w-fit">
                {[
                  { label: 'Impr.', value: (perf.impressions || 0).toLocaleString() },
                  { label: 'CTR', value: `${(perf.ctr || 0).toFixed(2)}%` },
                  { label: 'Conv.', value: perf.conversions || 0 },
                  { label: 'ROAS', value: `${(perf.roas || 0).toFixed(1)}x` }
                ].map((m, i) => (
                  <div key={i}>
                    <div className="text-white font-bold text-sm">{m.value}</div>
                    <div className="text-slate-500 text-xs">{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <Button size="icon" variant="ghost"
                  onClick={() => toggleStatus(campaign)}
                  disabled={updating === campaign.id || campaign.status === 'completed'}
                  className={campaign.status === 'active' ? 'text-yellow-400 hover:bg-yellow-400/10' : 'text-green-400 hover:bg-green-400/10'}>
                  {updating === campaign.id ? <Loader2 className="w-4 h-4 animate-spin" /> :
                    campaign.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => onSelect(campaign)} className="text-blue-400 hover:bg-blue-400/10">
                  <BarChart2 className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => deleteCampaign(campaign.id)} className="text-red-400 hover:bg-red-400/10">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
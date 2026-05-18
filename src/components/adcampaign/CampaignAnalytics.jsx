import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { RefreshCw, Loader2, TrendingUp, TrendingDown, Eye, MousePointer, Target, DollarSign } from 'lucide-react';

const COLORS = ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'];

export default function CampaignAnalytics({ campaigns, selectedCampaign, onSelectCampaign }) {
  const [simulating, setSimulating] = useState(null);
  const [localSelected, setLocalSelected] = useState(selectedCampaign || campaigns[0]);

  useEffect(() => {
    if (selectedCampaign) setLocalSelected(selectedCampaign);
    else if (!localSelected && campaigns[0]) setLocalSelected(campaigns[0]);
  }, [selectedCampaign, campaigns]);

  const campaign = localSelected;
  const perf = campaign?.performance || {};
  const dailyStats = campaign?.daily_stats || [];

  const simulateData = async () => {
    if (!campaign) return;
    setSimulating(campaign.id);
    await base44.functions.invoke('aiCampaignManager', {
      action: 'simulate_performance',
      campaign_id: campaign.id
    });
    // refetch after short delay
    setTimeout(() => {
      base44.entities.AdCampaign.get(campaign.id).then(c => {
        setLocalSelected(c);
        setSimulating(null);
      });
    }, 1000);
  };

  const kpis = [
    { label: 'Impressions', value: (perf.impressions || 0).toLocaleString(), icon: Eye, color: 'text-blue-400', trend: '+12%' },
    { label: 'Clicks', value: (perf.clicks || 0).toLocaleString(), icon: MousePointer, color: 'text-cyan-400', trend: '+8%' },
    { label: 'CTR', value: `${(perf.ctr || 0).toFixed(2)}%`, icon: TrendingUp, color: 'text-green-400', trend: '+2%' },
    { label: 'Conversions', value: (perf.conversions || 0).toLocaleString(), icon: Target, color: 'text-purple-400', trend: '+15%' },
    { label: 'CPC', value: `$${(perf.cpc || 0).toFixed(2)}`, icon: DollarSign, color: 'text-yellow-400', trend: '-5%' },
    { label: 'CPA', value: `$${(perf.cpa || 0).toFixed(2)}`, icon: DollarSign, color: 'text-orange-400', trend: '-8%' },
    { label: 'ROAS', value: `${(perf.roas || 0).toFixed(2)}x`, icon: TrendingUp, color: 'text-emerald-400', trend: '+18%' },
    { label: 'Revenue', value: `$${(perf.revenue_generated || 0).toFixed(0)}`, icon: DollarSign, color: 'text-pink-400', trend: '+22%' }
  ];

  const platformData = (campaign?.demographics?.platforms || []).map((p, i) => ({
    name: p, value: Math.floor(20 + Math.random() * 40)
  }));

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
        <Button size="sm" onClick={simulateData} disabled={!!simulating || !campaign}
          variant="outline" className="border-slate-600 text-slate-300 ml-auto">
          {simulating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
          Simulate Live Data
        </Button>
      </div>

      {!campaign ? (
        <div className="text-center py-16 text-slate-500">Select a campaign to view analytics</div>
      ) : (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpis.map((kpi, i) => (
              <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                  <span className={`text-xs ${kpi.trend.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>{kpi.trend}</span>
                </div>
                <div className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</div>
                <div className="text-slate-500 text-xs mt-1">{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* Spend vs Revenue Chart */}
          {dailyStats.length > 0 && (
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4">Daily Performance — Spend vs Revenue</h3>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={dailyStats}>
                  <defs>
                    <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#f1f5f9' }} />
                  <Legend />
                  <Area type="monotone" dataKey="spend" stroke="#ec4899" fill="url(#spendGrad)" strokeWidth={2} name="Spend ($)" />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#revenueGrad)" strokeWidth={2} name="Revenue ($)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* CTR & ROAS charts */}
          {dailyStats.length > 0 && (
            <div className="grid md:grid-cols-2 gap-5">
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
                <h3 className="text-white font-semibold mb-4">Daily CTR (%)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#f1f5f9' }} />
                    <Line type="monotone" dataKey="ctr" stroke="#8b5cf6" strokeWidth={2} dot={false} name="CTR (%)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
                <h3 className="text-white font-semibold mb-4">Daily ROAS</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#f1f5f9' }} />
                    <Bar dataKey="roas" fill="#06b6d4" radius={[4, 4, 0, 0]} name="ROAS (x)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Platform Split */}
          {platformData.length > 0 && (
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4">Platform Distribution</h3>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie data={platformData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                      {platformData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#f1f5f9' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {platformData.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-slate-300 capitalize">{p.name}</span>
                      <span className="text-slate-500 ml-auto">{p.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
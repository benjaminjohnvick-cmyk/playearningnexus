import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { TrendingUp, Users, AlertTriangle, Loader2, Brain, RefreshCw } from 'lucide-react';

export default function LTVChurnPanel({ campaigns, selectedCampaign, onSelectCampaign }) {
  const [localSelected, setLocalSelected] = useState(selectedCampaign || campaigns[0]);
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState(null);

  useEffect(() => {
    if (selectedCampaign) setLocalSelected(selectedCampaign);
    else if (!localSelected && campaigns[0]) setLocalSelected(campaigns[0]);
  }, [selectedCampaign, campaigns]);

  const campaign = localSelected;

  const fetchInsights = async () => {
    if (!campaign) return;
    setLoading(true);
    setInsights(null);
    const res = await base44.functions.invoke('aiCampaignManager', {
      action: 'get_ltv_churn_insights',
      campaign_id: campaign.id
    });
    setInsights(res.data?.insights);
    setLoading(false);
  };

  useEffect(() => {
    if (campaign && !insights) fetchInsights();
  }, [campaign?.id]);

  // Build churn projection data
  const churnData = insights ? [
    { period: '30 Days', churn: insights.churn_30d, ltv: insights.estimated_ltv * 0.85 },
    { period: '60 Days', churn: insights.churn_60d, ltv: insights.estimated_ltv * 0.7 },
    { period: '90 Days', churn: insights.churn_90d, ltv: insights.estimated_ltv * 0.55 }
  ] : [];

  // Health radar
  const radarData = insights ? [
    { metric: 'LTV', score: Math.min((insights.ltv_cac_ratio || 1) * 20, 100) },
    { metric: 'Retention', score: Math.max(0, 100 - (insights.churn_30d || 20)) },
    { metric: 'ROAS', score: Math.min((campaign?.performance?.roas || 1) * 20, 100) },
    { metric: 'Health', score: insights.overall_health_score || 70 },
    { metric: 'Conv. Rate', score: Math.min((campaign?.performance?.ctr || 1) * 10, 100) }
  ] : [];

  return (
    <div className="space-y-5">
      {/* Campaign Selector */}
      <div className="flex gap-2 flex-wrap items-center">
        {campaigns.map(c => (
          <button key={c.id}
            onClick={() => setLocalSelected(c)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${localSelected?.id === c.id ? 'bg-purple-600 border-purple-500 text-white' : 'border-slate-700 text-slate-400 bg-slate-800 hover:border-slate-500'}`}>
            {c.name}
          </button>
        ))}
        <Button size="sm" onClick={fetchInsights} disabled={loading || !campaign}
          variant="outline" className="border-slate-600 text-slate-300 ml-auto">
          {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
          Refresh Insights
        </Button>
      </div>

      {!campaign ? (
        <div className="text-center py-16 text-slate-500">Select a campaign to view LTV & Churn insights</div>
      ) : loading ? (
        <div className="flex flex-col items-center py-20 text-slate-400">
          <Brain className="w-12 h-12 mb-3 animate-pulse text-purple-400" />
          <p>AI is analyzing LTV & churn patterns...</p>
        </div>
      ) : !insights ? (
        <div className="text-center py-16 text-slate-500">
          <Button onClick={fetchInsights} className="bg-gradient-to-r from-purple-600 to-pink-600">
            <Brain className="w-4 h-4 mr-2" /> Generate LTV & Churn Analysis
          </Button>
        </div>
      ) : (
        <>
          {/* Top KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Estimated LTV', value: `$${insights.estimated_ltv?.toFixed(2)}`, color: 'from-green-500 to-emerald-600', icon: '💎' },
              { label: 'LTV:CAC Ratio', value: `${insights.ltv_cac_ratio?.toFixed(2)}x`, color: 'from-blue-500 to-cyan-500', icon: '📊', rating: insights.ltv_rating },
              { label: '30-Day Churn', value: `${insights.churn_30d?.toFixed(1)}%`, color: insights.churn_30d > 30 ? 'from-red-500 to-rose-600' : 'from-yellow-500 to-orange-500', icon: '📉' },
              { label: 'Health Score', value: `${insights.overall_health_score}/100`, color: insights.overall_health_score > 70 ? 'from-green-500 to-emerald-500' : 'from-orange-500 to-red-500', icon: '🏥' }
            ].map((kpi, i) => (
              <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                <div className="text-2xl mb-2">{kpi.icon}</div>
                <div className={`text-xl font-bold bg-gradient-to-r ${kpi.color} bg-clip-text text-transparent`}>{kpi.value}</div>
                <div className="text-slate-400 text-xs mt-1">{kpi.label}</div>
                {kpi.rating && <div className="text-xs text-yellow-400 mt-1 font-medium">{kpi.rating}</div>}
              </div>
            ))}
          </div>

          {/* Churn Curve + Radar */}
          <div className="grid md:grid-cols-2 gap-5">
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4">Churn Projection Over Time</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={churnData}>
                  <defs>
                    <linearGradient id="churnGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#f1f5f9' }} />
                  <Area type="monotone" dataKey="churn" stroke="#ef4444" fill="url(#churnGrad)" strokeWidth={2} name="Churn (%)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4">Campaign Health Radar</h3>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 9 }} />
                  <Radar name="Score" dataKey="score" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Revenue Forecast */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">Revenue Forecast (30 Days)</h3>
              <span className="text-green-400 font-bold text-lg">${insights.revenue_forecast_30d?.toFixed(0)}</span>
            </div>
            <p className="text-slate-400 text-sm">{insights.cohort_insights}</p>
          </div>

          {/* Insights Grid */}
          <div className="grid md:grid-cols-3 gap-5">
            {/* High Value Segments */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" /> High-Value Segments
              </h3>
              <div className="space-y-2">
                {insights.high_value_segments?.map((seg, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-green-400 text-xs mt-1 flex-shrink-0">▲</span>
                    <span className="text-slate-300 text-xs">{seg}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Churn Risk Signals */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" /> Churn Risk Signals
              </h3>
              <div className="space-y-2">
                {insights.churn_risk_signals?.map((sig, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-red-400 text-xs mt-1 flex-shrink-0">⚠</span>
                    <span className="text-slate-300 text-xs">{sig}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Re-engagement Strategies */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" /> Re-engagement
              </h3>
              <div className="space-y-2">
                {insights.reengagement_strategies?.map((str, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-blue-400 text-xs mt-1 flex-shrink-0">→</span>
                    <span className="text-slate-300 text-xs">{str}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { TrendingUp, TrendingDown, Brain, Loader2, Calendar, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Seasonal multipliers based on gaming/advertising industry patterns
const SEASONAL_MULTIPLIERS = [0.82, 0.78, 0.91, 0.95, 1.00, 1.05, 1.12, 1.08, 1.18, 1.22, 1.45, 1.55];

function calcGrowthVelocity(ads) {
  if (!ads?.length) return 0;
  const totalSpend = ads.reduce((s, a) => s + (a.total_spent || 0), 0);
  const avgBid = ads.reduce((s, a) => s + (a.bid_amount || 0.4), 0) / ads.length;
  const activeAds = ads.filter(a => a.status === 'active').length;
  // Rough weekly velocity estimate
  return totalSpend > 0 ? (totalSpend / 4) * (1 + activeAds * 0.1) : avgBid * 10;
}

function buildForecast(ads, monthsAhead = 6) {
  const velocity = calcGrowthVelocity(ads);
  const now = new Date();
  const currentMonth = now.getMonth();
  const points = [];

  // Historical (last 3 months simulated from current data)
  for (let i = 3; i >= 1; i--) {
    const mIdx = (currentMonth - i + 12) % 12;
    const seasonal = SEASONAL_MULTIPLIERS[mIdx];
    const spend = parseFloat((velocity * seasonal * (0.85 + Math.random() * 0.3)).toFixed(2));
    points.push({
      label: MONTHS[mIdx],
      spend,
      inventory: Math.floor(80 + seasonal * 20 + Math.random() * 10),
      type: 'historical',
      month: mIdx,
    });
  }

  // Current month
  const currSeasonal = SEASONAL_MULTIPLIERS[currentMonth];
  points.push({
    label: MONTHS[currentMonth] + ' ★',
    spend: parseFloat((velocity * currSeasonal).toFixed(2)),
    inventory: Math.floor(75 + currSeasonal * 25),
    type: 'current',
    month: currentMonth,
  });

  // Future forecast
  for (let i = 1; i <= monthsAhead; i++) {
    const mIdx = (currentMonth + i) % 12;
    const seasonal = SEASONAL_MULTIPLIERS[mIdx];
    const growthFactor = 1 + (i * 0.03); // 3% MoM growth
    const predicted = parseFloat((velocity * seasonal * growthFactor).toFixed(2));
    const lo = parseFloat((predicted * 0.82).toFixed(2));
    const hi = parseFloat((predicted * 1.18).toFixed(2));
    points.push({
      label: MONTHS[mIdx],
      spend: predicted,
      spendLow: lo,
      spendHigh: hi,
      inventory: Math.floor(60 + seasonal * 30 + i * 2),
      inventoryDemand: Math.floor(50 + seasonal * 25 + i * 3),
      type: 'forecast',
      month: mIdx,
    });
  }

  return points;
}

function InsightCard({ icon, label, value, sub, color }) {
  const colors = {
    green: 'border-green-500/20 bg-green-500/5',
    yellow: 'border-yellow-500/20 bg-yellow-500/5',
    blue: 'border-blue-500/20 bg-blue-500/5',
    red: 'border-red-500/20 bg-red-500/5',
  };
  const textColors = { green: 'text-green-400', yellow: 'text-yellow-400', blue: 'text-blue-400', red: 'text-red-400' };
  return (
    <div className={`border rounded-xl p-3 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={textColors[color]}>{icon}</span>
        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-xl font-black ${textColors[color]}`}>{value}</p>
      {sub && <p className="text-gray-600 text-[10px] mt-0.5">{sub}</p>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-xs shadow-2xl">
      <p className="text-white font-bold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? (p.name?.includes('$') || p.name?.toLowerCase().includes('spend') ? `$${p.value}` : p.value) : p.value}</p>
      ))}
    </div>
  );
};

export default function AdSpendForecast({ ads }) {
  const [monthsAhead, setMonthsAhead] = useState(6);
  const [aiInsights, setAiInsights] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);

  const forecast = useMemo(() => buildForecast(ads, monthsAhead), [ads, monthsAhead]);

  const velocity = calcGrowthVelocity(ads);
  const nextMonth = forecast.find(p => p.type === 'forecast');
  const peakMonth = [...forecast].filter(p => p.type === 'forecast').sort((a, b) => b.spend - a.spend)[0];
  const inventoryCrunch = forecast.filter(p => p.type === 'forecast' && p.inventoryDemand > p.inventory);

  const handleAIInsights = async () => {
    setLoadingAI(true);
    const summaryData = forecast.map(p => ({
      month: p.label, type: p.type,
      predicted_spend: p.spend,
      inventory_pct: p.inventory,
    }));
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert ad platform analyst. Given this 9-month ad spend forecast data for a gaming platform advertiser:
${JSON.stringify(summaryData, null, 2)}

The advertiser currently has ${ads.length} ads with a weekly velocity of ~$${velocity.toFixed(2)}.

Provide:
1. Top 3 actionable strategic recommendations to maximize ROI given these trends.
2. The single most critical risk to watch out for.
3. Optimal months to increase budget based on seasonal patterns.

Be concise and specific. Return JSON.`,
      response_json_schema: {
        type: 'object',
        properties: {
          recommendations: { type: 'array', items: { type: 'string' } },
          critical_risk: { type: 'string' },
          optimal_budget_months: { type: 'array', items: { type: 'string' } },
        }
      }
    });
    setAiInsights(result);
    setLoadingAI(false);
  };

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <InsightCard icon={<TrendingUp className="w-4 h-4" />} label="Weekly Velocity" value={`$${velocity.toFixed(2)}`} sub="Estimated weekly spend" color="blue" />
        <InsightCard icon={<Calendar className="w-4 h-4" />} label="Next Month Est." value={nextMonth ? `$${nextMonth.spend}` : '–'} sub={nextMonth?.label} color="yellow" />
        <InsightCard icon={<TrendingUp className="w-4 h-4" />} label="Peak Month" value={peakMonth?.label || '–'} sub={peakMonth ? `$${peakMonth.spend} projected` : ''} color="green" />
        <InsightCard icon={<AlertTriangle className="w-4 h-4" />} label="Inventory Crunches" value={inventoryCrunch.length} sub="Months demand > supply" color={inventoryCrunch.length > 0 ? 'red' : 'green'} />
      </div>

      {/* Spend forecast chart */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Spend Forecast (with confidence band)</p>
          <div className="flex gap-1">
            {[3, 6, 9].map(m => (
              <button key={m} onClick={() => setMonthsAhead(m)}
                className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${monthsAhead === m ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-500 hover:text-white'}`}>
                {m}mo
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={forecast} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#eab308" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={v => `$${v}`} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="spendHigh" stroke="none" fill="url(#bandGrad)" name="High Est." />
            <Area type="monotone" dataKey="spendLow" stroke="none" fill="#111827" name="Low Est." />
            <Area type="monotone" dataKey="spend" stroke="#eab308" strokeWidth={2} fill="url(#spendGrad)" name="Predicted Spend $" dot={{ fill: '#eab308', r: 3 }} />
            <ReferenceLine x={forecast.find(p => p.type === 'current')?.label} stroke="#6b7280" strokeDasharray="4 2" label={{ value: 'Now', fill: '#9ca3af', fontSize: 10 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Inventory chart */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Ad Grid Inventory vs. Demand (%)</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={forecast.filter(p => p.type !== 'historical')} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} domain={[0, 120]} tickFormatter={v => `${v}%`} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="inventory" fill="#22c55e" opacity={0.7} name="Available Inventory %" radius={[3, 3, 0, 0]} />
            <Bar dataKey="inventoryDemand" fill="#f97316" opacity={0.7} name="Predicted Demand %" radius={[3, 3, 0, 0]} />
            <ReferenceLine y={100} stroke="#ef4444" strokeDasharray="3 3" />
          </BarChart>
        </ResponsiveContainer>
        {inventoryCrunch.length > 0 && (
          <div className="mt-2 flex items-center gap-2 text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Demand may exceed inventory in: {inventoryCrunch.map(p => p.label).join(', ')} — consider increasing bids early.
          </div>
        )}
      </div>

      {/* Seasonal heatmap */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Seasonal Demand Index</p>
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
          {MONTHS.map((m, i) => {
            const mult = SEASONAL_MULTIPLIERS[i];
            const intensity = Math.round((mult - 0.75) / 0.85 * 100);
            const bg = intensity > 70 ? 'bg-red-500' : intensity > 45 ? 'bg-orange-400' : intensity > 25 ? 'bg-yellow-400' : 'bg-green-500';
            return (
              <div key={m} className={`rounded-lg p-2 text-center ${bg} bg-opacity-${Math.max(20, intensity)}`}
                style={{ opacity: 0.3 + mult * 0.5 }}>
                <p className="text-white text-[9px] font-black">{m}</p>
                <p className="text-white text-[9px]">{(mult * 100).toFixed(0)}%</p>
              </div>
            );
          })}
        </div>
        <p className="text-gray-600 text-[10px] mt-2">Index relative to baseline. Red = peak season, Green = low season.</p>
      </div>

      {/* AI insights */}
      <Button onClick={handleAIInsights} disabled={loadingAI}
        className="bg-purple-600 hover:bg-purple-500 text-white font-bold gap-2 w-full">
        {loadingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {loadingAI ? 'Analyzing trends...' : 'Generate AI Strategic Insights'}
      </Button>

      {aiInsights && (
        <div className="bg-purple-900/20 border border-purple-500/20 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold text-purple-400 uppercase tracking-wider">AI Strategic Insights</p>
          <div>
            <p className="text-xs font-bold text-gray-500 mb-2">Recommendations</p>
            {aiInsights.recommendations?.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs mb-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                <span className="text-gray-300">{r}</span>
              </div>
            ))}
          </div>
          {aiInsights.critical_risk && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-400 mb-0.5">Critical Risk</p>
                <p className="text-xs text-gray-400">{aiInsights.critical_risk}</p>
              </div>
            </div>
          )}
          {aiInsights.optimal_budget_months?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 mb-1.5">Optimal months to increase budget</p>
              <div className="flex flex-wrap gap-1.5">
                {aiInsights.optimal_budget_months.map(m => (
                  <Badge key={m} className="bg-green-500/10 text-green-300 border border-green-500/20 text-xs">{m}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
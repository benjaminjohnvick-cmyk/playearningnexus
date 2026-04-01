import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Eye, MousePointerClick, DollarSign, BarChart2, Info } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

// Platform CPM/CPC industry benchmarks (USD)
const PLATFORMS = [
  { id: 'meta', name: 'Meta (FB/IG)', icon: '📘', color: '#1877f2', cpmBenchmark: 14.90, cpcBenchmark: 0.97, audienceStr: 'Broad + Interest', adType: 'Carousel + Video' },
  { id: 'google', name: 'Google Ads', icon: '🔍', color: '#4285f4', cpmBenchmark: 2.80, cpcBenchmark: 2.69, audienceStr: 'Search + Display', adType: 'Responsive Search' },
  { id: 'tiktok', name: 'TikTok Ads', icon: '🎵', color: '#ff0050', cpmBenchmark: 10.00, cpcBenchmark: 1.00, audienceStr: '18-24 Gaming', adType: 'In-Feed Video' },
  { id: 'twitter', name: 'X (Twitter)', icon: '🐦', color: '#1da1f2', cpmBenchmark: 6.46, cpcBenchmark: 0.38, audienceStr: 'Tech + Gaming', adType: 'Promoted Posts' },
  { id: 'snapchat', name: 'Snapchat', icon: '👻', color: '#fffc00', cpmBenchmark: 2.95, cpcBenchmark: 0.55, audienceStr: '13-24 Mobile', adType: 'Story Ads' },
];

// Simulate per-platform performance data
function generatePlatformData(ads) {
  const totalClicks = ads.reduce((s, a) => s + (a.total_clicks || 0), 0) || 100;
  const totalImpressions = totalClicks * 40;

  return PLATFORMS.map(p => {
    const impShare = 0.1 + Math.random() * 0.3;
    const impressions = Math.floor(totalImpressions * impShare);
    const ctr = parseFloat((1.5 + Math.random() * 4).toFixed(2));
    const clicks = Math.floor(impressions * ctr / 100);
    const conversions = Math.floor(clicks * (0.03 + Math.random() * 0.08));
    const spend = parseFloat((impressions / 1000 * p.cpmBenchmark * (0.7 + Math.random() * 0.6)).toFixed(2));
    // What it WOULD cost on that platform
    const equivalentCostCPM = parseFloat((impressions / 1000 * p.cpmBenchmark).toFixed(2));
    const equivalentCostCPC = parseFloat((clicks * p.cpcBenchmark).toFixed(2));
    const gridActualCost = parseFloat((conversions * 0.4).toFixed(2)); // GamerGain charges per survey
    const savings = parseFloat((Math.max(equivalentCostCPM, equivalentCostCPC) - gridActualCost).toFixed(2));

    return {
      ...p,
      impressions,
      clicks,
      ctr,
      conversions,
      spend,
      equivalentCostCPM,
      equivalentCostCPC,
      gridActualCost,
      savings,
      cpa: conversions > 0 ? parseFloat((spend / conversions).toFixed(2)) : 0,
      roas: spend > 0 ? parseFloat(((conversions * 0.4) / spend).toFixed(2)) : 0,
    };
  });
}

const WEEKLY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function generateWeeklyTrend(platforms) {
  return WEEKLY_LABELS.map(day => {
    const obj = { day };
    platforms.forEach(p => {
      obj[p.id] = Math.floor(50 + Math.random() * 300);
    });
    return obj;
  });
}

function PlatformCard({ platform, selected, onClick }) {
  const trend = platform.roas > 1 ? 'up' : 'down';
  return (
    <div onClick={onClick} className={`border rounded-2xl p-4 cursor-pointer transition-all ${selected ? 'ring-2 border-white/20' : 'border-gray-700 hover:border-gray-500'}`}
      style={selected ? { borderColor: platform.color + '60', backgroundColor: platform.color + '08' } : {}}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{platform.icon}</span>
          <div>
            <p className="text-white font-black text-xs leading-none">{platform.name}</p>
            <p className="text-gray-500 text-[10px] mt-0.5">{platform.adType}</p>
          </div>
        </div>
        {trend === 'up' ? <TrendingUp className="w-4 h-4 text-green-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-900 rounded-lg p-1.5 text-center">
          <p className="text-white font-black text-sm">{(platform.impressions / 1000).toFixed(1)}k</p>
          <p className="text-gray-600 text-[10px]">Views</p>
        </div>
        <div className="bg-gray-900 rounded-lg p-1.5 text-center">
          <p className="text-white font-black text-sm">{platform.ctr}%</p>
          <p className="text-gray-600 text-[10px]">CTR</p>
        </div>
        <div className="bg-gray-900 rounded-lg p-1.5 text-center">
          <p className="font-black text-sm" style={{ color: platform.color }}>${platform.equivalentCostCPM}</p>
          <p className="text-gray-600 text-[10px]">Est. Market Cost</p>
        </div>
        <div className="bg-gray-900 rounded-lg p-1.5 text-center">
          <p className="text-green-400 font-black text-sm">${platform.savings > 0 ? platform.savings : 0}</p>
          <p className="text-gray-600 text-[10px]">Grid Savings</p>
        </div>
      </div>
    </div>
  );
}

export default function AdSocialChannelAnalytics({ ads }) {
  const platforms = useMemo(() => generatePlatformData(ads), [ads.length]);
  const weeklyTrend = useMemo(() => generateWeeklyTrend(platforms), [platforms]);
  const [selectedPlatform, setSelectedPlatform] = useState(null);

  const totalImpressions = platforms.reduce((s, p) => s + p.impressions, 0);
  const totalClicks = platforms.reduce((s, p) => s + p.clicks, 0);
  const totalEquivCost = platforms.reduce((s, p) => s + p.equivalentCostCPM, 0);
  const totalGridCost = platforms.reduce((s, p) => s + p.gridActualCost, 0);
  const totalSavings = totalEquivCost - totalGridCost;

  const pieData = platforms.map(p => ({ name: p.name.split(' ')[0], value: p.impressions, color: p.color }));

  const sel = selectedPlatform ? platforms.find(p => p.id === selectedPlatform) : null;

  return (
    <div className="space-y-5">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-white">{(totalImpressions / 1000).toFixed(1)}k</p>
          <p className="text-gray-500 text-xs">Total Views</p>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-blue-400">{totalClicks.toLocaleString()}</p>
          <p className="text-gray-500 text-xs">Total Clicks</p>
        </div>
        <div className="bg-gray-900 border border-red-500/20 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-red-400">${totalEquivCost.toFixed(2)}</p>
          <p className="text-gray-500 text-xs">Market Equiv. Cost</p>
        </div>
        <div className="bg-gray-900 border border-green-500/20 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-green-400">${totalSavings.toFixed(2)}</p>
          <p className="text-gray-500 text-xs">vs. Market Savings</p>
        </div>
      </div>

      {/* Cost comparison callout */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-300 font-bold text-sm">GamerGain vs. Market Cost Comparison</p>
            <p className="text-gray-400 text-xs mt-1">
              If you ran equivalent campaigns on these 5 platforms, you'd spend approximately <span className="text-red-400 font-bold">${totalEquivCost.toFixed(2)}</span> in CPM costs alone.
              Your GamerGain campaigns delivered the same reach for only <span className="text-green-400 font-bold">${totalGridCost.toFixed(2)}</span> — a
              <span className="text-green-300 font-bold"> {totalEquivCost > 0 ? ((totalSavings / totalEquivCost) * 100).toFixed(0) : 0}% cost reduction</span>.
            </p>
          </div>
        </div>
      </div>

      {/* Platform cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {platforms.map(p => (
          <PlatformCard key={p.id} platform={p} selected={selectedPlatform === p.id}
            onClick={() => setSelectedPlatform(selectedPlatform === p.id ? null : p.id)} />
        ))}
      </div>

      {/* Selected platform deep dive */}
      {sel && (
        <div className="border rounded-2xl p-5 space-y-4" style={{ borderColor: sel.color + '40', backgroundColor: sel.color + '08' }}>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{sel.icon}</span>
            <p className="font-black text-white">{sel.name} — Deep Dive</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Impressions', value: sel.impressions.toLocaleString(), color: sel.color },
              { label: 'Clicks', value: sel.clicks.toLocaleString(), color: sel.color },
              { label: 'CTR', value: `${sel.ctr}%`, color: sel.color },
              { label: 'Conversions', value: sel.conversions, color: sel.color },
              { label: 'Market CPM Cost', value: `$${sel.equivalentCostCPM}`, color: '#ef4444' },
              { label: 'Market CPC Cost', value: `$${sel.equivalentCostCPC}`, color: '#ef4444' },
              { label: 'Grid Actual Cost', value: `$${sel.gridActualCost}`, color: '#22c55e' },
              { label: 'Your Savings', value: `$${Math.max(0, sel.savings)}`, color: '#22c55e' },
            ].map(item => (
              <div key={item.label} className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
                <p className="text-lg font-black" style={{ color: item.color }}>{item.value}</p>
                <p className="text-gray-500 text-[10px]">{item.label}</p>
              </div>
            ))}
          </div>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-xs text-gray-400">
            <p className="font-bold text-white mb-1">How we calculate market cost:</p>
            <p>CPM (cost per 1000 views): {sel.impressions.toLocaleString()} impressions ÷ 1000 × ${sel.cpmBenchmark} benchmark = <span className="text-red-400 font-bold">${sel.equivalentCostCPM}</span></p>
            <p className="mt-0.5">CPC (cost per click): {sel.clicks.toLocaleString()} clicks × ${sel.cpcBenchmark} benchmark = <span className="text-red-400 font-bold">${sel.equivalentCostCPC}</span></p>
            <p className="mt-0.5">GamerGain (per-survey): {sel.conversions} completions × $0.40 = <span className="text-green-400 font-bold">${sel.gridActualCost}</span></p>
          </div>
        </div>
      )}

      {/* Weekly clicks trend */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Weekly Click Trend by Platform</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={weeklyTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 10 }} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }} />
            {platforms.map(p => <Line key={p.id} type="monotone" dataKey={p.id} stroke={p.color} strokeWidth={2} dot={false} name={p.name.split(' ')[0]} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Impression share pie */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Impression Share by Platform</p>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name">
              {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
            <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }} formatter={(v) => [(v / 1000).toFixed(1) + 'k', 'Impressions']} />
            <Legend formatter={(value) => <span style={{ color: '#9ca3af', fontSize: 10 }}>{value}</span>} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Benchmark table */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 overflow-x-auto">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Market Cost Benchmark Comparison</p>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800">
              <th className="text-left py-2 pr-4">Platform</th>
              <th className="text-right py-2 px-3">Views</th>
              <th className="text-right py-2 px-3">Clicks</th>
              <th className="text-right py-2 px-3">CTR</th>
              <th className="text-right py-2 px-3 text-red-400">Market CPM $</th>
              <th className="text-right py-2 px-3 text-red-400">Market CPC $</th>
              <th className="text-right py-2 px-3 text-green-400">Grid Cost $</th>
              <th className="text-right py-2 pl-3 text-green-400">Savings $</th>
            </tr>
          </thead>
          <tbody>
            {platforms.map(p => (
              <tr key={p.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="py-2 pr-4 font-bold" style={{ color: p.color }}>{p.icon} {p.name.split(' ')[0]}</td>
                <td className="text-right py-2 px-3 text-gray-300">{(p.impressions / 1000).toFixed(1)}k</td>
                <td className="text-right py-2 px-3 text-gray-300">{p.clicks.toLocaleString()}</td>
                <td className="text-right py-2 px-3 text-gray-300">{p.ctr}%</td>
                <td className="text-right py-2 px-3 text-red-400 font-bold">${p.equivalentCostCPM}</td>
                <td className="text-right py-2 px-3 text-red-400 font-bold">${p.equivalentCostCPC}</td>
                <td className="text-right py-2 px-3 text-green-400 font-bold">${p.gridActualCost}</td>
                <td className="text-right py-2 pl-3 text-green-400 font-bold">${Math.max(0, p.savings)}</td>
              </tr>
            ))}
            <tr className="font-black">
              <td className="py-2 pr-4 text-white">TOTAL</td>
              <td className="text-right py-2 px-3 text-white">{(totalImpressions / 1000).toFixed(1)}k</td>
              <td className="text-right py-2 px-3 text-white">{totalClicks.toLocaleString()}</td>
              <td className="text-right py-2 px-3 text-gray-400">—</td>
              <td className="text-right py-2 px-3 text-red-400">${totalEquivCost.toFixed(2)}</td>
              <td className="text-right py-2 px-3 text-gray-400">—</td>
              <td className="text-right py-2 px-3 text-green-400">${totalGridCost.toFixed(2)}</td>
              <td className="text-right py-2 pl-3 text-green-400">${Math.max(0, totalSavings).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
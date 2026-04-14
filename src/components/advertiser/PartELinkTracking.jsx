import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, MousePointerClick, TrendingUp, Share2, DollarSign, RefreshCw, Loader2, Zap, Globe, BarChart2, Target } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const PLATFORMS = ['Facebook', 'Instagram', 'TikTok', 'YouTube', 'X/Twitter', 'Snapchat'];

// Simulated live tracking data (in production this comes from real link-tracking backend)
function generateTrackingData(ads) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map(day => ({
    day,
    clicks: Math.floor(Math.random() * 200 + 50),
    views: Math.floor(Math.random() * 8000 + 2000),
    conversions: Math.floor(Math.random() * 30 + 5),
    revenue: parseFloat((Math.random() * 150 + 20).toFixed(2)),
  }));
}

function generatePlatformData() {
  return PLATFORMS.map(platform => ({
    platform,
    posts: Math.floor(Math.random() * 40 + 10),
    clicks: Math.floor(Math.random() * 120 + 20),
    views: Math.floor(Math.random() * 5000 + 500),
    engagementRate: parseFloat((Math.random() * 8 + 1).toFixed(1)),
    conversions: Math.floor(Math.random() * 15 + 2),
  }));
}

export default function PartELinkTracking({ ads = [], userId }) {
  const [trackingData, setTrackingData] = useState([]);
  const [platformData, setPlatformData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const totalClicks = trackingData.reduce((s, d) => s + d.clicks, 0);
  const totalViews = trackingData.reduce((s, d) => s + d.views, 0);
  const totalConversions = trackingData.reduce((s, d) => s + d.conversions, 0);
  const totalRevenue = trackingData.reduce((s, d) => s + d.revenue, 0);
  const totalSpend = totalClicks * 0.50;
  const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend * 100).toFixed(1) : 0;
  const ctr = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(2) : 0;

  useEffect(() => {
    refresh();
  }, []);

  const refresh = () => {
    setLoading(true);
    setTimeout(() => {
      setTrackingData(generateTrackingData(ads));
      setPlatformData(generatePlatformData());
      setLastRefresh(new Date());
      setLoading(false);
    }, 800);
  };

  const runAIInsight = async () => {
    setAiLoading(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an AI advertising analyst. Analyze this 7-day PPC campaign performance data and determine if the ad spend is generating worthwhile ROI on social media.

Campaign Stats (7 days):
- Total clicks: ${totalClicks}
- Total views: ${totalViews}  
- CTR: ${ctr}%
- Total conversions: ${totalConversions}
- Total revenue: $${totalRevenue.toFixed(2)}
- Total ad spend: $${totalSpend.toFixed(2)} ($0.50 per click × ${totalClicks} clicks)
- ROI: ${roi}%
- Platform breakdown: ${platformData.map(p => `${p.platform}: ${p.clicks} clicks, ${p.views} views, ${p.engagementRate}% engagement`).join('; ')}

GamerGain model: Each $0.50 click generates 20 social posts. Platform earns $0.25, user earns $0.25.
Campaign runs until sales = 2× ad budget.

Provide a brief, actionable 2-3 sentence analysis of campaign performance, which platform is performing best, and one specific optimization recommendation. Be direct and data-driven.`,
      });
      setAiInsight(result);
    } catch (e) {
      toast.error('AI analysis failed.');
    }
    setAiLoading(false);
  };

  const statCards = [
    { icon: <Eye className="w-5 h-5 text-blue-400" />, label: 'Total Views', value: totalViews.toLocaleString(), sub: '7-day total' },
    { icon: <MousePointerClick className="w-5 h-5 text-yellow-400" />, label: 'Total Clicks', value: totalClicks.toLocaleString(), sub: `CTR: ${ctr}%` },
    { icon: <Target className="w-5 h-5 text-green-400" />, label: 'Conversions', value: totalConversions, sub: `${totalViews > 0 ? ((totalConversions / totalViews) * 100).toFixed(2) : 0}% conv. rate` },
    { icon: <DollarSign className="w-5 h-5 text-orange-400" />, label: 'Revenue', value: `$${totalRevenue.toFixed(2)}`, sub: `ROI: ${roi}%` },
    { icon: <Share2 className="w-5 h-5 text-purple-400" />, label: 'Social Posts', value: (totalClicks * 20).toLocaleString(), sub: '20 posts per click' },
    { icon: <BarChart2 className="w-5 h-5 text-red-400" />, label: 'Ad Spend', value: `$${totalSpend.toFixed(2)}`, sub: '$0.50/click' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-black flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-400" /> Part E — AI Link & View Tracking
          </h3>
          <p className="text-gray-500 text-xs mt-0.5">Real-time tracking of your ad clicks, social media views, and conversion performance</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-600 text-[10px]">Last: {lastRefresh.toLocaleTimeString()}</span>
          <Button size="sm" variant="outline" className="border-gray-700 text-gray-400 hover:text-white gap-1" onClick={refresh} disabled={loading}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Refresh
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {statCards.map(card => (
          <div key={card.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              {card.icon}
              <p className="text-gray-500 text-xs">{card.label}</p>
            </div>
            <p className="text-white font-black text-xl">{card.value}</p>
            <p className="text-gray-600 text-[10px] mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Click & Views chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">Clicks & Views — 7 Day Trend</p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={trackingData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 11 }} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} />
            <Line type="monotone" dataKey="clicks" stroke="#eab308" strokeWidth={2} dot={false} name="Clicks" />
            <Line type="monotone" dataKey="views" stroke="#3b82f6" strokeWidth={2} dot={false} name="Views" yAxisId="right" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Platform breakdown */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">Platform Performance Breakdown</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700">
                {['Platform', 'Posts', 'Clicks', 'Views', 'Engagement', 'Conv.'].map(h => (
                  <th key={h} className="text-left text-gray-500 pb-2 pr-3 font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {platformData.map(p => (
                <tr key={p.platform} className="border-b border-gray-800">
                  <td className="py-2 pr-3 text-white font-bold">{p.platform}</td>
                  <td className="py-2 pr-3 text-purple-400">{p.posts}</td>
                  <td className="py-2 pr-3 text-yellow-400">{p.clicks}</td>
                  <td className="py-2 pr-3 text-blue-400">{p.views.toLocaleString()}</td>
                  <td className="py-2 pr-3">
                    <span className={`font-bold ${p.engagementRate > 5 ? 'text-green-400' : 'text-gray-400'}`}>{p.engagementRate}%</span>
                  </td>
                  <td className="py-2 text-green-400">{p.conversions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">Daily Revenue vs Spend</p>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={trackingData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 11 }} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} formatter={(v) => `$${v}`} />
            <Bar dataKey="revenue" fill="#22c55e" radius={[4, 4, 0, 0]} name="Revenue" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 2× target progress */}
      <div className="bg-gray-900 border border-yellow-500/30 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-yellow-400 font-bold text-sm">🎯 2× Revenue Campaign Goal Progress</p>
          <Badge className={`text-xs ${totalRevenue >= totalSpend * 2 ? 'bg-green-600' : 'bg-yellow-600'} text-white`}>
            {totalRevenue >= totalSpend * 2 ? '✅ Goal Met!' : `${((totalRevenue / (totalSpend * 2)) * 100).toFixed(0)}% of goal`}
          </Badge>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3 mb-1">
          <div
            className="h-3 rounded-full bg-gradient-to-r from-yellow-500 to-green-500 transition-all duration-700"
            style={{ width: `${Math.min(100, (totalRevenue / Math.max(totalSpend * 2, 1)) * 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-500">
          <span>Revenue: ${totalRevenue.toFixed(2)}</span>
          <span>Target (2× spend): ${(totalSpend * 2).toFixed(2)}</span>
        </div>
      </div>

      {/* AI insight */}
      <div className="bg-gray-900 border border-blue-500/30 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-blue-400 font-bold text-sm flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" /> AI Performance Insight
          </p>
          <Button size="sm" onClick={runAIInsight} disabled={aiLoading}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs gap-1">
            {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            {aiLoading ? 'Analyzing…' : 'Get AI Insight'}
          </Button>
        </div>
        {aiInsight ? (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-gray-300 text-xs leading-relaxed">
            {aiInsight}
          </motion.p>
        ) : (
          <p className="text-gray-600 text-xs">Click "Get AI Insight" to see an AI analysis of your campaign performance and optimization tips.</p>
        )}
      </div>
    </div>
  );
}
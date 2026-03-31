import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  BarChart2, DollarSign, MousePointerClick, CheckSquare, TrendingUp,
  Brain, Sparkles, Loader2, ArrowRight, Grid2x2, Trophy, Wallet,
  PauseCircle, PlayCircle, Zap
} from 'lucide-react';

function StatCard({ icon, label, value, sub, color = 'yellow' }) {
  const colorMap = {
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    green: 'text-green-400 bg-green-500/10 border-green-500/20',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  };
  return (
    <div className={`border rounded-2xl p-4 ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-gray-400">{label}</span></div>
      <p className="text-2xl font-black text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdBusinessOverview() {
  const [user, setUser] = useState(null);
  const [aiSummary, setAiSummary] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: ads = [] } = useQuery({
    queryKey: ['adListingsOverview', user?.id],
    queryFn: () => base44.entities.AdListing.filter({ owner_user_id: user.id }, '-created_date'),
    enabled: !!user,
  });

  const { data: memories = [] } = useQuery({
    queryKey: ['adMemories', user?.id],
    queryFn: () => base44.entities.AdLearningMemory.filter({ owner_user_id: user.id }, '-snapshot_date', 20),
    enabled: !!user,
  });

  const totals = ads.reduce((acc, ad) => ({
    clicks: acc.clicks + (ad.total_clicks || 0),
    completed: acc.completed + (ad.surveys_completed || 0),
    spent: acc.spent + (ad.total_spent || 0),
  }), { clicks: 0, completed: 0, spent: 0 });

  const roi = totals.spent > 0
    ? ((totals.completed * 0.4 - totals.spent) / totals.spent * 100).toFixed(1)
    : '—';
  const ctr = totals.clicks > 0 ? (totals.completed / totals.clicks * 100).toFixed(1) : '—';

  // Build sparkline from memories
  const sparkData = memories.slice(0, 10).reverse().map((m, i) => ({
    i,
    completions: m.surveys_completed || 0,
    spend: m.total_spent || 0,
  }));

  const generateSummary = async () => {
    if (ads.length === 0) return;
    setLoadingAI(true);
    const summary = `Advertiser: ${ads.length} ads. Spend: $${totals.spent.toFixed(2)}. Clicks: ${totals.clicks}. Completions: ${totals.completed}. CTR: ${ctr}%. ROI: ${roi}%. Active: ${ads.filter(a=>a.status==='active').length}. Paused: ${ads.filter(a=>a.status==='paused').length}. Top ad: ${[...ads].sort((a,b)=>(b.surveys_completed||0)-(a.surveys_completed||0))[0]?.brand_name || 'N/A'}.`;
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an advertising performance coach. Summarize this advertiser's performance in 2–3 sentences and give the single most impactful action they should take today. Be direct, specific, and encouraging. No markdown.\n\nData: ${summary}`,
    });
    setAiSummary(res);
    setLoadingAI(false);
  };

  if (!user) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-gray-700 border-t-yellow-400 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-yellow-500 rounded-xl flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white leading-none">Business Overview</h1>
              <p className="text-gray-500 text-xs">Performance snapshot · {new Date().toLocaleDateString()}</p>
            </div>
          </div>
          <Link to="/AdBusinessDashboard">
            <Button size="sm" className="bg-gray-700 hover:bg-gray-600 text-white gap-1.5 text-xs">
              <Grid2x2 className="w-3.5 h-3.5" /> Full Dashboard <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard icon={<Grid2x2 className="w-4 h-4" />} label="Total Ads" value={ads.length} color="yellow" />
          <StatCard icon={<MousePointerClick className="w-4 h-4" />} label="Clicks" value={totals.clicks} color="blue" />
          <StatCard icon={<CheckSquare className="w-4 h-4" />} label="Completions" value={totals.completed} color="green" />
          <StatCard icon={<DollarSign className="w-4 h-4" />} label="Total Spend" value={`$${totals.spent.toFixed(2)}`} color="orange" />
          <StatCard icon={<TrendingUp className="w-4 h-4" />} label="ROI" value={`${roi}%`} sub={`CTR: ${ctr}%`} color="purple" />
        </div>

        {/* AI Summary */}
        <div className="bg-gray-900 border border-yellow-500/20 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-yellow-300 font-black flex items-center gap-2">
              <Brain className="w-4 h-4" /> AI Performance Coach
            </p>
            <Button size="sm" onClick={generateSummary} disabled={loadingAI || ads.length === 0}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-black gap-1 text-xs h-7">
              {loadingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Analyze
            </Button>
          </div>
          {aiSummary ? (
            <p className="text-gray-200 text-sm leading-relaxed">{aiSummary}</p>
          ) : (
            <p className="text-gray-600 text-sm">Click Analyze to get a personalized AI performance summary and today's top recommended action.</p>
          )}
        </div>

        {/* Sparkline */}
        {sparkData.length > 1 && (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5">
            <p className="text-white font-bold text-sm mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" /> Completions Over Time
            </p>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={sparkData}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="i" hide />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#9ca3af', fontSize: 11 }} />
                <Area type="monotone" dataKey="completions" stroke="#f59e0b" fill="url(#grad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Active ads quick view */}
        <div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Campaign Status</p>
          <div className="space-y-2">
            {ads.length === 0 ? (
              <div className="text-center py-8 text-gray-600 text-sm">
                No ads yet. <Link to="/AdBusinessDashboard" className="text-yellow-400 hover:underline">Create your first ad →</Link>
              </div>
            ) : ads.map(ad => {
              const ctrAd = ad.total_clicks > 0 ? (ad.surveys_completed / ad.total_clicks * 100).toFixed(1) : '0';
              return (
                <div key={ad.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-3">
                  {ad.status === 'active'
                    ? <PlayCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    : <PauseCircle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm truncate">{ad.brand_name}</p>
                    <p className="text-gray-500 text-xs">{ad.surveys_completed || 0} completions · {ctrAd}% CTR · ${(ad.total_spent||0).toFixed(2)} spent</p>
                  </div>
                  <Badge className={`text-[10px] border ${
                    ad.status === 'active' ? 'bg-green-500/20 border-green-500/40 text-green-300' :
                    ad.status === 'paused' ? 'bg-orange-500/20 border-orange-500/40 text-orange-300' :
                    'bg-gray-700 text-gray-400'
                  }`}>
                    {ad.status}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* Learning memory */}
        {memories.length > 0 && (
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Brain className="w-4 h-4" /> AI Learning History
            </p>
            <div className="space-y-2">
              {memories.slice(0, 5).map(m => (
                <div key={m.id} className="bg-gray-900 border border-purple-500/10 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-300 text-xs font-bold">{m.brand_name}</span>
                    <span className="text-gray-600 text-[10px]">{new Date(m.snapshot_date).toLocaleDateString()}</span>
                  </div>
                  {m.ai_insights && <p className="text-purple-300 text-xs italic">{m.ai_insights}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
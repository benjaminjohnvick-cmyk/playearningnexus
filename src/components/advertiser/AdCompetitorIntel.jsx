import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Radar, TrendingUp, Eye, DollarSign, Users, Lightbulb, Loader2, RefreshCw, BarChart2 } from 'lucide-react';

const CATEGORIES = ['Gaming', 'Tech', 'Fashion', 'Finance', 'Health', 'Food', 'Education', 'E-Commerce', 'Crypto', 'SaaS'];

export default function AdCompetitorIntel({ ads }) {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);

  const myCategories = [...new Set(ads.map(a => a.brand_name?.split(' ')[0]).filter(Boolean))];

  const generateReport = async () => {
    if (!selectedCategory) return;
    setLoading(true);
    try {
      const myAdsSummary = ads.length > 0
        ? `My ads: ${ads.map(a => `${a.brand_name} (bid $${a.bid_amount}, tier ${a.grid_tier}, CTR ${a.total_clicks > 0 ? ((a.surveys_completed / a.total_clicks) * 100).toFixed(1) : 0}%)`).join('; ')}`
        : 'No active ads';

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a competitive intelligence analyst for digital advertising on a gaming platform called GamerGain.

My context: ${myAdsSummary}
Category I'm analyzing: ${selectedCategory}

Generate a realistic weekly competitor intelligence report for the ${selectedCategory} category on the GamerGain Ad Grid. Include:
1. 4 fictional but realistic competitor profiles with brand names, average bids, creative styles, target audiences
2. Category average bid ($/survey)
3. Top performing creative styles in this category
4. Key audience segments being targeted
5. 3 strategic recommendations for me to outperform competitors
6. Market saturation score (0-100, higher = more competition)
7. Best time windows when competitor activity is lowest

Be specific and actionable.`,
        response_json_schema: {
          type: 'object',
          properties: {
            category: { type: 'string' },
            market_saturation: { type: 'number' },
            avg_category_bid: { type: 'number' },
            competitors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  brand_name: { type: 'string' },
                  avg_bid: { type: 'number' },
                  grid_tier: { type: 'string' },
                  creative_style: { type: 'string' },
                  target_audience: { type: 'string' },
                  estimated_ctr: { type: 'number' },
                  strength: { type: 'string' },
                }
              }
            },
            top_creative_styles: { type: 'array', items: { type: 'string' } },
            key_audience_segments: { type: 'array', items: { type: 'string' } },
            low_competition_windows: { type: 'array', items: { type: 'string' } },
            strategic_recommendations: { type: 'array', items: { type: 'string' } },
            executive_summary: { type: 'string' },
          }
        }
      });
      setReport(result);
    } finally {
      setLoading(false);
    }
  };

  const saturationColor = (score) => {
    if (score > 70) return 'text-red-400';
    if (score > 40) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <div className="space-y-5">
      {/* Category selector */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Select Category to Analyze</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${selectedCategory === cat ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'border-gray-700 text-gray-500 hover:text-white'}`}>
              {cat}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <Button onClick={generateReport} disabled={loading || !selectedCategory}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
            {loading ? 'Scanning Grid...' : 'Generate Weekly Intel Report'}
          </Button>
          {report && (
            <Button variant="outline" onClick={generateReport} disabled={loading}
              className="border-gray-600 text-gray-300 gap-2">
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
          )}
        </div>
      </div>

      {report && (
        <>
          {/* Overview */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 text-center">
              <p className={`text-2xl font-black ${saturationColor(report.market_saturation)}`}>{report.market_saturation}/100</p>
              <p className="text-gray-500 text-xs mt-1">Market Saturation</p>
            </div>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-yellow-400">${report.avg_category_bid?.toFixed(2)}</p>
              <p className="text-gray-500 text-xs mt-1">Avg Category Bid</p>
            </div>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-purple-400">{report.competitors?.length}</p>
              <p className="text-gray-500 text-xs mt-1">Competitors Tracked</p>
            </div>
          </div>

          {/* Executive summary */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4">
            <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">Executive Summary</p>
            <p className="text-gray-300 text-sm">{report.executive_summary}</p>
          </div>

          {/* Competitors */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Competitor Profiles</p>
            {report.competitors?.map((c, i) => (
              <div key={i} className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-white font-bold text-sm">{c.brand_name}</p>
                    <p className="text-gray-500 text-xs">{c.creative_style}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-gray-800 text-yellow-400 text-xs">${c.avg_bid}/survey</Badge>
                    <Badge className="bg-gray-800 text-purple-400 text-xs">{c.grid_tier}</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <Users className="w-3 h-3" /> {c.target_audience}
                  </div>
                  <div className="flex items-center gap-1.5 text-blue-400 font-bold">
                    <TrendingUp className="w-3 h-3" /> ~{c.estimated_ctr}% CTR
                  </div>
                </div>
                <div className="mt-2 px-2 py-1 bg-gray-800 rounded-lg">
                  <p className="text-xs text-gray-400"><span className="text-yellow-400 font-bold">Strength:</span> {c.strength}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Intel columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Top Creative Styles</p>
              <div className="space-y-1">
                {report.top_creative_styles?.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-300">
                    <span className="text-purple-400 font-bold">{i + 1}.</span> {s}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Low Competition Windows</p>
              <div className="space-y-1">
                {report.low_competition_windows?.map((w, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-green-400">
                    <span className="font-bold">•</span> {w}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Strategic recommendations */}
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-yellow-400" />
              <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider">Strategic Recommendations to Outmaneuver Rivals</p>
            </div>
            <div className="space-y-2">
              {report.strategic_recommendations?.map((rec, i) => (
                <div key={i} className="flex gap-2 text-sm text-gray-300">
                  <span className="text-yellow-400 font-bold flex-shrink-0">{i + 1}.</span> {rec}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
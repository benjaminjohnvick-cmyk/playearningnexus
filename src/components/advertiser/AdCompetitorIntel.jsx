import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart2, Loader2, Zap, TrendingUp, Target, Eye, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const TIER_COLORS = { Premium: 'text-yellow-400', High: 'text-orange-400', Standard: 'text-blue-400', Economy: 'text-gray-400' };
const TIER_BG = { Premium: 'bg-yellow-500/10 border-yellow-500/20', High: 'bg-orange-500/10 border-orange-500/20', Standard: 'bg-blue-500/10 border-blue-500/20', Economy: 'bg-gray-700 border-gray-600' };

function BidBar({ bid, maxBid }) {
  const pct = Math.min(100, (bid / maxBid) * 100);
  return (
    <div className="w-full bg-gray-800 rounded-full h-1.5">
      <div className="h-1.5 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function AdCompetitorIntel({ ads }) {
  const [competitors, setCompetitors] = useState([]);
  const [counterTaglines, setCounterTaglines] = useState({});
  const [loading, setLoading] = useState(true);
  const [generatingFor, setGeneratingFor] = useState(null);
  const [myMemories, setMyMemories] = useState([]);

  useEffect(() => { loadData(); }, [ads]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get all active ads except user's own
      const myAdIds = new Set(ads.map(a => a.id));
      const allAds = await base44.entities.AdListing.filter({ status: 'active' }, '-bid_amount', 100);
      const others = allAds.filter(a => !myAdIds.has(a.id));

      // Get learning memories for pattern analysis
      const memories = await base44.entities.AdLearningMemory.list('-snapshot_date', 50);
      setMyMemories(memories.filter(m => ads.some(a => a.id === m.ad_id)));

      // Group by brand, pick top bid per brand, get top 5
      const brandMap = {};
      for (const ad of others) {
        if (!brandMap[ad.brand_name] || ad.bid_amount > brandMap[ad.brand_name].bid_amount) {
          brandMap[ad.brand_name] = ad;
        }
      }
      const top5 = Object.values(brandMap)
        .sort((a, b) => (b.bid_amount || 0) - (a.bid_amount || 0))
        .slice(0, 5);

      // Enrich with memory data where available
      const enriched = top5.map(ad => {
        const mem = memories.find(m => m.ad_id === ad.id);
        const taglineWords = (ad.tagline || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
        return { ...ad, memory: mem, topKeywords: taglineWords.slice(0, 5) };
      });

      setCompetitors(enriched);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const generateCounterTagline = async (competitor) => {
    setGeneratingFor(competitor.id);
    try {
      const myTaglines = ads.map(a => a.tagline).filter(Boolean).join(', ');
      const myBrands = ads.map(a => a.brand_name).join(', ');
      const myMemory = myMemories[0];

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert ad strategist for a gaming platform. Generate 3 counter-taglines to outcompete this competitor.

COMPETITOR AD:
- Brand: ${competitor.brand_name}
- Tagline: "${competitor.tagline || 'none'}"
- Bid: $${competitor.bid_amount}/survey
- Grid Tier: ${competitor.grid_tier}
- Top keywords: ${competitor.topKeywords.join(', ')}

MY ADS:
- Brands: ${myBrands}
- My taglines: ${myTaglines}
- My avg CTR: ${myMemory?.ctr?.toFixed(1) || 'unknown'}%

Generate 3 counter-taglines that:
1. Target the audience gap NOT covered by "${competitor.tagline}"
2. Are more specific, benefit-driven, and action-oriented
3. Are max 8 words each
4. Feel competitive and urgent without copying

Return JSON: { taglines: [{ text: string, why: string }] }`,
        response_json_schema: {
          type: 'object',
          properties: {
            taglines: {
              type: 'array',
              items: {
                type: 'object',
                properties: { text: { type: 'string' }, why: { type: 'string' } }
              }
            }
          }
        }
      });

      setCounterTaglines(prev => ({ ...prev, [competitor.id]: result.taglines || [] }));
      toast.success('Counter-taglines generated!');
    } catch (e) {
      toast.error('Generation failed');
    }
    setGeneratingFor(null);
  };

  const maxBid = Math.max(...competitors.map(c => c.bid_amount || 0), 0.4);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Analyzing competitor landscape...
      </div>
    );
  }

  if (competitors.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-bold">No competitor data yet</p>
        <p className="text-xs mt-1">More ads need to be active on the grid for competitive analysis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Competitors tracked', value: competitors.length, color: 'text-blue-400' },
          { label: 'Top bid in market', value: `$${maxBid.toFixed(2)}`, color: 'text-yellow-400' },
          { label: 'My avg bid', value: `$${(ads.reduce((s, a) => s + (a.bid_amount || 0.4), 0) / Math.max(1, ads.length)).toFixed(2)}`, color: 'text-green-400' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-700 rounded-2xl p-3 text-center">
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-gray-500 text-[10px] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Competitor cards */}
      {competitors.map((comp, idx) => (
        <div key={comp.id} className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-gray-800">
            <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-black text-gray-300">
              #{idx + 1}
            </div>
            {comp.image_url && (
              <img src={comp.image_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white font-black text-sm truncate">{comp.brand_name}</p>
              <p className="text-gray-500 text-xs truncate">"{comp.tagline || 'No tagline'}"</p>
            </div>
            <Badge className={`text-[10px] border ${TIER_BG[comp.grid_tier] || TIER_BG.Standard}`}>
              <span className={TIER_COLORS[comp.grid_tier] || 'text-gray-400'}>{comp.grid_tier || 'Standard'}</span>
            </Badge>
          </div>

          {/* Metrics */}
          <div className="px-4 py-3 space-y-3">
            {/* Bid bar */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">Current bid</span>
                <span className="text-yellow-400 font-bold">${(comp.bid_amount || 0.4).toFixed(2)}/survey</span>
              </div>
              <BidBar bid={comp.bid_amount || 0.4} maxBid={maxBid} />
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Clicks', val: comp.total_clicks || 0, icon: <Eye className="w-3 h-3" /> },
                { label: 'Completions', val: comp.surveys_completed || 0, icon: <Target className="w-3 h-3" /> },
                { label: 'CTR', val: comp.total_clicks > 0 ? `${((comp.surveys_completed / comp.total_clicks) * 100).toFixed(1)}%` : '—', icon: <TrendingUp className="w-3 h-3" /> },
              ].map(s => (
                <div key={s.label} className="bg-gray-800 rounded-xl p-2">
                  <div className="flex justify-center text-gray-500 mb-0.5">{s.icon}</div>
                  <p className="text-white font-black text-sm">{s.val}</p>
                  <p className="text-gray-600 text-[10px]">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Keyword pills */}
            {comp.topKeywords.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Tagline Keywords</p>
                <div className="flex flex-wrap gap-1">
                  {comp.topKeywords.map(kw => (
                    <span key={kw} className="bg-gray-800 border border-gray-700 text-gray-400 text-[10px] px-2 py-0.5 rounded-full">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AI counter-taglines */}
            {counterTaglines[comp.id] ? (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> AI Counter-Taglines
                </p>
                {counterTaglines[comp.id].map((ct, i) => (
                  <div key={i} className="bg-purple-500/5 border border-purple-500/20 rounded-xl px-3 py-2">
                    <p className="text-white text-xs font-bold">"{ct.text}"</p>
                    <p className="text-purple-400/70 text-[10px] mt-0.5">{ct.why}</p>
                  </div>
                ))}
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="w-full border-purple-500/30 text-purple-300 hover:bg-purple-500/10 gap-2 text-xs"
                onClick={() => generateCounterTagline(comp)}
                disabled={generatingFor === comp.id}
              >
                {generatingFor === comp.id
                  ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
                  : <><Sparkles className="w-3 h-3" /> Generate AI Counter-Taglines</>
                }
              </Button>
            )}
          </div>
        </div>
      ))}

      <Button variant="outline" onClick={loadData} className="w-full border-gray-700 text-gray-400 gap-2 text-xs">
        <RefreshCw className="w-3 h-3" /> Refresh Competitor Data
      </Button>
    </div>
  );
}
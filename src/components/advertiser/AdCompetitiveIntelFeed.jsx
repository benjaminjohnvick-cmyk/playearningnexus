import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, RefreshCw, Eye, TrendingUp, Users, Target, Zap } from 'lucide-react';

const COMPETITORS = [
  { name: 'GamePulse Ads', color: 'blue', bid: 0.72, tier: 'Premium', demos: ['18-24 Gaming', '25-34 Tech'], impressions: 84200, ctr: 4.8 },
  { name: 'PixelReach', color: 'purple', bid: 0.58, tier: 'High', demos: ['13-17 Mobile', '18-24 Gaming'], impressions: 61500, ctr: 3.9 },
  { name: 'AdVault Pro', color: 'orange', bid: 0.45, tier: 'Standard', demos: ['25-34 Finance', '35-44 Tech'], impressions: 44800, ctr: 3.2 },
  { name: 'NeoClick', color: 'cyan', bid: 0.38, tier: 'Standard', demos: ['18-24 Gaming', '18-24 Sports'], impressions: 38100, ctr: 2.9 },
  { name: 'HypeBoard', color: 'pink', bid: 0.31, tier: 'Economy', demos: ['13-17 Mobile', '13-17 Gaming'], impressions: 22400, ctr: 2.1 },
];

const SAMPLE_HEADLINES = [
  ['Unlock Free Gaming Rewards Today', 'Play & Earn — No Purchase Needed', 'Your Next Gaming Session Pays You'],
  ['Level Up Your Wallet', 'Elite Gamers Earn More Here', 'Pro Gameplay. Real Cash.'],
  ['Smart Money Moves for Techies', 'Finance Tools Built for You', 'Invest Smarter. Play Harder.'],
  ['Click. Click. Collect.', 'Micro-Rewards Every Session', '1000s Earning Daily — Join Now'],
  ['Teens: Earn While You Play', 'Zero Cost, Real Rewards', 'Your Parents Will Actually Approve'],
];

const THUMB_COLORS = ['from-blue-600 to-purple-600', 'from-purple-600 to-pink-600', 'from-orange-500 to-red-600', 'from-cyan-500 to-blue-600', 'from-pink-500 to-rose-600'];
const COLOR_MAP = { blue: 'text-blue-400 border-blue-500/20 bg-blue-500/5', purple: 'text-purple-400 border-purple-500/20 bg-purple-500/5', orange: 'text-orange-400 border-orange-500/20 bg-orange-500/5', cyan: 'text-cyan-400 border-cyan-500/20 bg-cyan-500/5', pink: 'text-pink-400 border-pink-500/20 bg-pink-500/5' };

function CompetitorCard({ comp, idx, myAds, onGenerate, generating }) {
  const colorCls = COLOR_MAP[comp.color];
  const headlines = SAMPLE_HEADLINES[idx];
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border rounded-2xl p-4 ${colorCls}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="font-black text-white text-sm">{comp.name}</p>
            <Badge className={`text-[10px] border ${colorCls}`}>{comp.tier}</Badge>
          </div>
          <div className="flex flex-wrap gap-1">
            {comp.demos.map(d => <span key={d} className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded border border-gray-700">{d}</span>)}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-black text-white">${comp.bid}</p>
          <p className="text-gray-500 text-[10px]">bid/survey</p>
        </div>
      </div>

      {/* Simulated thumbnails */}
      <div className="flex gap-2 mb-3">
        {[0, 1, 2].map(i => (
          <div key={i} className={`flex-1 h-16 rounded-xl bg-gradient-to-br ${THUMB_COLORS[idx]} flex items-center justify-center relative overflow-hidden`}>
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.1) 4px, rgba(255,255,255,0.1) 8px)' }} />
            <span className="text-white text-[9px] font-black text-center px-1 leading-tight z-10">{comp.name.split(' ')[0]}</span>
          </div>
        ))}
      </div>

      {/* Headlines */}
      <div className="space-y-1 mb-3">
        {headlines.map((h, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <span className="text-gray-600 font-mono text-[10px]">H{i + 1}</span>
            <span className="text-gray-300">{h}</span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center bg-gray-900 rounded-lg p-1.5">
          <p className="text-white font-black text-sm">{(comp.impressions / 1000).toFixed(1)}k</p>
          <p className="text-gray-600 text-[10px]">Impressions</p>
        </div>
        <div className="text-center bg-gray-900 rounded-lg p-1.5">
          <p className="text-white font-black text-sm">{comp.ctr}%</p>
          <p className="text-gray-600 text-[10px]">CTR</p>
        </div>
        <div className="text-center bg-gray-900 rounded-lg p-1.5">
          <p className="text-white font-black text-sm">${(comp.impressions * comp.ctr / 100 * comp.bid).toFixed(0)}</p>
          <p className="text-gray-600 text-[10px]">Est. Spend</p>
        </div>
      </div>

      <Button size="sm" onClick={() => onGenerate(comp, idx)} disabled={generating === comp.name || myAds.length === 0}
        className="w-full bg-gray-800 hover:bg-gray-700 text-white text-xs h-7 gap-1.5 border border-gray-600">
        {generating === comp.name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-yellow-400" />}
        Generate Competing Variant
      </Button>
    </div>
  );
}

export default function AdCompetitiveIntelFeed({ ads }) {
  const [generating, setGenerating] = useState(null);
  const [variants, setVariants] = useState({});
  const [lastScan, setLastScan] = useState(new Date());

  const handleGenerate = async (comp, idx) => {
    setGenerating(comp.name);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Competitor "${comp.name}" is running ads targeting "${comp.demos.join(', ')}" with headlines like: "${SAMPLE_HEADLINES[idx].join(' | ')}". Their bid is $${comp.bid} with ${comp.ctr}% CTR.

Generate a superior competing ad for a gaming rewards platform with:
1. A more compelling headline (max 8 words)
2. A stronger copy line (max 15 words)  
3. A suggested bid adjustment to beat them
4. One key differentiator to highlight

Return JSON.`,
      response_json_schema: {
        type: 'object',
        properties: {
          headline: { type: 'string' },
          copy: { type: 'string' },
          suggested_bid: { type: 'number' },
          differentiator: { type: 'string' },
        }
      }
    });
    setVariants(prev => ({ ...prev, [comp.name]: result }));
    setGenerating(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <RefreshCw className="w-3.5 h-3.5" />
          Last scanned: {lastScan.toLocaleTimeString()}
        </div>
        <Button size="sm" onClick={() => setLastScan(new Date())} variant="outline" className="border-gray-600 text-gray-400 text-xs h-7 gap-1">
          <RefreshCw className="w-3 h-3" /> Refresh Feed
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {COMPETITORS.map((comp, idx) => (
          <div key={comp.name} className="space-y-3">
            <CompetitorCard comp={comp} idx={idx} myAds={ads} onGenerate={handleGenerate} generating={generating} />
            {variants[comp.name] && (
              <div className="border border-yellow-500/20 bg-yellow-500/5 rounded-2xl p-3 space-y-2">
                <p className="text-[10px] font-black text-yellow-400 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> AI Counter-Variant
                </p>
                <p className="text-white font-bold text-sm">{variants[comp.name].headline}</p>
                <p className="text-gray-400 text-xs">{variants[comp.name].copy}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-green-500/10 text-green-400 border border-green-500/20 text-[10px]">
                    Bid: ${variants[comp.name].suggested_bid}
                  </Badge>
                  <span className="text-gray-500 text-[10px]">{variants[comp.name].differentiator}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {ads.length === 0 && (
        <p className="text-center text-gray-600 text-xs py-4">Create an ad first to generate competing variants.</p>
      )}
    </div>
  );
}